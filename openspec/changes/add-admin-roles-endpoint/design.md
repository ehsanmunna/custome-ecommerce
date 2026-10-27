# Design

## Context

The `admin_role` table is seeded with four store-scoped roles (owner, manager, staff, support), and permission keys `admin.roles.read`, `admin.roles.create`, `admin.roles.update`, `admin.roles.delete` already exist in the seed data. The OpenAPI contract defines `/admin/roles` and `/admin/roles/{roleId}` endpoints plus `Role`, `RoleInput`, `RolePage`, `Permission`, and `PermissionPage` schemas, but none are listed in `x-implemented-operations` and no NestJS module handles them.

Prisma models available: `AdminRole` (id, key, name, description, scope, isSystem, sortOrder), `AdminPermission` (id, key, description, groupKey, sortOrder), `AdminRolePermission` (join table).

## Goals / Non-Goals

**Goals:**
- Implement `GET /admin/roles` (paginated role list with permission grants)
- Implement `POST /admin/roles` (create role with permission grants)
- Implement `PATCH /admin/roles/{roleId}` (update role and grants)
- Implement `DELETE /admin/roles/{roleId}` (delete non-system, unassigned role)
- Implement `GET /admin/permissions` (paginated permission catalog)
- Register all five operations in `x-implemented-operations`
- Enforce `@AuthAccess({ access: 'admin', permission: 'admin.roles.*', scope: 'store' })` on each route

**Non-Goals:**
- Admin user management (create/list/edit admins) — separate capability
- Changing seeded roles or permissions
- Frontend admin UI
- Platform-scoped (`scope: 'platform'`) operations — all endpoints are store-scoped

## Decisions

### 1. New `RolesModule` under `apps/api/src/roles/`
**Decision:** Follow the existing NestJS module pattern (`CatalogModule`, `InventoryModule`) — one module with controller and service.
**Rationale:** Consistent with the codebase; every admin feature is its own module registered in `AppModule`.
**Alternatives considered:** Adding roles endpoints to `AuthModule` — rejected because roles management is a distinct domain concern, not authentication.

### 2. Prisma for data access
**Decision:** Use `PrismaService` to query `adminRole`, `adminPermission`, `adminRolePermission` — same as all other API modules.
**Rationale:** The project standard is Prisma (per `openspec/config.yaml` rules); no TypeORM or other ORM is used.
**Alternatives considered:** Raw SQL via `pg` client — rejected; inconsistent with codebase patterns.

### 3. Permission key grants mapping
**Decision:** `RoleInput.permissionKeys` (array of strings) maps to `AdminRolePermission` join rows referencing `AdminPermission.key`. The `Role` response schema flattens `role.permissions[].permission.key` into a string array.
**Rationale:** Matches the existing `AdminRolePermission` join table and the `AdminResponse` pattern in `auth.service.ts` which maps `admin.role.permissions.map(({ permission }) => permission.key)`.
**Alternatives considered:** Storing permissions as a JSON array on the role — rejected; violates the normalized schema already in place.

### 4. System role protection
**Decision:** `DELETE /admin/roles/{roleId}` rejects deletion when `isSystem = true` or when any `AdminUser` references the role (`onDelete: Restrict` FK).
**Rationale:** Prevents accidental deletion of seeded roles and orphaned admin users. Matches the contract's "Delete a non-system role that is not in use."
**Alternatives considered:** Cascade delete — rejected; would remove admin users' roles, leaving them without authorization.

### 5. Pagination
**Decision:** Use `page` and `pageSize` query params with `PageMetadata` + items response shape, matching `RolePage` and `PermissionPage` schemas.
**Rationale:** Matches the OpenAPI contract and the pattern used by other list endpoints (`listMedia`, `listProducts`).
**Alternatives considered:** Cursor-based pagination — rejected; contract specifies page/pageSize.

## Risks / Trade-offs

[Deleting a role assigned to users] → Return 409 Conflict with a clear message; require admin to reassign or delete users first.

[Contract-check enforcement] → `scripts/contract-check.mjs` requires every implemented route to be declared in `x-implemented-operations` and vice versa. The OpenAPI contract must be updated alongside the implementation, or CI will fail.

[Permission name coupling] → The contract uses `admin.roles.*` permission keys while seed data uses `roles_read`/`roles_manage`. The `@AuthAccess` decorator references the contract permission strings (`admin.roles.read`, etc.), which are distinct from the Prisma permission keys. This is by design — the contract is the API boundary; seed keys are internal.

[Scopes] → All endpoints are `scope: 'store'`. The seeded owner role has all permissions; manager has `roles_read` only. No store-scoped role has `roles_create`/`roles_update`/`roles_delete` by default, so only the owner can manage roles initially.

## Migration Plan

1. Implement `apps/api/src/roles/` module (module, controller, service, schemas)
2. Register `RolesModule` in `apps/api/src/app.module.ts`
3. Add five operations to `x-implemented-operations` in `openapi.yaml`
4. Run `pnpm contract:check` to validate route/contract alignment
5. Run `pnpm --filter api typecheck` and `pnpm --filter api test`
6. Deploy: migrate not required (schema already exists); start API

Rollback: Remove `RolesModule` from `AppModule`, remove routes from `x-implemented-operations`, delete `apps/api/src/roles/`.

## Open Questions

None — all schemas, permissions, and seed data already exist; no unknowns that would change specs, approach, or task breakdown.
