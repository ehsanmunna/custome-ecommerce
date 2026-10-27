# Tasks

## 1. Module scaffolding

- [x] 1.1 Create `apps/api/src/roles/roles.module.ts` with RolesModule class and verify the file compiles as a NestJS module
- [x] 1.2 Register `RolesModule` in `apps/api/src/app.module.ts` imports and verify `pnpm --filter api typecheck` passes

## 2. Service layer

- [x] 2.1 Create `apps/api/src/roles/roles.service.ts` with `listRoles(page, pageSize)` querying `adminRole` with `adminRolePermission` include and verify it returns roles with permission keys
- [x] 2.2 Implement `createRole(input)` in `roles.service.ts` creating `AdminRole` + `AdminRolePermission` join rows in a transaction and verify it returns the created role
- [x] 2.3 Implement `updateRole(roleId, input)` in `roles.service.ts` updating role fields and replacing permission grants and verify it returns the updated role
- [x] 2.4 Implement `deleteRole(roleId)` in `roles.service.ts` rejecting system roles and roles with assigned users and verify it returns void on success
- [x] 2.5 Implement `listPermissions(page, pageSize)` in `roles.service.ts` querying `adminPermission` and verify it returns permissions with group and sort order

## 3. Controller layer

- [x] 3.1 Create `apps/api/src/roles/roles.controller.ts` with `GET /admin/roles` using `@AuthAccess({ access: 'admin', permission: 'admin.roles.read', scope: 'store' })` and verify the route responds with a RolePage
- [x] 3.2 Add `POST /admin/roles` using `@AuthAccess({ access: 'admin', permission: 'admin.roles.create', scope: 'store' })` and verify it returns 201 with the created Role
- [x] 3.3 Add `PATCH /admin/roles/{roleId}` using `@AuthAccess({ access: 'admin', permission: 'admin.roles.update', scope: 'store' })` and verify it returns 200 with the updated Role
- [x] 3.4 Add `DELETE /admin/roles/{roleId}` using `@AuthAccess({ access: 'admin', permission: 'admin.roles.delete', scope: 'store' })` and verify it returns 204
- [x] 3.5 Add `GET /admin/permissions` using `@AuthAccess({ access: 'admin', permission: 'admin.roles.read', scope: 'store' })` and verify it returns a PermissionPage

## 4. OpenAPI contract

- [x] 4.1 Add the five roles/permissions operations to `x-implemented-operations` in `apps/api/openapi/openapi.yaml` and verify `pnpm contract:check` passes

## 5. Verification

- [x] 5.1 Run `pnpm --filter api typecheck` and verify no type errors
- [x] 5.2 Run `pnpm --filter api test` and verify all tests pass
- [x] 5.3 Run `pnpm db:status` and verify migrations are applied and schema is in sync

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
