# Admin User Flow

Complete flow for an administrator, from provisioning through authentication, authorization, and role management.

---

## Phase 1: Provisioning (One-Time Setup)

The first administrator is created during database seeding. There is **no admin self-registration endpoint**.

### Command

```bash
SEED_ADMIN_EMAIL=owner@example.com \
SEED_ADMIN_PASSWORD=ChangeMe123 \
SEED_ADMIN_DISPLAY_NAME="Store Owner" \
pnpm db:migrate   # MIGRATION_DATABASE_URL = app_migrator identity
pnpm db:seed      # DATABASE_URL = app_runtime identity
```

### What `pnpm db:seed` Does

| Step | Action |
|------|--------|
| 1 | Creates admin roles: `owner`, `manager`, `staff`, `support` (all `scope: 'store'`) |
| 2 | Creates the canonical permission catalog (54 endpoint-level keys across 15 groups: `admin-auth`, `admin-users`, `roles`, `catalog`, `image-storage`, `media`, `inventory`, `orders`, `customers`, `shipping`, `promotions`, `settings`, `cms`, `notifications`, `analytics`) |
| 3 | Assigns permission grants to each role via `admin_role_permissions` |
| 4 | Seeds settings (tax, payments, courier, notifications) |
| 5 | Seeds shipping zones (Dhaka, outside Dhaka) |
| 6 | Creates first admin user with `owner` role and `status: 'active'` (only if `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` provided and no admin exists yet) |

**Result:** An admin account exists with `owner` role (store scope, all permissions).

---

## Phase 2: Authentication

### Step 1: Login

```
POST /v1/admin/auth/login
Body: { email, password }
Access: public
```

**Flow** (`AuthService.adminPasswordLogin`):

1. Find `adminUser` by email
2. Verify argon2id/scrypt password hash
3. Check `status === 'active'`
4. Create `auth_session` + `auth_refresh_token`
5. Issue HS256 JWT access token

**Response:**
```json
{
  "accessToken": "<JWT>",
  "refreshToken": "<opaque string>",
  "expiresIn": 900,
  "user": {
    "id": "...",
    "email": "owner@example.com",
    "displayName": "Store Owner",
    "status": "active",
    "role": { "id": "...", "key": "owner", "name": "Owner", "scope": "store", "system": true, "permissions": [...] },
    "permissions": ["admin.roles.read", "admin.roles.create", ...]
  }
}
```

### Step 2: Refresh (when access token expires)

```
POST /v1/admin/auth/refresh
Body: { refreshToken }
Access: public (the refresh token is the credential)
```

- Rotates the refresh token (single-use, replay detection revokes the session on reuse)
- Issues a new access token bound to the same session

### Step 3: Logout

```
POST /v1/admin/auth/logout
Access: admin.auth.logout, scope: store
```

- Revokes the session → both access and refresh tokens are invalidated

### Step 4: Me

```
GET /v1/admin/auth/me
Access: admin.auth.read, scope: store
```

- Returns the authenticated admin's identity and permissions

---

## Phase 3: Authorization Guard (Every Admin Request)

```
Request with Authorization: Bearer <accessToken>
        │
        ▼
AuthenticationGuard (global APP_GUARD via @AuthAccess decorator)
        │
        ├─ access === 'public'? → allow (login, refresh, public endpoints)
        │
        ├─ access === 'admin'?
        │     │
        │     ├─ Validate HS256 JWT signature + claims (iss, aud='admin', sub, sid)
        │     │
        │     ├─ Check auth_sessions row: exists, not revoked, not expired
        │     │
        │     ├─ prisma.adminUser.findUnique(id=claims.sub)
        │     │     └─ status === 'active'? → else 401
        │     │
        │     ├─ Route must have AuthAccess metadata → else 403
        │     │
        │     ├─ Check permission in user.role.permissions → else 403
        │     │
        │     ├─ Check role.scope === requirement.scope → else 403
        │     │
        │     ▼
        │  request.auth = { identityType:'admin', subjectId, sessionId, user }
        │  Allow request to proceed
        │
        ▼
Controller executes business logic
```

