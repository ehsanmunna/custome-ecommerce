# Design

## Context

See `proposal.md` for motivation and `specs/admin-roles/spec.md` for behavior.

Current state that shapes the approach:

- The API already exposes `GET/POST/PATCH/DELETE /admin/roles` and `GET /admin/permissions`, guarded by `admin.roles.read|create|update|delete` with `scope: 'store'`. `RolesService` rejects duplicate keys (409), invalid permission keys (400), system-role deletion (409), and deleting an assigned role (409).
- `Role` is `{ id, key, name, description?, scope, system, permissions[] }`. `Permission` is `{ id, key, description?, group, sortOrder }`. The permission catalog currently has 55 entries in 14 groups, and the API caps `pageSize` at 100.
- The admin app is Angular standalone with zoneless change detection, PrimeNG buttons, CSS-variable theming, Transloco, and `NotificationService`. List pages call `HttpClient` directly with `ADMIN_AUTH_CONFIG.apiBaseUrl` and a Bearer token. `AdminUsersListComponent` is the closest CRUD/list precedent, including its test pattern.
- `app.routes.ts` declares `data.roles`; `layout/menu/admin-menu.config.ts` is a second definition filtered by role key. `menu.service.spec.ts` asserts the two stay aligned.
- The project context calls for shared `PageHeader` and `ListToolbar` components, but neither exists; list pages currently hand-roll the breadcrumb/header/toolbar blocks.
- The durable `admin-console` spec says the menu is route-derived, while the implementation uses `ADMIN_MENU`. This change follows the implementation and records the drift rather than rewriting navigation.

## Goals / Non-Goals

**Goals:**

- A `/settings/roles` page that lists roles, supports search/type filtering, and opens create/edit forms with grouped permission selection.
- Permission-gated New/Edit/Delete actions, with owner and manager able to read the page.
- Shared `PageHeader` and `ListToolbar` components as the first consumers of the admin list layout rule.
- Consistent notifications and save-confirmation behavior with the admin users page.

**Non-Goals:**

- Changing API endpoints, OpenAPI, or database schema.
- Permission-based navigation guards (custom roles remain unreachable until a follow-up change).
- Migrating existing list pages to the new shared layout components.
- Editing the permission catalog or creating platform-scoped roles.
- Self-lockout, last-owner, or audit safeguards.

## Decisions

### 1. Route and access model

Add `settings/roles` to `app.routes.ts` with `data: { roles: MANAGER_ROLES }` and `canActivate: [roleGuard]`, and add a `roles` child under `settings` in `ADMIN_MENU` with the same role list. The seeded manager holds `admin.roles.read`, so the page is readable by owner and manager; staff and support are redirected to `/forbidden` by the existing guard. All mutations remain gated by `auth.hasPermission(...)` in the template.

Alternative: an owner-only route. Rejected because it would discard the manager's existing read permission and make the seeded matrix unrepresentable.

### 2. List page plus modal form, split into two components

Create `apps/admin/src/roles/admin-roles-list.component.ts` and `admin-role-form.component.ts`, mirroring `users/admin-users-list.component.ts` and its inline `AdminUserFormComponent`. The form is a modal, not a route: it keeps the list context, avoids another guarded route, and matches the users page. The permission body scrolls inside the modal, which is widened to roughly 720px.

Alternative: a dedicated `/settings/roles/:roleId` page. Rejected for this slice because it adds route data, breadcrumb state, and navigation tests without changing behavior.

### 3. Shared `PageHeader` and `ListToolbar`

Add `shared/ui/page-header/page-header.component.ts` and `shared/ui/list-toolbar/list-toolbar.component.ts`.

- `PageHeader` inputs: `title`, `breadcrumbs: Array<{ label: string; link?: string }>`; projects right-aligned actions via `<ng-content>`.
- `ListToolbar` projects filter/search controls into a flex row.

The roles page composes both in the required order: breadcrumb, header row, toolbar, table. Existing pages are not migrated here. This creates a temporary second layout implementation; the alternative (hand-rolling the blocks again) directly violates the project's list-layout rule.

### 4. API access and response typing

Use `HttpClient` directly, matching the users and settings pages, and type payloads from `api-sdk` (`components['schemas']['Role']`, `RoleInput`, `Permission`; `paths[...]` for page responses). Requests carry `Authorization: Bearer ${auth.token}`.

