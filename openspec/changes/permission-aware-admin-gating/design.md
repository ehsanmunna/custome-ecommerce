# Design

## Context

See `proposal.md` for motivation. The API already authorizes every protected admin operation by an exact permission key declared through `@AuthAccess` and mirrored in `apps/api/openapi/openapi.yaml` as `x-required-permission`. The admin application already stores the signed-in administrator's permission list from login and `/auth/me`, and `AuthService.hasPermission` reads it. What is missing is the connection between those permissions and the UI: `app.routes.ts` and `admin-menu.config.ts` still declare fixed role-key lists, `roleGuard` calls `hasAnyRole`, and most page templates render write actions unconditionally.

Three data and contract gaps underlie the change:

- `image-storage.read` is required by the media list and serve operations but is absent from `packages/database/src/seed.ts`. It exists in the running database only because a stale compiled seed once contained it, so a fresh seed would remove media access for every role.
- `admin.users.disable` exists in the seed and is required by the disable operation, but is missing from the running database, so the action is denied for every role.
- `media.read` and `admin.users.delete` are seeded without any enforcing operation, the role-key regex accepts `.` and `-` in the API and console while the database constraint accepts only `_`, and the client permission snapshot is only refreshed by the profile screen.

`add-admin-dashboard` establishes the authoritative permission model: navigation and route access derive from permissions, with the API remaining authoritative. `add-sakai-admin-shell-and-dashboard` still specifies role-key menu filtering and removes the durable route-derived menu requirement. This change does not take a position on whether menu metadata comes from routes or configuration; its permission-filtering requirement is valid under either source, so the menu-source decision stays with the shell change. This closes the Phase 3 access-control polish and the Phase 2 permission reconciliation described in `docs/plan.md`.

## Goals / Non-Goals

**Goals:**

- One permission key set shared by the OpenAPI contract, API guards, seed data, routes, menu, page actions, and dashboard widgets.
- Custom roles become usable in the console without code changes or baseline role membership.
- Existing installations converge on the canonical catalog through an idempotent migration and seed.
- Permission changes take effect during a session without exposing stale grants.

**Non-Goals:**

- New domain endpoints, new admin screens, or a new permission-administration UI.
- Removing roles from the identity model; roles remain the grant container and are still displayed.
- Changing token storage, refresh behavior, or storefront authorization.
- Rewriting the menu source of truth owned by `add-sakai-admin-shell-and-dashboard`.

## Decisions

### Use one permission catalog as the contract

**Decision:** Treat the permission keys required by protected API operations as the canonical catalog. Seed exactly those keys plus an explicit reserved list. In the console, define one typed `ADMIN_PERMISSIONS` constant map and use only those constants in route data, menu entries, action checks, and widget checks. A contract test asserts that OpenAPI `x-required-permission` values, controller declarations, seeded keys, and console constants agree, with `notifications.read` and `notifications.test` allowlisted as reserved until notification administration ships.

**Rationale:** The guard matches keys exactly, so every layer must use identical strings. A single typed map makes an unknown key a compile-time or test failure rather than a silent denial.

**Alternative considered:** Derive console routes from runtime API permission discovery. Rejected because the API does not expose UI grouping, ordering, or route metadata, and startup would depend on an extra request.

### Replace route role lists with permission requirements

**Decision:** Extend route data with `permissions: string[]` and `permissionMode: 'all' | 'any'`, defaulting to `all`. Replace `roleGuard` with a permission guard that checks authentication first, then the requirement, redirecting unauthenticated visitors to sign-in with `returnUrl` and authorized-but-unpermitted visitors to `/forbidden`. Remove `hasRole` and `hasAnyRole` from authorization paths; keep the role accessor for display only.

| Route | Required permission |
| --- | --- |
| `dashboard` | any of `analytics.read`, `orders.read`, `inventory.read`, `customers.read` |
| `customers` | `customers.read` |
| `products`, `products/:productId/variants` | `catalog.products.read` |
| `categories`, `attributes` | `catalog.categories.read` |
| `brands` | `catalog.brands.read` |
| `media` | `image-storage.read` |
| `inventory`, `inventory/reservations`, `inventory/movements` | `inventory.read` |
| `inventory/adjust` | `inventory.adjust` |
| `orders`, `orders/:orderId` | `orders.read` |
| `orders/:orderId/status` | `orders.status.update` |
| `returns` | `orders.returns.read` |
| `returns/:returnId/status` | `orders.returns.update` |
| `settings` | any of `settings.read`, `shipping.zones.read`, `promotions.coupons.read`, `admin.users.read`, `admin.roles.read`, `cms.pages.read`, `cms.banners.read`, `analytics.read`, `inventory.read` |
| `settings/shipping-zones` | `shipping.zones.read` |
| `settings/coupons` | `promotions.coupons.read` |
| `settings/users` | `admin.users.read` |
| `settings/roles` | `admin.roles.read` |
| `cms/pages` | `cms.pages.read` |
| `cms/banners` | `cms.banners.read` |
| `reports/sales` | `analytics.read` |
| `reports/low-stock` | `inventory.read` |
| `profile` | `admin.auth.read` |

