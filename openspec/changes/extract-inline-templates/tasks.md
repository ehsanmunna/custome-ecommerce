# Tasks

## 1. Catalog Components

- [x] 1.1 Extract `catalog/product-list.component.ts` template (122 lines) to `product-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 1.2 Extract `catalog/category-list.component.ts` template (119 lines) to `category-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 1.3 Extract `catalog/media-list.component.ts` template (96 lines) to `media-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 1.4 Extract `catalog/attribute-list.component.ts` template (98 lines) to `attribute-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 1.5 Extract `catalog/brand-list.component.ts` template (105 lines) to `brand-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 1.6 Extract `catalog/variant-list.component.ts` template (51 lines) to `variant-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 2. CMS Components

- [x] 2.1 Extract `cms/page-list.component.ts` template (134 lines) to `page-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 2.2 Extract `cms/banner-list.component.ts` template (148 lines) to `banner-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 3. Inventory Components

- [x] 3.1 Extract `inventory/inventory-list.component.ts` template (48 lines) to `inventory-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 3.2 Extract `inventory/inventory-reservation.component.ts` template (80 lines) to `inventory-reservation.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 3.3 Extract `inventory/stock-movements.component.ts` template (44 lines) to `stock-movements.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 3.4 Extract `inventory/inventory-adjustment.component.ts` template (59 lines) to `inventory-adjustment.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 4. Orders & Returns Components

- [x] 4.1 Extract `orders/order-list.component.ts` template (58 lines) to `order-list.component.html` with `templateUrl` — verifies Order list compiles without async/await
- [x] 4.2 Extract `orders/order-status.component.ts` template (34 lines) to `order-status.component.html` with `templateUrl` — verifies Order status change uses Observable stream
- [x] 4.3 Extract `orders/order-detail.component.ts` template (90 lines) to `order-detail.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 4.4 Extract `returns/return-status.component.ts` template (35 lines) to `return-status.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 4.5 Extract `returns/return-list.component.ts` template (48 lines) to `return-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 5. Settings Components

- [x] 6.1 Extract `settings/shipping-zone-list.component.ts` template (103 lines) to `shipping-zone-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 6.2 Extract `settings/coupon-list.component.ts` template (137 lines) to `coupon-list.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 6. Reporting Components

- [x] 7.1 Extract `reporting/sales-metrics.component.ts` template (44 lines) to `sales-metrics.component.html` with `templateUrl` — verifies TypeScript compiles and template renders
- [x] 7.2 Extract `reporting/low-stock-indicators.component.ts` template (45 lines) to `low-stock-indicators.component.html` with `templateUrl` — verifies TypeScript compiles and template renders

## 7. Layout Components

- [x] 7.1 Extract `layout/shell/admin-shell.component.ts` template (30 lines) to `admin-shell.component.html` with `templateUrl`, and styles (56 lines) to `admin-shell.component.css` with `styleUrl` — verifies TypeScript compiles and layout renders
- [x] 7.2 Extract `layout/sidebar/sidebar.component.ts` template (15 lines) to `sidebar.component.html` with `templateUrl`, and styles (68 lines) to `sidebar.component.css` with `styleUrl` — verifies TypeScript compiles and layout renders
- [x] 7.3 Extract `layout/menu/menu.component.ts` template (39 lines) to `menu.component.html` with `templateUrl`, and styles (65 lines) to `menu.component.css` with `styleUrl` — verifies TypeScript compiles and layout renders
- [x] 7.4 Extract `layout/topbar/topbar.component.ts` template (122 lines) to `topbar.component.html` with `templateUrl`, and styles (314 lines) to `topbar.component.css` with `styleUrl` — verifies TypeScript compiles and layout renders

## 8. Auth Components

- [x] 8.1 Extract `auth/login.component.ts` template (64 lines) to `login.component.html` with `templateUrl` — verifies TypeScript compiles and login form renders
- [x] 8.2 Verify `auth/logout.component.ts` template (1 line) remains inline — verified as under 10-line threshold

## 9. Shared UI Components

- [x] 9.1 Extract `shared/ui/status-badge/status-badge.component.ts` template (12 lines) to `status-badge.component.html` with `templateUrl` — verifies TypeScript compiles and badge renders
- [x] 9.2 Extract `shared/ui/stat-card/stat-card.component.ts` template (59 lines) to `stat-card.component.html` with `templateUrl` — verifies TypeScript compiles and stat card renders
- [x] 9.3 Extract `shared/ui/data-table/data-table.component.ts` template (46 lines) to `data-table.component.html` with `templateUrl` — verifies TypeScript compiles and table renders

## 10. Theme Components

- [x] 10.1 Extract `theme/theme-toggle.component.ts` template (12 lines) to `theme-toggle.component.html` with `templateUrl`, and styles (33 lines) to `theme-toggle.component.css` with `styleUrl` — verifies TypeScript compiles and toggle renders

## 11. User/Customer Components

- [x] 11.1 Extract `customers/customers.component.ts` template (15 lines) to `customers.component.html` with `templateUrl` — verifies TypeScript compiles and customer list renders

## 12. Dashboard Components

- [x] 12.1 Extract `features/dashboard/dashboard.component.ts` template (76 lines) to `dashboard.component.html` with `templateUrl` — verifies TypeScript compiles and dashboard renders

## 13. Verification

- [x] 13.1 Run `pnpm --filter api build` — verifies no TypeScript errors
- [x] 13.2 Run `pnpm --filter admin build` — verifies no TypeScript errors
- [x] 13.3 Run `pnpm --filter admin lint` — verifies no lint errors
- [x] 13.4 Run `pnpm --filter admin test` — verifies existing tests pass
- [x] 13.4 Grep production code: zero matches for inline `template:` of 10+ lines — verifies no inline templates remain above threshold
- [x] 13.5 Grep production code: zero matches for inline `styles:` of 10+ lines — verifies no inline styles remain above threshold
- [x] 13.6 Manual check: navigate away from each list/form screen mid-request — confirms no console errors and no further network activity after navigation

## Workflow follow-up

- [x] Archive the change after review requirements are satisfied.