### Error Map

| Condition | Status | Message |
|-----------|--------|---------|
| Missing/invalid Bearer token | 401 | `Bearer authentication is required` |
| Invalid/expired access token | 401 | `Invalid or expired access token` |
| Session revoked or expired | 401 | `Invalid or expired access token` |
| Admin not found or inactive | 401 | `Invalid or inactive admin session` |
| Route has no permission configured | 403 | `Admin operation has no required permission` |
| Admin lacks required permission | 403 | `Required admin permission is missing` |
| Role scope mismatch | 403 | `Admin role scope does not permit this operation` |
| Route access policy not configured | 403 | `Route access policy is not configured` |

---

## Phase 3b: Console Access (Permission-Based)

The admin console authorizes every protected route, navigation entry, and page action from the signed-in administrator's permission snapshot. Role names are display data only; a custom role works as soon as its grants include the required permission.

### Route access

- Every protected route declares `data.permissions` (`string[]`) and `data.permissionMode` (`'all' | 'any'`, default `'all'`).
- `permissionGuard` checks authentication first. An unauthenticated visitor is sent to `/login` with `returnUrl`; an authenticated administrator who lacks the requirement is sent to `/forbidden`.
- The dashboard route requires any of `analytics.read`, `orders.read`, `inventory.read`, or `customers.read`. The settings route likewise accepts any settings-area read permission. All other routes require their single declared read or action permission.
- Direct navigation is denied even when the corresponding menu entry is hidden.

### Navigation

- Each menu entry declares the same permission requirement as the route it links to; a menu-route test enforces the match.
- The menu is computed from the reactive permission snapshot, so a snapshot change updates navigation without a reload.
- An entry whose requirement is not met is hidden.
- A parent that is itself a navigable route stays visible while its own route permission is held, even when every child is hidden. For example, support keeps **Orders** without **Returns**. A parent whose own requirement is unmet and whose children are all hidden is omitted entirely.

### Page action visibility

Write actions render only when the administrator holds the permission required by the corresponding API operation. The API remains authoritative: a rejected request reports failure and never shows a success state.

| Page | Actions and required permissions |
|------|----------------------------------|
| Products and variants | `catalog.products.create`, `catalog.products.update`, `catalog.products.delete`; media attach uses `media.create` |
| Categories, attributes | `catalog.categories.create`, `catalog.categories.update`, `catalog.categories.delete` |
| Brands | `catalog.brands.create`, `catalog.brands.update`, `catalog.brands.delete` |
| Media | upload `media.create`, delete `media.delete` |
| Inventory and reservations | `inventory.adjust` for adjustments and reservation changes |
| Orders | `orders.status.update` for status actions |
| Returns | `orders.returns.update` for return status actions |
| General settings | `settings.update` |
| Shipping zones | `shipping.zones.create`, `shipping.zones.update`, `shipping.zones.delete` |
| Coupons | `promotions.coupons.create`, `promotions.coupons.update`, `promotions.coupons.delete` |
| Administrators | `admin.users.create`, `admin.users.update`, `admin.users.disable` |
| Roles | `admin.roles.create`, `admin.roles.update`, `admin.roles.delete` |
| CMS pages | `cms.pages.create`, `cms.pages.update`, `cms.pages.delete` |
| CMS banners | `cms.banners.create`, `cms.banners.update`, `cms.banners.delete` |

Affected list pages keep the shared layout in every permission state: breadcrumb, header row with the title and optional **New** action, search/filter bar, then table.

### Snapshot refresh

`AuthService` holds the current administrator in a signal and exposes a computed permission set. `hasPermission`, the guard, the menu, and templates read that signal.

The console refreshes the snapshot from `/auth/me`:

