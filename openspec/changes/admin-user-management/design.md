# Design

## Context

The API already has `AdminUser`, `AdminRole`, `AdminPermission`, and `AdminRolePermission` models plus a working `RolesService`/`RolesController` at `admin/roles` and `admin/permissions`. Admin authentication exists via `AdminAuthController` at `admin/auth/{login,refresh,logout,me}`. The global `AuthenticationGuard` enforces `@AuthAccess({ access: 'admin', permission, scope })` on every admin endpoint. The admin dashboard is Angular with standalone components, route guards (`authGuard`, `roleGuard`), and a role-driven menu in `admin-menu.config.ts`. No admin-user CRUD controller, service, or UI exists today.

## Goals / Non-Goals

**Goals:**
- Add `admin/users` API endpoints: list, get, create, update, disable/enable.
- Add admin-user CRUD UI in the dashboard under `/settings/users`.
- Reuse existing `AdminRole`/`AdminPermission` models for role assignment; no new tables.
- Enforce access via existing `@AuthAccess` permission + `store` scope checks.
- Confirm create/update with a success notification and return the operator to the refreshed users list.
- Make the users-list row actions visually and behaviorally consistent with the Products list.

**Non-Goals:**
- Creating or editing roles/permissions (handled by `admin/roles` endpoints).
- Customer account management.
- Admin self-service profile editing beyond what exists.

## Decisions

- **API path `admin/users`**: Matches the existing `admin/roles` controller pattern (`@Controller('admin')` with sub-routes `roles`, `permissions`). NestJS module/controller/service conventions; Prisma for data access.
- **Permissions `admin.users.read|create|update|disable`**: Added to the permission set enforced by `AuthenticationGuard`. Each endpoint declares the matching permission and `scope: 'store'`.
- **Disable instead of hard delete**: Preserve audit references (order status history, return status history reference `admin_users.id`); soft-disable via `status = disabled` and reject logins for disabled users.
- **Angular route `/settings/users`**: Placed under `settings` with `MANAGER_ROLES` (`owner`, `manager`), consistent with other settings routes.
- **Reuse `AuthService`/`AdminUser` types**: Frontend `AuthService` already types `AdminUser` from `api-sdk`; the `me` endpoint returns role + permissions.
- **Save confirmation is independent of the list refresh**: close the create/edit modal and show the success toast as soon as the create or update request succeeds, then reload the list. A failed reload surfaces a separate load error and does not replace the save confirmation or reopen the form. The save has already committed; conflating refresh failure with save failure misleads operators and invites duplicate submissions.
- **Return to the list is modal dismissal**: because create/edit is a modal on `/settings/users`, returning to the list means closing the modal and leaving the refreshed list visible; no route change is needed. On failure, the modal stays open and retains the entered values.
- **Row actions reuse the Products list pattern**: render plain buttons with the same Tailwind utility classes, spacing, and left-aligned Actions column as `product-list.component.html` (primary Edit, danger Disable/Enable). Gate the Edit and Enable row actions with `auth.hasPermission('admin.users.update')` and the Disable row action with `auth.hasPermission('admin.users.disable')`. Status changes through the edit form remain governed by `admin.users.update` and are unchanged by this scope. Do not keep the custom `btn btn-sm` classes — they are used only on this page and have no definition — and do not add new global CSS. This scope covers row actions only; the Add administrator control is unchanged.

## Risks / Trade-offs

- [Disabled admin user still owns history rows] → `onDelete: Restrict` on `AdminUser` relations prevents orphaned history; disable (not delete) avoids referential issues.
- [Role scope mismatch] → `AuthenticationGuard` already checks `role.scope === requirement.scope`; `store`-scoped roles cannot perform `platform`-scoped ops and vice versa.
- [No existing UI components for user forms] → New standalone components needed; follow existing `CustomersComponent`/settings component patterns and PrimeNG toast notifications per `admin-notifications` rules.
- [Save confirmation coupled to refresh] → Show the success notification from the mutation result and refresh separately; cover a failing refresh in the users-list tests.
- [Action styling can regress silently] → Assert the expected button classes and permission-gated visibility in the users-list component test.
- [Status permissions overlap] → `admin.users.update` can change status through the edit form while the dedicated Disable action requires `admin.users.disable`; each row action is gated by the permission its endpoint requires.
