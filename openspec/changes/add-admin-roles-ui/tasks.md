# Tasks

## 1. Shared list layout components

- [x] 1.1 Create `apps/admin/src/shared/ui/page-header/page-header.component.ts` with `title` and `breadcrumbs` inputs plus a projected actions area; verify with a component spec asserting breadcrumb order, title rendering, and projected action placement.
- [x] 1.2 Create `apps/admin/src/shared/ui/list-toolbar/list-toolbar.component.ts` that projects search and filter controls into one row; verify the component spec renders projected content inside the toolbar.

## 2. Roles list, filtering, and actions

- [x] 2.1 Add `apps/admin/src/roles/roles.models.ts` with api-sdk-based `Role`, `RoleInput`, and `Permission` types plus a `PageResponse<T>` helper that normalizes totals from `meta.total` or top-level `total`; verify with `roles.models.spec.ts` covering both response shapes.
- [x] 2.2 Implement `AdminRolesListComponent` to load roles and the permission catalog with `pageSize=100`, fetching remaining pages when the reported total is larger, and render name, key, scope, system/custom type, and permission count with loading and error states; verify with `admin-roles-list.component.spec.ts`.
- [x] 2.3 Compose the page from `PageHeader` (breadcrumb, title, "New role" action) and `ListToolbar` (search and type filter) above the table in the required block order, with no per-page breadcrumb, header, or toolbar markup; verify a spec asserting DOM order breadcrumb, header, toolbar, table.
- [x] 2.4 Add search by name or key and an all/system/custom type filter that narrows the rendered rows; verify both behaviors in `admin-roles-list.component.spec.ts`.
- [x] 2.5 Gate the "New role" action on `admin.roles.create`, Edit on `admin.roles.update`, and Delete on `admin.roles.delete`, and omit Delete for system roles; verify permitted and denied rendering in the list spec.
- [x] 2.6 Implement delete with a confirmation, `DELETE /admin/roles/{roleId}`, success notification, table refresh, and conflict handling that keeps the row and shows the API message; verify success, 409, and refresh behavior in the list spec.

## 3. Role create and edit form

- [x] 3.1 Implement `AdminRoleFormComponent` as a modal reactive form with key, name, optional description, and store scope, enforcing the API's key pattern and length limits; keep key and scope read-only in edit mode; verify with `admin-role-form.component.spec.ts`.
- [x] 3.2 Render the permission catalog grouped by `permission.group` with a checkbox per key, preselect the role's current grants, and block submit when no permission is selected; verify grouping, preselection, and empty-selection validation in the form spec.
- [x] 3.3 Surface a catalog load failure as an error notification with no permission checkboxes and a retry action; verify the failure and retry states in the form or list spec.
- [x] 3.4 Wire create and update to `POST /admin/roles` and `PATCH /admin/roles/{roleId}` with `permissionKeys`, close the form and show the success notification before refreshing, keep the form open with entered values on failure, and report a refresh failure separately; verify with list spec cases including a save whose refresh fails.
- [x] 3.5 Add `role.create|update|delete` and their failure messages to `NOTIFICATION_MESSAGES`; verify the list and form specs assert the success and error message constants.

## 4. Route, menu, and localization

- [x] 4.1 Add the `/settings/roles` route with `data: { roles: MANAGER_ROLES }` and a matching `roles` entry under `settings` in `admin-menu.config.ts`; verify the alignment assertion in `menu.service.spec.ts` passes.
- [x] 4.2 Add `menu.roles` to `assets/i18n/en.json` and `bn.json`; verify `i18n.spec.ts` reports identical non-empty keys in both catalogs.

## 5. Integration verification

- [x] 5.1 Run `pnpm --filter admin exec vitest run src/roles src/shared/ui src/layout/menu src/core/i18n` and verify all suites pass.
- [x] 5.2 Run `pnpm --filter admin typecheck` and `pnpm --filter admin build:app` and verify both succeed.
- [x] 5.3 Verify in the running dashboard that an owner can create, edit, and delete a custom role, a manager sees the list with no mutation controls, and staff is redirected to `/forbidden`.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
