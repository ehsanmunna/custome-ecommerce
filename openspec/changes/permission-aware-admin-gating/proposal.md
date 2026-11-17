# Proposal

## Why

The admin UI still gates routes, menu entries, and many buttons by fixed role names (`owner`, `manager`, `staff`, `support`), while the API authorizes each endpoint by permission. A store that creates a custom role can sign in but cannot open any dashboard area, and pages without client checks only surface the limit as a 403 after the operator has acted. The seeded permission catalog has also drifted from the API contract: a fresh seed omits `image-storage.read` and the running database lacks `admin.users.disable`, so media and administrator management break even for the owner.

## What Changes

- Replace role-key route and menu filtering plus `roleGuard` with permission-based access derived from each route's required permission.
- Gate page actions on catalog, media, inventory, orders and returns, settings, CMS, users, and roles screens with `hasPermission`.
- Gate dashboard widgets by permission so unauthorized widgets are hidden or marked restricted and do not request protected APIs.
- Refresh the client permission snapshot from `/auth/me` so role edits take effect without a new sign-in, and protect system roles and administrators from self-lockout.
- Reconcile the permission catalog across API contract, seed, and database: add `image-storage.read`, reinstate `admin.users.disable`, resolve dead keys, and align role-key validation with the database constraint.
- Make reseeding and the accompanying migration idempotent for existing installations while preserving custom-role grants.

This change introduces no new admin list page. Every affected screen keeps the admin list page layout rule: breadcrumb, header row with title left and "New" action right, search/filter bar, then table.

## Capabilities

### New Capabilities

- `admin-authorization`: canonical permission catalog, baseline system-role grants, permission reconciliation on reseed, and the shared role-key contract.

### Modified Capabilities

- `admin-console`: permission-derived route access, permission-filtered navigation, permission-gated page actions, permission snapshot refresh, and protected role operations.
- `admin-reporting`: dashboard widget permission gating.

## Non-goals

- Changing the backend authentication model, token storage, or session refresh flow.
- Adding domain API endpoints or breaking existing `/v1` contracts.
- Building a separate permission-administration screen beyond the existing roles page.
- Reworking storefront authorization or customer-facing access.

## Impact

- Admin application: `apps/admin/src/app.routes.ts`, `core/auth/role.guard.ts`, `layout/menu/*`, `auth/auth.service.ts`, the dashboard store and widgets, and the affected list and detail templates.
- API and data: `packages/database/src/seed.ts`, a data migration for missing permission catalog entries and grants, role-key validation, and OpenAPI permission declarations. No new domain endpoints.
- Tests and docs: menu-route alignment, guard and auth snapshot, seed and contract reconciliation, page action, and dashboard widget permission tests.
