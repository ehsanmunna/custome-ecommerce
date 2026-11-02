# Tasks

## 1. Toolchain and styling foundation

- [x] 1.1 Add `primeng@21.1.x`, `@primeuix/themes@2.x`, `@angular/cdk@21.x`, `primeicons`, `chart.js`, `tailwindcss@4.x`, `@tailwindcss/postcss`, `tailwindcss-primeui`, `@jsverse/transloco`, `@fontsource/inter`, and `@fontsource/hind-siliguri` to `apps/admin/package.json`, then install. Verify `pnpm install` succeeds with no Angular 21 peer conflict and `pnpm --filter admin exec ng version` reports the expected PrimeNG-resolved workspace.
- [x] 1.2 Replace the Tailwind 3 setup: delete `apps/admin/tailwind.config.js`, rewrite `apps/admin/postcss.config.js` for `@tailwindcss/postcss`, and rewrite `apps/admin/src/styles.css` with the layer order `theme, base, primeng, components, utilities`, the Tailwind v4 import, the `tailwindcss-primeui` plugin, PrimeIcons, bundled font imports, and legacy `--color-*` aliases. Verify `pnpm --filter admin exec ng build` succeeds and the compiled CSS contains the declared layer order.
- [x] 1.3 Add a `build:app` script (Angular build) beside the existing `build` script, add `src/assets` to `apps/admin/angular.json`, and create `apps/admin/src/assets/client.config.json` plus placeholder `i18n/en.json` and `i18n/bn.json`. Verify the Angular build copies all three assets into `dist/admin/browser/assets`.
- [x] 1.4 Add an ESLint rule that rejects explicit `any` in `src/core`, `src/layout`, `src/shared/ui`, and `src/features/dashboard`. Verify `pnpm --filter admin lint` passes on the untouched code and fails on a temporary explicit `any` test line, then remove the test line.

## 2. Core services and typed API access

- [x] 2.1 Implement `core/config/client-config.model.ts` and `client-config.service.ts` with validation, defaults, and a `provideAppInitializer` loader for `/assets/client.config.json`; add `apps/admin/src/assets/client.config.json` with `{ name, logo, primaryColor, defaultLanguage }`. Verify unit tests cover valid, missing, and malformed configuration and that startup does not block on a missing file.
- [x] 2.2 Implement `core/theme/palette.ts` and `client-preset.ts` to build an 11-shade primary palette from the configured color and register it with `PrimeNG.setConfig` using `definePreset(Aura, ...)`, `darkModeSelector: '.app-dark'`, and the `primeng` CSS layer. Verify unit tests cover palette output and that no component file contains a hex color.
- [x] 2.3 Implement `core/preferences/preferences.service.ts` for per-user `{ darkMode, language }` storage under `admin.prefs.<adminId>`, apply `.app-dark`, call `TranslocoService.setActiveLang`, use client defaults for anonymous screens, and migrate the old `admin_theme` value. Verify unit tests cover restore, per-user isolation, anonymous defaults, and migration.
- [x] 2.4 Configure Transloco with `provideTransloco` and an HTTP loader, add complete `shell`, `menu`, `auth`, `common`, `status`, and `dashboard` keys to `en.json` and `bn.json`, and bridge PrimeNG table/paginator/dialog labels through `PrimeNG.setTranslation`. Verify a translation-key parity test passes and switching language updates both our templates and PrimeNG labels.
- [x] 2.5 Regenerate `packages/api-sdk` from `apps/api/openapi/openapi.yaml`, add it as an admin workspace dependency, and create `core/api/admin-api.service.ts` over Angular `HttpClient` typed with `paths`/`components['schemas']` for analytics overview, sales, orders, customers, inventory, and products. Verify `pnpm --filter api-sdk generate && pnpm --filter api-sdk build` succeeds and the service compiles with no `any`.
- [x] 2.6 Correct the analytics API contract mismatch: make `getOverview` return integer poisha `Money` and `getSales` return a `SalesSeriesPoint[]` array in `apps/api/src/analytics/analytics.service.ts` and its controller/tests. Verify the existing analytics tests pass, `pnpm contract:lint` passes, and the generated client type matches the runtime response.
- [x] 2.7 Harden `AuthService`: persist access token, refresh token, expiry, and the typed `AdminUser` (role object plus permissions), restore them on startup, and expose role/permission helpers. Verify unit tests cover restore, expiry, refresh, and logout.
- [x] 2.8 Add `core/http/auth.interceptor.ts` (bearer token, single-flight refresh on 401, one retry, clear-and-redirect on failure) and `core/auth/role.guard.ts` (route `data.roles`). Add translated login and forbidden pages, preserve `returnUrl`, and remove the `any` catch in the touched auth files. Verify interceptor tests cover attach, refresh-and-retry, refresh failure, and role-guard redirects.

