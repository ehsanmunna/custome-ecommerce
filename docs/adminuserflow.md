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
| 2 | Creates 24 permissions across 7 groups: catalog, media, inventory, orders, customers, settings, roles |
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
Access: admin.auth.read
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
- Rejects `409 Conflict` if the role key already exists
- Rejects `400 Bad Request` if any permission key is invalid

### PATCH /admin/roles/{roleId} — Update Role

```
Access: admin.roles.update, scope: store
Body: { key?, name?, description?, scope?, permissionKeys? }
Response: Role (200)
```

- Updates role fields and replaces permission grants
- Rejects `404 Not Found` if the role does not exist
- Rejects `403 Forbidden` if attempting to change the scope of a system role

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
| **owner** | store | All 24 permissions |
| **manager** | store | catalog_read/manage, media_read/manage, inventory_read/manage, orders_read/manage/change_status, customers_read/manage, settings_read/manage, roles_read |
| **staff** | store | catalog_read, media_read, inventory_read, orders_read |
| **support** | store | orders_read, customers_read |

**Permission groups:** `catalog`, `media`, `inventory`, `orders`, `customers`, `settings`, `roles`.

---

## Phase 6: Protected Admin Operations (Existing)

Every other admin endpoint follows the same guard pattern:

| Domain | Endpoints | Required Permission |
|--------|-----------|-------------------|
| Auth | login, refresh, logout, me | `admin.auth.*` |
| Catalog | brands, categories, products CRUD | `admin.catalog.*` |
| Media | upload, list, delete | `admin.media.*` |
| Inventory | reserve, release, adjust | `admin.inventory.*` |
| Orders | status transitions, history | `admin.orders.*` |

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
                    │ refreshToken     │      │ admin role?     │
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