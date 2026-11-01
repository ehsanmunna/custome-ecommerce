# Tasks

## 1. Shared CSS foundation

- [ ] 1.1 Add the shared semantic class layer (`.page`, `.page-title`, `.toolbar`, `.card`, `.modal`, `.modal-backdrop`, `.btn`, `.btn-primary`, `.btn-danger`, `.btn-link`, `.input`, `.select`, `.label`, `.error-text`, `.muted`, `.table`, `.badge`, `.form-field`) to the global admin stylesheet, backed by the existing `var(--color-*)`, spacing, and typography tokens; verify `pnpm --filter admin exec ng build` succeeds and the classes appear in the emitted CSS.
- [ ] 1.2 Confirm `src/theme/theme.css` is the only place that defines theme token values, delete the unused `src/theme/tokens.ts`, and verify `pnpm --filter admin typecheck` and `pnpm --filter admin lint` pass with no remaining imports of `tokens.ts`.
- [ ] 1.3 Document the shared class layer and the `theme.css` token source in `apps/admin/README.md`; verify the documented build/run commands still match `apps/admin/package.json`.

## 2. Convert auth, dashboard, and profile screens

- [ ] 2.1 Replace Tailwind utilities in `auth/login.component.ts`, `auth/logout.component.ts`, and `dashboard/dashboard.component.ts` with shared classes; verify `pnpm --filter admin typecheck`, `lint`, and `test` pass and no Tailwind utility tokens remain in those files.
- [ ] 2.2 Convert `profile/profile.component.ts` from its inline `styles` block to the shared classes while keeping the logout behavior; verify `pnpm --filter admin test` passes and the profile route renders the same fields and sign-out action.
- [ ] 2.3 Smoke-test the login, logout, dashboard, and profile routes with `pnpm --filter admin start:dev`; verify layout, buttons, and error text match the pre-change screens.

## 3. Convert catalog screens

- [ ] 3.1 Convert `catalog/product-list.component.ts` and `catalog/category-list.component.ts`, including their tables, toolbars, forms, modals, and action buttons; verify `pnpm --filter admin exec ng build` succeeds and no Tailwind utility tokens remain in either file.
- [ ] 3.2 Convert `catalog/brand-list.component.ts`, `catalog/attribute-list.component.ts`, `catalog/variant-list.component.ts`, and `catalog/media-list.component.ts`; verify `pnpm --filter admin typecheck` and `lint` pass and no Tailwind utility tokens remain in those files.
- [ ] 3.3 Run the existing catalog component tests and smoke-test the product, category, brand, attribute, variant, and media routes; verify search, create/edit modals, and delete actions still render and behave as before.

## 4. Convert inventory screens

- [ ] 4.1 Convert `inventory/inventory-list.component.ts`, `inventory/inventory-adjustment.component.ts`, `inventory/inventory-reservation.component.ts`, and `inventory/stock-movements.component.ts`; verify `pnpm --filter admin typecheck` and `lint` pass and no Tailwind utility tokens remain in those files.
- [ ] 4.2 Smoke-test the inventory list, adjustment, reservation, and stock-movement routes; verify forms, tables, filters, and low-stock indicators retain their layout.

## 5. Convert orders and returns screens

- [ ] 5.1 Convert `orders/order-list.component.ts`, `orders/order-detail.component.ts`, and `orders/order-status.component.ts`; verify `pnpm --filter admin test` passes and no Tailwind utility tokens remain in those files.
- [ ] 5.2 Convert `returns/return-list.component.ts` and `returns/return-status.component.ts`; verify `pnpm --filter admin typecheck` and `lint` pass and no Tailwind utility tokens remain in those files.
- [ ] 5.3 Smoke-test the order list, order detail, order status, return list, and return status routes; verify status controls and action buttons render and behave as before.

## 6. Convert settings, CMS, and reporting screens

- [ ] 6.1 Convert `settings/shipping-zone-list.component.ts` and `settings/coupon-list.component.ts`; verify `pnpm --filter admin test` passes and no Tailwind utility tokens remain in those files.
- [ ] 6.2 Convert `cms/page-list.component.ts` and `cms/banner-list.component.ts`; verify `pnpm --filter admin typecheck` and `lint` pass and no Tailwind utility tokens remain in those files.
- [ ] 6.3 Convert `reporting/sales-metrics.component.ts` and `reporting/low-stock-indicators.component.ts`; verify `pnpm --filter admin test` passes and no Tailwind utility tokens remain in those files.
- [ ] 6.4 Smoke-test the settings, CMS, and reporting routes; verify tables, filters, date inputs, and KPI displays retain their layout.

## 7. Remove the frameworks and tooling

- [ ] 7.1 Remove the `@tailwind`, `@tailwind components`, and `@tailwind utilities` directives from `apps/admin/src/styles.css`, delete `apps/admin/tailwind.config.js` and `apps/admin/postcss.config.js`, and verify `pnpm --filter admin exec ng build` succeeds.
- [ ] 7.2 Remove `tailwindcss`, `postcss`, `autoprefixer`, and `primeng` from `apps/admin/package.json`; run `pnpm install` and verify the `apps/admin` importer in `pnpm-lock.yaml` no longer lists them (residual optional peer entries elsewhere are acceptable).
- [ ] 7.3 Search `apps/admin` and `docs` for `@tailwind`, `tailwindcss`, `postcss`, `autoprefixer`, and `primeng`; verify no source, config, or documentation references remain outside archived change artifacts and this change's own artifacts.

## 8. Integration verification

- [ ] 8.1 Run `pnpm --filter admin typecheck`, `pnpm --filter admin lint`, `pnpm --filter admin test`, `pnpm --filter admin build`, and `pnpm --filter admin exec ng build`; verify all five commands succeed.
- [ ] 8.2 Walk every route in `apps/admin/src/app.routes.ts` on `pnpm --filter admin start:dev`; verify each screen renders without missing styles and that tables, forms, modals, and action buttons remain usable.
- [ ] 8.3 Verify theming is unchanged: set `admin_theme` in `localStorage` to `light`, `dark`, and `client-branded`, reload each time, and confirm the corresponding `<html>` class and token values apply without a page-level flash or layout break.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived `admin-dashboard-theme` spec no longer contains the PrimeNG requirement and no longer names Tailwind.