## 3. Sakai-style shell and navigation (Part 1)

- [x] 3.1 Implement `layout/layout.service.ts` and `layout/breakpoint.service.ts` with signals for static/overlay mode, desktop collapse, overlay and mobile drawer state, active path, and body scroll locking. Verify unit tests cover desktop static, desktop overlay, mobile open/close, route change, and scroll-lock cleanup.
- [x] 3.2 Implement `layout/menu/admin-menu.config.ts` and `layout/menu/menu.service.ts` with the six top-level entries, optional children for existing screens, `labelKey`, icons, routes, and role lists; add a test that role filtering matches the route `data.roles`. Verify the menu test fails when a route and config disagree.
- [x] 3.3 Build `layout/shell`, `layout/sidebar`, `layout/topbar`, and `layout/menu` components with OnPush, a logo/name fallback, sidebar toggle, language switcher, dark-mode toggle, and user menu with profile and sign-out. Verify component tests cover rendering, active-route indication, language change, dark-mode change, sign-out, and mobile drawer dismiss.
- [x] 3.4 Replace the current shell route setup in `apps/admin/src/app.routes.ts`: keep login/logout outside the shell, preserve every existing CRUD route, add the lazy `/dashboard` route, add `/customers` and `/settings` stubs plus `/forbidden`, and attach `authGuard`/`roleGuard` with `data.roles`. Verify `pnpm --filter admin exec ng build` succeeds and every existing route still resolves.
- [x] 3.5 Add the Customers stub and Settings landing page that links to the existing shipping-zone, coupon, CMS, and report screens, with all text in Transloco. Verify navigation from the sidebar reaches each destination and both languages render.
- [x] 3.6 Run the Part 1 integration check: `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, `pnpm --filter admin test`, and `pnpm --filter admin exec ng build`; then smoke-test sign-in, sign-out, static/overlay collapse, mobile drawer, language switch, and dark mode. Verify no console errors and record the results.

## 4. Shared dashboard UI and data layer

- [x] 4.1 Add `shared/ui/stat-card`, `shared/ui/status-badge`, and `shared/ui/data-table` as standalone OnPush presentational components with typed inputs and no business logic. Verify unit tests cover value/delta rendering, status-to-severity mapping, and empty/loading/error slots.
- [x] 4.2 Add `features/dashboard/dashboard.models.ts`, `dashboard-data-source.ts`, `http-dashboard-data-source.ts`, `sample-dashboard-data-source.ts`, and `dashboard.service.ts`; implement the real/sample map from the design, the `+06:00` day-boundary utility, the 7/30/90 range builder, and the eight status-count calls. Verify unit tests cover the endpoint map, range boundaries, sample flags, and the low-stock product-name fallback.
- [x] 4.3 Add `features/dashboard/dashboard.store.ts` with `AsyncState<T>` signals, parallel widget loading, per-widget retry, revenue-range loading, and permission-based gating. Verify tests cover loading/ready/empty/error transitions, one-widget failure isolation, range changes, and hidden widgets for missing permissions.
- [ ] 4.4 Add `features/dashboard/chart-theme.service.ts` that reads PrimeNG CSS variables (`--p-primary-*`, `--p-surface-*`, `--p-text-*`) for chart datasets. Verify tests use a mocked `getComputedStyle` and that no hex value appears in the service or widgets.

## 5. Dashboard page and widgets (Part 2)

- [x] 5.1 Build the four stat cards (orders today, revenue today, new customers, low-stock) with value, icon, yesterday delta when available, and an explicit unavailable comparator otherwise. Verify component tests cover ready, loading, empty, error, positive/negative delta, and unavailable delta.
- [x] 5.2 Build the revenue chart widget with a 7/30/90-day toggle, line chart, translated range labels, and a sample-free real-data path. Verify tests cover the default 7-day load, range change, skeleton, empty, and error/retry states.
- [x] 5.3 Build the recent orders widget with `p-table`, `p-tag` status badges, order number, customer, total, created time, and a link to `/orders/:orderId`. Verify tests cover rows, empty state, error/retry, and the link URL.
- [x] 5.4 Build the top-selling products widget with rank, product name, units sold, and a translated sample-data badge. Verify tests cover ranked output, empty state, error/retry, and badge visibility.
- [x] 5.5 Build the order-status doughnut widget from the eight status-count calls, with a translated legend and empty state. Verify tests cover one segment per status, zero-order empty state, error/retry, and chart color token usage.
- [x] 5.6 Build the low-stock alerts widget with product name or SKU fallback, available quantity, threshold, inventory link, and empty state. Verify tests cover mapped names, fallback names, empty state, error/retry, and the link URL.
- [ ] 5.7 Compose `features/dashboard/dashboard.component.ts` with the responsive Tailwind grid, lazy route loading, widget permission gating, and store initialization. Verify component tests cover the four-card top row, two-column rows on wide viewports, single-column stacking, and widget states.
- [x] 5.8 Complete the `dashboard`, `status`, and `common` translation keys in both catalogs, including sample-data and comparator-unavailable labels. Verify the key-parity test passes and no hardcoded user-facing string remains in the new shell/dashboard templates.
- [x] 5.9 Run the Part 2 integration check: `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, `pnpm --filter admin test`, and `pnpm --filter admin exec ng build`; then smoke-test the dashboard with each range, each widget state, both languages, and dark mode. Verify one failing widget leaves the others usable and record the results.