The generated `RolePage`/`PermissionPage` types describe top-level `total/page/pageSize/items`, but the running API returns `{ items, meta: { total, page, pageSize, totalPages } }` (the same drift already handled by the users page). Define a local `PageResponse<T>` that accepts `items` plus optional `meta` and top-level pagination, and read only `items` plus a normalized total (`meta?.total ?? total ?? items.length`). This keeps the page honest without changing the contract.

Load roles with `pageSize=100`. If the reported total exceeds the first page, request the remaining pages and concatenate. Load the permission catalog the same way; 55 entries fit in one request today, and the loop protects future growth. The catalog is loaded once per page view and reused by both create and edit forms.

### 5. Permission selection model

Because permission keys contain dots (`catalog.products.update`), a `FormGroup` keyed by permission key would make `get()` treat dots as paths. Use a `Set<string>` of selected keys bound to checkbox `(change)` handlers, grouped by `permission.group`, with group headings and a count. The form's validity check requires at least one selected key; the key and name use normal reactive controls.

Alternative: sanitize keys into safe control names. Rejected as needless mapping code.

### 6. Create/edit payloads and immutability

Create posts `{ key, name, description?, scope: 'store', permissionKeys }`. Edit patches only `{ name, description?, permissionKeys }`; key and scope are rendered read-only and never sent. This is stricter than the API (which allows partial key/scope updates) and avoids breaking any role-key references. Scope is fixed to `store` because every v1 admin endpoint requires store scope; a platform role would authenticate but fail every guarded route.

Validation mirrors the API: key matches `^[a-z][a-z0-9_.-]*$` and is at most 200 characters; name is required and at most 200; description is at most 2000; at least one permission must be selected. The form stays open on submit failure and keeps entered values.

### 7. System-role handling

System roles keep their key and scope, show a "system" badge, and have no Delete action. Their permission grants remain editable because that is the primary reason to open the page; an inline note states that changes apply on each affected user's next request. Preventing the owner role from losing role-management permissions is deferred to the safety-rails change.

### 8. Notifications and refresh ordering

Add `role: { create, update, delete, createFailed, updateFailed, deleteFailed }` to `NOTIFICATION_MESSAGES`. On success, close the form, call `notification.success(...)`, then refresh the list independently. A refresh failure sets an inline load error and does not replace the save confirmation or reopen the form, matching the users page.

Component error handlers own validation/business failures (400, 409). For global statuses (0, 401, 403, 5xx) the HTTP interceptor already notifies once, so the component only sets the inline error and does not emit a second toast. This follows the documented notification rule.

### 9. Route, menu, and translations

Add the route and menu entry together; the menu alignment test will fail if only one is updated. Add `menu.roles` to `assets/i18n/en.json` and `bn.json`. The form and table labels stay in English like the users page; translating them belongs to the dashboard's localization pass. Use the `pi pi-shield` icon for the menu entry.

### 10. Testing

Follow the existing vitest + `MockHttpClient` pattern:

- `admin-roles-list.component.spec.ts`: block order, row rendering, search/type filtering, permission-gated actions, create/edit/delete request payloads, delete conflict, save confirmation independent of a failing refresh.
- `admin-role-form.component.spec.ts`: key/name/description validation, permission grouping, preselection, empty selection blocked, catalog failure state.
- `menu.service.spec.ts` continues to assert route/menu role alignment; add an explicit roles-entry assertion if the existing table-driven test does not cover it.

## Risks / Trade-offs

- [Page contract drift between OpenAPI and runtime] → Read `items` and normalize totals; do not change the contract in this change.
- [Custom roles created here cannot navigate the UI] → Documented limitation; permission-based navigation is the follow-up change.
- [A system-role edit can remove `admin.roles.*` from the signed-in role] → Key/scope stay locked and the form warns that grants apply immediately; full lockout safeguards are deferred.
- [Cached permissions make edits appear late in the UI] → Server enforcement is immediate; the UI catches up on the next request or login. Identity refresh is a separate change.
- [Two menu definitions and an existing spec that calls the menu route-derived] → Update both definitions and rely on the alignment test; reconciling the architecture is out of scope.
- [Shared layout components have only one consumer] → Intentional first consumer; migrating the other pages is a later change, not a reason to duplicate markup now.
- [Permission catalog growth beyond one page] → Fetch remaining pages in a loop and merge by key.

## Migration Plan

UI-only change. Deploy the updated admin bundle; the API and database are unchanged. No data migration or feature flag is needed. Roll back by removing the route, menu entry, and new components.

## Open Questions

None that block the plan. Whether to migrate existing list pages onto `PageHeader`/`ListToolbar` is deferred to a separate change.
