# Proposal

## Why

The admin dashboard can authenticate users and authorize them by role, but there is no way for operators to create, edit, or disable admin users, or to assign them roles. Every admin user must be provisioned directly in the database. This blocks onboarding new staff, revoking access, and adjusting role assignments from the admin panel itself.

## What Changes

- Add `AdminUsersController` and `AdminUsersService` to the NestJS API under `admin/users` (list, get, create, update, disable/enable).
- Add admin-user CRUD screens to the Angular admin dashboard (list table, create/edit modal, status toggle). A successful create or update closes the form, shows a success notification, and returns the operator to the refreshed users list.
- Align the users-list row actions with the existing Products list pattern: permission-gated Edit and Disable/Enable buttons using the same Tailwind button treatment.
- Wire new endpoints through the existing `AuthenticationGuard` / `@AuthAccess` permission and scope checks.
- Reuse the existing `RolesService` and `AdminRole`/`AdminPermission` models for role assignment; no new database tables.

## Capabilities

### New Capabilities

- `admin-users`: Create, read, update, enable/disable admin users and assign each an existing role. Requires `admin.users.*` permissions and `store` scope checks.

### Modified Capabilities

- None.

## Impact

- API: new `admin/users` controller/service; extends `AuthAccess` permission set with `admin.users.read|create|update|disable`.
- Admin UI: new route `/settings/users` (manager role), new components, save success/error notifications with return to the refreshed list, row-action parity with the Products list, updates to `ADMIN_MENU` and `app.routes.ts`.
- Database: no schema changes; reuses `admin_users`, `admin_roles`, `admin_role_permissions`.

## Non-goals

- Customer (storefront) account management — that is a separate capability.
- Creating new roles or permissions — reuse existing `admin/roles` endpoints.
- Self-service password reset or profile editing for admin users beyond status/display name.