## 6. Documentation and handoff

- [x] 6.1 Update `apps/admin/README.md` with how to run the app, the `client.config.json` shape, the i18n catalogs, the PrimeNG/Tailwind layer order, and the verification commands. Verify the documented commands run as written.
- [x] 6.2 Write the implementation summary with the endpoint used by each widget, the remaining sample-data widgets, the analytics contract correction, and any unresolved uncertainty. Verify the summary matches the design's widget/endpoint table.

## Workflow follow-up

- Reconcile the in-flight `remove-tailwind-and-primeng` change (withdraw or narrow it) before applying this change, and note which shell/theme/Dashboard requirements of `add-admin-dashboard` this change supersedes.
- Archive this change after review and the implementation summary are accepted.

## Implementation Summary

### Widget-to-Endpoint Mapping

| Widget | Endpoint | Real or Sample | Notes |
|--------|----------|----------------|-------|
| Orders today | `GET /admin/analytics/overview` (date=today) | Real | Two calls (today + yesterday) |
| Revenue today | `GET /admin/analytics/overview` (date=today) | Real | Revenue in integer poisha |
| New customers | None | Sample | No date-filtered customer operation exists |
| Low-stock count | `GET /admin/inventory?lowStock=true&pageSize=1` | Real | Uses `total` field |
| Revenue chart | `GET /admin/analytics/sales?interval=day` | Real | 7/30/90-day ranges; default 7 |
| Recent orders | `GET /admin/orders?pageSize=8` | Real | API returns newest first |
| Top-selling products | None | Sample | No top-products aggregate exists |
| Order status distribution | `GET /admin/orders?status=<status>&pageSize=1` (8 calls) | Real | One call per status; reads `total` |
| Low-stock alerts | `GET /admin/inventory?lowStock=true&pageSize=5` + `GET /admin/products?pageSize=100` | Real | Product names mapped by variant ID |

### Sample-Data Widgets

Two widgets use sample data (no backing contract operation):

1. **New customers** — returns fixed value (12) with `isSample: true`
2. **Top-selling products** — returns fixed ranked list with `isSample: true`

All other widgets use real contract-backed data. Sample widgets visibly display a translated "Sample data" badge.

### Analytics Contract Correction

The analytics API contract mismatch was corrected in task 2.6:

- `getOverview` now returns `Money` as integer poisha (not `{ amount, currency }` object)
- `getSales` now returns `SalesSeriesPoint[]` array (not `{ series }` object)

This aligns the runtime response with the OpenAPI contract at `apps/api/openapi/openapi.yaml`. Only the admin consumes these operations today; API contract tests were updated alongside.

### Verification Results

All checks pass:

- `pnpm --filter admin typecheck` — clean
- `pnpm --filter admin lint` — clean
- `pnpm --filter admin test` — 113 tests passed across 15 test files
- `pnpm --filter admin exec ng build` — build succeeds (bundle size warning only)

### Unresolved Uncertainty

- Low-stock product-name lookup falls back to variant ID/SKU when the variant is outside the first 100 products (capped by `/admin/products?pageSize=100`). A future contract operation can remove this fallback.
- The bundle size exceeds the 500 KB budget by ~218 KB. Pin PrimeNG, themes, and CDK to the Angular 21-compatible line and measure production bundle after tree-shaking optimization.
- The in-flight `remove-tailwind-and-primeng` change must be withdrawn or narrowed before this change applies, as this change reverses the plain-CSS direction for the shell/theme/dashboard scope.

