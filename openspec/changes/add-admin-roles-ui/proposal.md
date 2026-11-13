# Proposal

## Why

The API can create, edit, and delete admin roles and replace their permission grants (`/admin/roles`, `/admin/permissions`), but the dashboard has no screen for it. Operators must call the API directly to change what a role can do, so role permissions are effectively frozen at the seeded defaults. This is the missing half of admin user management: users can be assigned roles, but the roles themselves cannot be managed.

## What Changes

- Add a `/settings/roles` list page that follows the **admin list page layout rule**: breadcrumb, header row (title left, "New role" right), search/filter bar, then table. Reuse shared `PageHeader` and `ListToolbar` components.
- List roles with name, key, scope, system/custom type, permission count, and row actions.
- Create a role with key, name, description, store scope, and a grouped permission selection built from `GET /admin/permissions`.
- Edit a role's name, description, and permission grants. Key and scope are read-only after creation; system roles keep their key and scope.
- Delete a custom role that is not assigned to any admin user, after confirmation. System roles and in-use roles surface the API's 409 as an error notification.
- Gate New, Edit, and Delete on `admin.roles.create`, `admin.roles.update`, and `admin.roles.delete`. Owner and manager may open the page; the seeded manager is read-only.
- Add the `roles` menu entry under settings and `menu.roles` labels in English and Bangla.
- Add role success/failure messages to `NOTIFICATION_MESSAGES` and use `NotificationService` for every mutation.

## Capabilities

### New Capabilities

- `admin-roles`: Manage admin roles and permission grants from the dashboard: list, create, edit, delete, grouped permission selection, and permission-gated actions.

### Modified Capabilities

- None.

## Impact

- Admin UI: new shared `PageHeader`/`ListToolbar` components; new `settings/roles` route and menu entry; new roles list and form components; `app.routes.ts`, `admin-menu.config.ts`, en/bn translations, notification messages.
- API: none. Reuses the existing `admin/roles` and `admin/permissions` endpoints and their OpenAPI types.
- Database: none.
- Known limitation: navigation still gates on role keys, so a newly created custom role cannot reach any page until permission-based navigation lands. Permission edits for the four seeded roles take effect on each user's next request.

## Non-goals

- Switching route and menu gates from role keys to permissions.
- Assigning users to roles (handled by the existing user form).
- Creating or editing the permission catalog; permissions remain seed-defined.
- Platform-scoped roles; the UI creates store-scoped roles only.
- Self-lockout, last-owner, and audit-trail safety rails.
- Migrating existing list pages to the new shared layout components.