- when the authenticated shell starts;
- once after a 403 authorization denial (the interceptor shares a single in-flight refresh and does not retry the denied request);
- after saving a role that is the administrator's own role.

A successful refresh makes gained permissions usable and removes lost ones without signing in again. A failed refresh keeps the last known snapshot, grants nothing new, and reports a non-fatal error. A 401 still follows the normal session-clearing flow. A grant or revocation made by another administrator becomes visible at the next refresh point or denied request.

### Role and account protection

- System-role keys and names are immutable, and system roles cannot be deleted.
- Grants on a system role remain editable by an administrator holding `admin.roles.update`.
- The administrator and role screens hide self-disable and system-role delete or rename actions.
- The API enforces the same rules independently, so a crafted request cannot bypass the console.

---

## Phase 4: Role & Permission Management

All endpoints are store-scoped (`scope: 'store'`).

### GET /admin/roles — List Roles

```
Access: admin.roles.read, scope: store
Response: RolePage { items: Role[], meta: PageMetadata }
```

Returns a paginated list of all admin roles, each with `key`, `name`, `scope`, `system` flag, and assigned `permissionKeys`.

### POST /admin/roles — Create Role

```
Access: admin.roles.create, scope: store
Body: { key, name, description?, scope, permissionKeys[] }
Response: Role (201)
```

- Creates `AdminRole` + `AdminRolePermission` join rows in a transaction
- Requires `key` to match `^[a-z][a-z0-9_]*$`; a hyphen, dot, uppercase letter, or leading digit returns `400 Bad Request`
- Rejects `409 Conflict` if the role key already exists
- Rejects `400 Bad Request` if any permission key is invalid

### PATCH /admin/roles/{roleId} — Update Role

```
Access: admin.roles.update, scope: store
Body: { key?, name?, description?, scope?, permissionKeys? }
Response: Role (200)
```

- Updates the name, description, and permission grants
- Rejects `404 Not Found` if the role does not exist
- Rejects `403 Forbidden` if attempting to change the key, name, or scope of a system role; grant changes remain allowed
- System-role keys and names are immutable, while grants on system roles remain editable by an administrator holding `admin.roles.update`

### DELETE /admin/roles/{roleId} — Delete Role

```
Access: admin.roles.delete, scope: store
Response: 204 No Content
```

- Rejects `403 Forbidden` if `role.isSystem === true`
- Rejects `409 Conflict` if the role is assigned to any admin user
- Returns `204` on successful deletion

### GET /admin/permissions — List Permissions

```
Access: admin.roles.read, scope: store
Response: PermissionPage { items: Permission[], meta: PageMetadata }
```

Returns a paginated list of all available permissions with `key`, `description`, `group`, and `sortOrder`.

---

## Phase 5: Admin Role Matrix (Seeded)

| Role | Scope | Permissions |
|------|-------|-------------|
| **owner** | store | Every key in the canonical catalog |
| **manager** | store | Admin session, catalog, media, inventory, order/return, customer-read, settings, shipping, coupons, CMS, notifications, and analytics operations, plus `media` write and `orders_manage`; `admin.roles.read` and `image-storage.read`; no administrator management and no role create/update/delete |
| **staff** | store | Admin session, read-only catalog (`catalog.brands.read`, `catalog.categories.read`, `catalog.products.read`), `image-storage.read`, `inventory.read`, and `orders.read` |
| **support** | store | Admin session, `orders.read`, and `customers.read` |

Permissions use the exact keys required by protected API operations (dotted keys such as `catalog.products.read`, `inventory.adjust`, and `admin.roles.read`, plus `orders_manage`). The seed translates legacy broad underscore grants to equivalent endpoint-level grants, reconciles those legacy grants on baseline system roles, and preserves custom-role grants.

**Permission groups:** `admin-auth`, `admin-users`, `roles`, `catalog`, `image-storage`, `media`, `inventory`, `orders`, `customers`, `shipping`, `promotions`, `settings`, `cms`, `notifications`, `analytics`.

