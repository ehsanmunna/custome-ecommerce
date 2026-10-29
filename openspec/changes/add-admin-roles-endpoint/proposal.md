# Proposal

## Why

The `admin_role` table is seeded with four roles (owner, manager, staff, support), but there is no API to read, create, update, or delete roles. The OpenAPI contract already defines `/admin/roles` and `/admin/roles/{roleId}` endpoints plus `Role`, `RoleInput`, and `RolePage` schemas, yet none are listed in `x-implemented-operations`. Without these endpoints, administrators cannot manage the role-based access control that governs every other admin operation.

## What Changes

- Add `GET /admin/roles` — paginated list of roles with their permission grants
- Add `POST /admin/roles` — create a role with permission key grants
- Add `PATCH /admin/roles/{roleId}` — update a role and its permission grants
- Add `DELETE /admin/roles/{roleId}` — delete a non-system role not in use
- Add `GET /admin/permissions` — paginated permission catalog
- Register all five operations in `x-implemented-operations`
- Create `apps/api/src/roles/` module with controller, service, and schemas

## Capabilities

### New Capabilities

- `admin-roles`: Admin role and permission management — create, read, update, delete roles; assign permission grants; list the permission catalog

### Modified Capabilities

(None — no existing spec capabilities)

## Impact

- New module `apps/api/src/roles/` following NestJS conventions (module, controller, service)
- Prisma queries against `adminRole`, `adminPermission`, `adminRolePermission` tables
- `@AuthAccess` guard enforces `admin.roles.read`, `admin.roles.create`, `admin.roles.update`, `admin.roles.delete` with `scope: 'store'`
- OpenAPI contract updated: five operations added to `x-implemented-operations`
- System roles (owner, manager, staff, support) protected from deletion via `isSystem` flag
- Roles assigned to existing admins cannot be deleted (`onDelete: Restrict` on `AdminUser.roleId`)

## Non-goals

- Creating or editing admin users (covered by a separate admin-users capability)
- Changing the seeded role set or default permissions
- Frontend admin UI for role management
- Platform-scoped roles (`scope: 'platform'`) — all endpoints are store-scoped

## Open decisions

None — all contract schemas, permissions, and seed data already exist.
