# Permission matrix verification

Change: `permission-aware-admin-gating`
Date: 2026-11-17
Branch: `frontend-admin-role`

This record verifies the task 6.2 permission matrix for the seeded baseline roles
(owner, manager, staff, support) and a custom role, on both a freshly seeded
database and a drifted database reconciled by the permission-catalog migration.

## Evidence

| Command | Result |
| --- | --- |
| `cd apps/admin; npx vitest run src/permission-matrix.spec.ts` | 23 passed (23) |
| `pnpm --filter database test -- test/permission-matrix.spec.ts` | 3 passed (3) |
| `pnpm --filter admin test` | 272 passed (272) in 30 files before the matrix spec; matrix spec adds 23 |
| `pnpm --filter admin typecheck` | passed |
| `pnpm --filter database typecheck` | passed |
| `pnpm --filter admin lint` | passed |
| `pnpm --filter database lint` | passed |

The console matrix spec drives the real `permissionGuard`, `filterMenuByPermission`,
`DASHBOARD_WIDGETS`/`dashboardWidgetPermission`, and the route `data` metadata. The
database matrix spec seeds a real migrated PostgreSQL schema, then repeats the
assertions against a simulated legacy schema.

## Baseline grants

The owner holds every canonical permission. Manager, staff, and support hold the
following sets exactly (the seed is the source of truth; the console matrix spec
asserts the same sets).

| Role | Grants |
| --- | --- |
| owner | all 54 canonical keys |
| manager | `admin.auth.*`, every `catalog.`/`media.`/`inventory.`/`orders.`/`customers.`/`settings.`/`shipping.`/`promotions.`/`cms.`/`notifications.`/`analytics.` key, `orders_manage`, `admin.roles.read`, `image-storage.read` |
| staff | `admin.auth.*`, `catalog.brands.read`, `catalog.categories.read`, `catalog.products.read`, `image-storage.read`, `inventory.read`, `orders.read` |
| support | `admin.auth.*`, `orders.read`, `customers.read` |
| custom (`custom_support`) | whatever is granted explicitly; no baseline key is required |

Notable exclusions: manager cannot `admin.users.create`, `admin.users.disable`,
or `admin.roles.*` beyond `admin.roles.read`; staff cannot `media.create` or
`media.delete`; support cannot read media, catalog, or inventory.

## Route access

Allowed routes per role (direct navigation to any other protected route redirects
to `/forbidden`; the spec asserts the exact allowed and denied lists).

| Role | Allowed protected routes |
| --- | --- |
| owner | all protected routes: dashboard, customers, products, categories, brands, attributes, products/:productId/variants, media, inventory, inventory/adjust, inventory/reservations, inventory/movements, orders, orders/:orderId, orders/:orderId/status, returns, returns/:returnId/status, settings, settings/shipping-zones, settings/coupons, settings/users, settings/roles, cms/pages, cms/banners, reports/sales, reports/low-stock, profile |
| manager | same as owner except `settings/users` |
| staff | dashboard, products, categories, brands, attributes, products/:productId/variants, media, inventory, inventory/reservations, inventory/movements, orders, orders/:orderId, settings, reports/low-stock, profile |
| support | dashboard, customers, orders, orders/:orderId, profile |
| custom | dashboard, customers, media, orders, orders/:orderId, orders/:orderId/status, profile |

## Menu visibility

