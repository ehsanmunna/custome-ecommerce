# Tasks

## 1. API - permission setup

- [x] 1.1 Add `admin.users.read`, `admin.users.create`, `admin.users.update`, `admin.users.disable` permission keys to the permission set and verify the API compiles and the new permission keys resolve.
- [x] 1.2 Seed default `admin.users.*` permissions into `admin_permissions` and verify the seed script inserts them without error.

## 2. API - admin users controller and service

- [x] 2.1 Create `AdminUsersModule`, `AdminUsersController`, and `AdminUsersService` under `apps/api/src/admin-users` following NestJS module/controller/service conventions and verify the module loads in `app.module.ts`.
- [x] 2.2 Implement `GET admin/users` list endpoint with `@AuthAccess({ access: 'admin', permission: 'admin.users.read', scope: 'store' })` and verify it returns paginated admin users with role key, scope, and permissions.
- [x] 2.3 Implement `GET admin/users/:userId` endpoint with `@AuthAccess({ access: 'admin', permission: 'admin.users.read', scope: 'store' })` and verify it returns 404 for a missing user.
- [x] 2.4 Implement `POST admin/users` create endpoint with `@AuthAccess({ access: 'admin', permission: 'admin.users.create', scope: 'store' })` and verify it rejects duplicate email (409) and unknown role id (400).
- [x] 2.5 Implement `PATCH admin/users/:userId` update endpoint with `@AuthAccess({ access: 'admin', permission: 'admin.users.update', scope: 'store' })` and verify it updates display name, status, and role id.
- [x] 2.6 Implement `POST admin/users/:userId/disable` endpoint with `@AuthAccess({ access: 'admin', permission: 'admin.users.disable', scope: 'store' })` and verify it sets status to disabled and returns 204.
- [x] 2.7 Add API tests covering list, get, create, update, disable, and permission/scope enforcement and verify all tests pass.

## 3. Admin UI - routing, menu, and shell

- [x] 3.1 Add `/settings/users` route with `data: { roles: MANAGER_ROLES }` and `canActivate: [roleGuard]` in `app.routes.ts` and verify navigation resolves to the users page.
- [x] 3.2 Add `users` menu entry under `settings` in `admin-menu.config.ts` with `roles: MANAGER_ROLES` and verify it appears in the sidebar for owner/manager.
- [x] 3.3 Verify `authGuard` and `roleGuard` protect `/settings/users` and redirect unauthenticated or unauthorized users correctly.

## 4. Admin UI - user management components

- [x] 4.1 Create `AdminUsersListComponent` showing a paginated table of admin users (email, display name, status, role key, scope) and verify it renders data from the API.
- [x] 4.2 Create `AdminUserFormComponent` for create/edit with email, display name, role select, and status, wired to create/update endpoints and verify form submission succeeds.
- [x] 4.3 Add disable/enable status toggle action on the user list and verify it calls the disable endpoint when disabling and the update endpoint when enabling, then refreshes the list.
- [x] 4.4 Show success/error toasts via `NotificationService` for every create, update, disable, and enable and verify toasts appear on success and failure.
- [x] 4.5 Add UI tests for list, form, and toggle and verify they pass.

## 5. Integration verification

- [x] 5.1 Run the full API test suite and admin dashboard test suite and verify no regressions.
- [x] 5.2 Verify an operator with `manager` role can create, edit, and disable an admin user end-to-end through the UI.

## 6. Save confirmation and return to list

- [x] 6.1 Close the create/edit modal and show the success notification when the create or update succeeds, independently of the list reload; verify with `apps/admin/src/users/admin-users-list.component.spec.ts` covering a save whose refresh fails.
- [x] 6.2 Reload the users list after a successful save and verify the created or updated user is visible with current values; verify with the list component test.
- [x] 6.3 Keep the form open with entered values and show only an error notification when the save fails; verify with the list and form tests.
- [x] 6.4 Run `pnpm --filter admin exec vitest run src/users`; verify all admin users tests pass.

## 7. List row-action parity with Products

- [x] 7.1 Replace the users-list row action markup with the same button classes, spacing, and left-aligned Actions column used by the Products list; verify visually in the running dashboard and with the users-list test.
- [x] 7.2 Gate Edit and Enable on `admin.users.update` and Disable on `admin.users.disable` using the existing `AuthService.hasPermission`; verify with `admin-users-list.component.spec.ts` for permitted and denied operators.
- [x] 7.3 Add or update list component tests asserting the shared button classes, left-aligned Actions column, and permission-gated visibility for Edit, Enable, and Disable; verify with `pnpm --filter admin exec vitest run src/users/admin-users-list.component.spec.ts`.
- [x] 7.4 Run `pnpm --filter admin typecheck`; verify it passes.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
