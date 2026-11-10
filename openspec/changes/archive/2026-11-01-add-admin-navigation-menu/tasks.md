# Tasks

## 1. Route-derived menu model

- [x] 1.1 Add an `AdminMenuData` type (`label`, optional `group`) and a pure `buildAdminMenu(routes, parentPath)` helper under `apps/admin/src/navigation/` that walks route children, composes full paths, excludes routes without menu metadata, and returns ungrouped entries followed by groups in first-declaration order.
- [x] 1.2 Add `data.menu` metadata to the protected routes in `apps/admin/src/app.routes.ts`: Dashboard; Catalog (products, categories, brands, attributes, media); Inventory (inventory, adjust, reservations, movements); Orders; Returns; Settings (shipping-zones, coupons); CMS (pages, banners); Reports (sales, low-stock); Profile.
- [x] 1.3 Leave parameterized and non-workspace routes (`products/:productId/variants`, `orders/:orderId`, `orders/:orderId/status`, `returns/:returnId/status`, `login`, `logout`, redirects, wildcard) without menu metadata, and document the `data.menu` convention next to the route table.
- [x] 1.4 Add unit tests covering inclusion/exclusion, full path composition, grouping and declaration order, ungrouped-first ordering, and unique generated paths.

## 2. Workspace shell and active navigation

- [x] 2.1 Add a standalone `AdminShellComponent` with a persistent left sidebar (rendering `buildAdminMenu(routes)` with section headings and `routerLink` entries) and a `<router-outlet>` for routed content, styled with the existing theme CSS variables.
- [x] 2.2 Use `routerLinkActive` (non-exact) on sidebar links so nested detail locations highlight their parent area, and confirm locations without a menu entry leave no link active.
- [x] 2.3 Attach `AdminShellComponent` as the component of the guarded `''` parent route so all protected children render inside the shell while `login` and `logout` remain full-page.
- [x] 2.4 Add component tests for menu rendering from route config, a protected route rendering inside the shell, `login` rendering without the shell, and active state for exact and nested locations.

## 3. Verification

- [x] 3.1 Run `pnpm --filter admin test`, `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, and `pnpm --filter admin build`; fix any failures.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