Menu entries are filtered by the same permission requirements, so a denied route
has no menu entry. Linked parents stay visible (the user's chosen behavior), so a
permitted child keeps its parent group in the sidebar.

| Role | Menu ids |
| --- | --- |
| owner | dashboard, products, categories, brands, attributes, media, orders, returns, customers, inventory, adjust-stock, reservations, stock-movements, settings, shipping-zones, coupons, users, roles, cms-pages, cms-banners, sales-report, low-stock-report |
| manager | same as owner except `users` |
| staff | dashboard, products, categories, brands, attributes, media, orders, inventory, reservations, stock-movements, settings, low-stock-report |
| support | dashboard, orders, customers |
| custom | dashboard, orders, customers |

Note: the media entry is nested under Products. A custom role that holds
`image-storage.read` but not `catalog.products.read` reaches `/media` by direct
navigation only; this is recorded in the spec as an accepted limitation.

## Dashboard widgets

Widgets are rendered only when the role holds the mapped permission:
orders/revenue stat cards, revenue chart, and top products need `analytics.read`;
new customers needs `customers.read`; recent orders and order status need
`orders.read`; low-stock count and alerts need `inventory.read`.

| Role | Widgets |
| --- | --- |
| owner, manager | orders, revenue, revenueChart, topProducts, newCustomers, recentOrders, orderStatus, lowStockCount, lowStockAlerts |
| staff | recentOrders, orderStatus, lowStockCount, lowStockAlerts |
| support, custom | newCustomers, recentOrders, orderStatus |

A role with no dashboard permission sees no widget and no dashboard error state.

## Action visibility

Writable actions are hidden without their API permission. The console matrix spec
asserts the visibility table for owner, manager, staff, support, and the custom
role across representative actions:

| Action permission | owner | manager | staff | support | custom |
| --- | --- | --- | --- | --- | --- |
| `admin.users.read` / `.create` / `.disable` | yes | no | no | no | no |
| `admin.roles.read` | yes | yes | no | no | no |
| `admin.roles.update` | yes | no | no | no | no |
| `catalog.products.update` / `catalog.categories.update` | yes | yes | no | no | no |
| `image-storage.read` | yes | yes | yes | no | yes |
| `media.create` / `media.delete` | yes | yes | no | no | no |
| `inventory.adjust` | yes | yes | no | no | no |
| `orders.status.update` | yes | yes | no | no | yes |
| `orders.returns.update` | yes | yes | no | no | no |
| `settings.update` | yes | yes | no | no | no |
| `shipping.zones.delete` | yes | yes | no | no | no |
| `promotions.coupons.create` | yes | yes | no | no | no |
| `cms.pages.delete` | yes | yes | no | no | no |
| `analytics.read` | yes | yes | no | no | no |

System-role key/name and self-disable are hidden independently of these grants
(covered by the administrator and role screen specs).

## Database verification

`packages/database/test/permission-matrix.spec.ts`:

1. **Fresh seed** — after `resetDatabase()` + `runMigrateCommand()` +
   `seedDatabase()`, the owner grant set equals the canonical catalog and the
   manager/staff/support sets equal the exact baseline sets above.
2. **Custom role** — a `custom_support` role keeps exactly its explicit grants and
   inherits no baseline grant.
3. **Drifted legacy database** — after seeding, the test re-adds the removed keys
   (`media.read`, `admin.users.delete`, `shipping.shipments.read`,
   `shipping.shipments.create`), grants them to the baseline and custom roles,
   grants legacy `media_read`/`media_manage`/`orders_change_status` to the custom
   role, and deletes `image-storage.read` grants from owner/manager/staff. It then
   runs `20261115000000_permission_catalog_reconciliation/migration.sql` and
   asserts:
   - the removed keys are deleted and `image-storage.read`/`admin.users.disable`
     are present;
   - owner/manager/staff regain `image-storage.read`, and only the owner gains
     `admin.users.disable`;
   - the custom role holds the translated `image-storage.read`, `media.create`,
     `media.delete`, `orders.read`, and `orders.status.update` grants while its
     legacy rows remain;
   - a subsequent `seedDatabase()` restores the exact baseline matrix and keeps
     the custom role's translated grants.

## Built application

`pnpm --filter admin build:app` completes and writes `apps/admin/dist/admin/browser`.
The bundle-budget warning (initial bundle over the default 500 kB budget) is
pre-existing and does not fail the build.

The build initially exposed an integration gap: the lazy `/dashboard` route still
pointed at the placeholder `src/dashboard/dashboard.component.ts`, so the gated
`features/dashboard` page was never rendered. The route now lazy-loads
`features/dashboard/dashboard.component.ts`, and `app.routes.spec.ts` asserts the
route resolves to that component.

The rebuilt bundle was served locally and driven with headless Chrome through the
DevTools protocol, seeding `localStorage` with a synthetic administrator snapshot
(no refresh token, expired-API calls only produce local widget errors). Checks:

| Snapshot | Navigation | Result |
| --- | --- | --- |
| `orders.read` | `/products` | renders the 403 forbidden page ("Access denied") |
| `orders.read` | `/orders` | sidebar shows Orders only; no Products, Settings, or Inventory links |
| `analytics.read` | `/dashboard` | renders "Orders today", "Revenue today", "Top-selling products"; no new-customer, low-stock, recent-order, or order-status widgets |
| `orders.read` | `/dashboard` | renders "Recent orders" and "Order status"; no analytics stat cards, new-customer, or low-stock widgets |

All four built-app checks passed.

## Scope notes

- `pnpm test` still reports 30 pre-existing failures in unmodified API and
  database specs; task 6.1 records them as baseline/out of scope. The new matrix
  specs pass on their own.
- General settings has no console update form, so `settings.update` is enforced by
  the API only and has no action to gate in the console.
- `src/dashboard/dashboard.component.ts` is now an unreferenced placeholder left
  by an earlier change; it is not deleted here because it belongs to the
  `add-sakai-admin-shell-and-dashboard` work.