**Rationale:** Route declarations become the single access decision for both direct navigation and menu visibility, and custom roles work automatically because no route names a role.

**Alternative considered:** Map each role to an allowed route set on the client. Rejected because it duplicates server grants, breaks custom roles, and cannot reflect per-endpoint least privilege.

### Mirror route requirements in the menu

**Decision:** Replace each menu entry's `roles` field with the same permission requirement used by its route. `MenuService` filters the tree from the reactive permission snapshot, omits a parent whose children are all hidden, and keeps the existing active-route behavior. Keep the menu-route alignment test but compare permissions instead of role lists.

**Rationale:** Route and menu can no longer drift into different authorization models, and groups such as Settings disappear when none of their children are permitted.

**Alternative considered:** Hide entries by role but enforce routes by permission. Rejected because a custom role would still see entries it cannot open.

### Gate actions at render time and trust only the API

**Decision:** Wrap write actions in `hasPermission` checks and rely on the API for final enforcement. Standardize on the pattern already used by the users and roles screens. When the API denies a request, report failure through `NotificationService`; never show a success state.

| Page | Actions and required permissions |
| --- | --- |
| Products and variants | `catalog.products.create`, `catalog.products.update`, `catalog.products.delete`; media attach uses `media.create` |
| Categories, attributes | `catalog.categories.create`, `catalog.categories.update`, `catalog.categories.delete` |
| Brands | `catalog.brands.create`, `catalog.brands.update`, `catalog.brands.delete` |
| Media | upload `media.create`, delete `media.delete` |
| Inventory and reservations | `inventory.adjust` for adjustments and reservation changes |
| Orders | `orders.status.update` for status actions |
| Returns | `orders.returns.update` for return status actions |
| General settings | `settings.update` (API only; the console exposes no general settings form yet) |
| Shipping zones | `shipping.zones.create`, `shipping.zones.update`, `shipping.zones.delete` |
| Coupons | `promotions.coupons.create`, `promotions.coupons.update`, `promotions.coupons.delete` |
| Administrators | `admin.users.create`, `admin.users.update`, `admin.users.disable` |
| Roles | `admin.roles.create`, `admin.roles.update`, `admin.roles.delete` |
| CMS pages | `cms.pages.create`, `cms.pages.update`, `cms.pages.delete` |
| CMS banners | `cms.banners.create`, `cms.banners.update`, `cms.banners.delete` |

Affected pages keep the shared list layout and components; only action visibility changes.

**Rationale:** Client checks improve usability, while server enforcement covers stale snapshots, crafted requests, and permission edits made elsewhere.

**Alternative considered:** Hide whole pages from read-only administrators. Rejected because read access is a valid least-privilege grant and the specs require read-only views.

### Make the permission snapshot reactive and refreshable

**Decision:** Hold the current administrator in a signal inside `AuthService`, expose a computed permission set, and have `hasPermission`, the guard, the menu, and templates read the signal. Refresh the snapshot from `/auth/me` when the authenticated shell initializes, once after an authorization denial, and after saving a role that includes the administrator's own role. A failed refresh keeps the last known snapshot and reports a non-fatal error; a 401 continues through the existing session-clearing flow. The interceptor coordinates a single in-flight refresh and does not silently retry a denied operation.

**Rationale:** Signal-backed permissions update the OnPush shell without a reload, and the refresh points cover the realistic ways grants change during a session.

**Alternative considered:** Requiring a new sign-in after every role edit. Rejected because the API already accepts the new grants and the stale UI would misrepresent access.

### Gate dashboard widgets by their data permission

**Decision:** Map each widget to the permission its API call requires, expose `canView(widget)`, and have the dashboard load only permitted widget data. Unauthorized widgets are not rendered; permitted widgets keep their independent loading and error states.

| Widget | Required permission |
| --- | --- |
| Orders and revenue stat cards, revenue chart, top products | `analytics.read` |
| New customers | `customers.read` |
| Recent orders, order status | `orders.read` |
| Low-stock count, low-stock alerts | `inventory.read` |

**Rationale:** Hiding a widget is honest least-privilege behavior, avoids predictable 403 noise, and matches the reporting spec. The dashboard route's any-of requirement lets staff and support still reach the widgets they may see.

**Alternative considered:** Render a locked placeholder for every unavailable widget. Rejected as the default because it preserves layout but advertises data the administrator cannot use; a restricted state remains acceptable where a widget's absence would collapse the grid.

