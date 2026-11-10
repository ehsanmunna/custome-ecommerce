# Tasks

## 1. Theme infrastructure

- [x] 1.1 Add Tailwind CSS + PostCSS to `apps/admin`; verify `pnpm --filter admin build` and `pnpm --filter admin typecheck` pass
- [x] 1.2 Add PrimeNG compatible with Angular 22 (`@angular/core: ^22.2.3`) + theme preset; verify `pnpm --filter admin build` passes
- [x] 1.3 Create theme token module (colors, spacing, typography, borders, shadows); wire into `tailwind.config.js` and PrimeNG preset
- [x] 1.4 Add theme toggle component (light / dark / client-branded) with `localStorage` persistence; verify `pnpm --filter admin typecheck` passes

## 2. Component migration

- [x] 2.1 Migrate dashboard shell (navbar, layout wrapper) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.2 Migrate login/logout screens to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.3 Migrate catalog screens (product, category, brand, attribute, variant, media) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.4 Migrate inventory screens (list, adjustment, reservation, stock movements) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.5 Migrate orders screens (list, detail, status) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.6 Migrate settings screens (shipping zones, coupons) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.7 Migrate CMS screens (pages, banners) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.8 Migrate reporting screens (sales metrics, low-stock indicators) to Tailwind utility classes; verify `pnpm --filter admin lint` passes
- [x] 2.9 Migrate returns screens (list, status) to Tailwind utility classes; verify `pnpm --filter admin lint` passes

## 3. Verification

- [x] 3.1 Run `pnpm --filter admin build` and confirm zero errors
- [x] 3.2 Run `pnpm --filter admin lint` and fix any lint errors in migrated screens
- [x] 3.3 Run `pnpm --filter admin typecheck` and confirm zero errors
- [x] 3.4 Run `pnpm --filter admin test` and confirm all 64 tests pass
- [x] 3.5 Verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass
- [x] 3.6 Verify theme toggle component exists and uses CSS classes for theming (light/dark/client-branded via `html.dark` / `html.client-branded`)

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