`notifications.read` and `notifications.test` are reserved catalog keys: they are enforced by notification operations but do not map to a separate console screen yet.

---

## Phase 6: Protected Admin Operations (Existing)

Every other admin endpoint follows the same guard pattern:

| Domain | Endpoints | Required Permission |
|--------|-----------|-------------------|
| Auth | login, refresh, logout, me | login/refresh public; logout `admin.auth.logout`; me `admin.auth.read` |
| Administrators | list, create, update, disable | `admin.users.read`, `admin.users.create`, `admin.users.update`, `admin.users.disable` |
| Roles and permissions | roles CRUD, permission catalog | `admin.roles.read`, `admin.roles.create`, `admin.roles.update`, `admin.roles.delete` |
| Catalog | brands, categories, products, attributes, variants | `catalog.brands.*`, `catalog.categories.*`, `catalog.products.*` |
| Media | image list/serve, upload, delete | `image-storage.read`, `media.create`, `media.delete` |
| Inventory | inventory, adjustments, reservations | `inventory.read`, `inventory.adjust` |
| Orders | list/detail, status transitions, returns, parcel creation | `orders.read`, `orders.status.update`, `orders.returns.read`, `orders.returns.update`, `orders_manage` |
| Customer support | `GET /admin/customers`, `GET /admin/customers/{customerId}` | `customers.read` |
| Settings | general settings, shipping zones, coupons | `settings.read`, `settings.update`, `shipping.zones.*`, `promotions.coupons.*` |
| CMS | pages and banners | `cms.pages.*`, `cms.banners.*` |
| Reporting | sales metrics, low stock | `analytics.read`, `inventory.read` |

Customer support lookup is read-only and returns only customer profile, address, and order-summary data. It never returns passwords, OTP data, or authentication tokens.

---

## Visual Flow Summary

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Operator   │      │   Admin User     │      │   API Guard     │
│  (seeds)    │─────▶│  (logs in)       │─────▶│  (validates)    │
└─────────────┘      └────────┬─────────┘      └────────┬────────┘
                             │                         │
                             ▼                         ▼
                    ┌──────────────────┐      ┌─────────────────┐
                    │ accessToken +    │      │ session active? │
                    │ refreshToken     │      │ account active? │
                    │ (Bearer header)  │      │ permission ok?  │
                    └─────────┬────────┘      │ scope ok?       │
                              │               └────────┬────────┘
                              ▼                        ▼
                    ┌──────────────────┐      ┌─────────────────┐
                    │ Admin operations │      │ 200 OK / 401 /  │
                    │ (roles, catalog, │      │ 403             │
                    │  orders, etc.)   │      └─────────────────┘
                    └──────────────────┘
```

### Key Security Properties

- **No admin self-registration** — admins can only be created via `pnpm db:seed`
- **Access tokens:** HS256 JWT, short-lived
- **Refresh tokens:** opaque, single-use with replay detection
- **Every endpoint enforces** permission + scope match on the admin's role
- **System roles** (`isSystem = true`) are protected from deletion
- **Roles assigned to users** are protected from deletion (FK `onDelete: Restrict`)
- **All endpoints are store-scoped** — no platform-scoped operations in v1

---

## Deployment Sequence for a New Client

```
1. Create database with app_migrator and app_runtime roles
   (see docker/initdb/01-roles.sql)

2. pnpm db:migrate   (MIGRATION_DATABASE_URL = app_migrator)
   → Applies pending schema migrations

3. pnpm db:seed      (DATABASE_URL = app_runtime)
   → Seeds roles, permissions, settings, zones
   → Optionally creates first admin if SEED_ADMIN_* set

4. Start API with DATABASE_URL = app_runtime
   → Health/ready endpoints confirm schema sync

5. Admin logs in via POST /v1/admin/auth/login
   → Receives accessToken + refreshToken
   → Uses Bearer token for all subsequent admin requests
```