### Reconcile the catalog, grants, and dead keys

**Decision:** Add `image-storage.read` to the seed with the `image-storage` group; keep `admin.users.disable`; remove `media.read` and `admin.users.delete` because no operation enforces them; keep `notifications.read` and `notifications.test` as declared reserved keys. Baseline grants become explicit endpoint keys: owner receives all; manager receives operational catalog, media, inventory, orders, customers, settings, shipping, promotions, CMS, analytics, and `admin.roles.read`; staff receives read-only catalog, `image-storage.read`, inventory, and orders; support receives read-only orders and customers. Legacy translation maps `media_read` to `image-storage.read` and `media_manage` to `image-storage.read`, `media.create`, and `media.delete`.

**Rationale:** The catalog then describes only enforceable permissions, and media access works on a fresh seed for every role that can reach the media screen.

**Alternative considered:** Keep `media.read` and teach the guard aliases. Rejected because exact matching is the current contract and aliases make role grants ambiguous.

### Converge existing databases with an idempotent migration and seed

**Decision:** Add a Prisma migration that inserts missing catalog entries, grants `image-storage.read` and `admin.users.disable` to the appropriate baseline roles, translates legacy grants on custom roles, and deletes grant rows and catalog rows for the two removed keys. Keep the seed idempotent: upsert permissions by key, reconcile baseline role grants by diffing desired and current keys, and leave custom-role grants untouched except for known legacy translations.

**Rationale:** Deployments have already diverged; a migration plus seed makes both fresh and existing databases reach the same state without manual SQL.

**Alternative considered:** Seed-only reconciliation. Rejected because deployments that run migrations but not seeds would stay broken, and the removed keys need explicit cleanup.

### Tighten role-key validation to the database contract

**Decision:** Use `^[a-z][a-z0-9_]*$` in the API schema and the console form, matching the existing `admin_roles_key_format` constraint. Return a validation error for rejected input. Do not broaden the constraint.

**Rationale:** Valid role keys never needed dots or hyphens, and the current API accepts values the database can never store, producing a server error. Tightening removes that class of failure without a data migration.

**Alternative considered:** Broaden the database constraint to `^[a-z][a-z0-9_.-]*$`. Rejected because it admits keys that look like permission keys and requires a constraint migration for no product benefit.

### Keep role and account self-protection server-enforced

**Decision:** System role keys and names are immutable and system roles cannot be deleted; grants remain editable by administrators holding `admin.roles.update`. The API rejects an administrator disabling their own account. The console hides or disables the same actions, but the API check is authoritative.

**Rationale:** The current roles screen lets an owner edit grants on the owner role, and the users screen can disable the signed-in administrator, which can leave a store with no one able to administer roles.

**Alternative considered:** Make all system role grants immutable. Rejected because stores need to tune manager and staff grants, and the roles UI was verified around editable grants.

## Risks / Trade-offs

- [Client grants stay stale until a refresh point] → Refresh on shell start, after a denial, and after an own-role save; document that a change made by another administrator appears at the next refresh or denied request.
- [A 403-triggered refresh can loop or mask the original error] → Single-flight refresh, no automatic retry of the denied request, and keep the original error visible.
- [Removing dead permissions breaks custom grants that reference them] → Translate known legacy keys first, delete only orphaned rows, log removed grants in the migration, and verify custom roles before release.
- [Console permission literals drift from the API] → Typed constants plus a cross-layer contract test with a reserved-key allowlist.
- [Menu-source conflict with `add-sakai-admin-shell-and-dashboard`] → This change adds permission filtering without touching the menu-source requirement; before archiving either change, replace that change's role-based menu requirement with permission metadata, or archive in an order that leaves the durable spec permission-based.
- [Hiding dashboard widgets makes the grid sparse for narrow roles] → The dashboard route requires at least one widget permission, and permitted widgets keep their normal layout; a restricted state is allowed where the grid would otherwise collapse.
- [A fresh seed grants media access more broadly than the running database did] → Intended least-privilege alignment for roles that can reach the media screen; verify the owner, manager, staff, support, and a custom role after reseeding.

## Migration Plan

1. Back up the database, then run the permission reconciliation migration and seed. Verify catalog keys, baseline grants, and unchanged custom-role grants before deploying the console.
2. Deploy API changes for role-key validation and system-role/self-disable protection. These are backward compatible because the rejected values were never persistable.
3. Deploy the console permission gating: constants, route guard, menu filter, action checks, snapshot refresh, and widget gating.
4. Verify the permission matrix for owner, manager, staff, support, and at least one custom role on both a migrated database and a freshly seeded one, including direct navigation to denied routes.
5. Rollback: revert the console deployment first; the API remains authoritative. If a removed permission must be restored, reinsert its catalog row and grants; no user or domain data is destroyed by this change.
