# Proposal

## Why

The admin app's shell is only a fixed sidebar plus `<router-outlet>`, and the
Dashboard route is a placeholder. Store operators need a Sakai-style responsive
workspace and an at-a-glance operational dashboard. The admin also needs the
requested PrimeNG 21 + Tailwind v4 + Transloco stack and per-client branding so
one admin codebase can serve every client without forks.

## What Changes

- Reintroduce PrimeNG 21 (`@primeuix/themes`), PrimeIcons, Tailwind CSS v4 with
  `tailwindcss-primeui`, Chart.js, and Transloco, replacing the plain-CSS
  direction of the in-flight `remove-tailwind-and-primeng` change for this
  scope.
- Build a Sakai-style responsive shell: static and overlay collapsible sidebar,
  topbar with menu toggle, logo, language switcher, dark-mode toggle, and user
  menu, a masked mobile drawer, and a signal-based layout service.
- Replace the route-derived sidebar with a typed menu config array with
  role-based visibility. Keep existing working CRUD routes and add stubs for
  Customers and a Settings landing page.
- Load `client.config.json` in an app initializer, build the PrimeNG preset
  from `primaryColor`, apply the client name/logo, and persist dark mode and
  language per user.
- Harden auth: token interceptor, single-flight refresh, role guard, redirect
  on 401, and persisted session expiry.
- Add a lazy-loaded Dashboard page: four stat cards, a 7/30/90-day revenue
  chart, recent orders table, top-selling products, order-status doughnut, and
  low-stock alerts, each with loading, empty, and error states.
- Generate and consume typed OpenAPI clients. Correct the analytics response
  mismatches (Money returned as an object, sales returned as `{series}`) so the
  generated client matches the running API.
- Route all UI text through Transloco `en`/`bn` with a Bangla-capable font, and
  keep colors on theme/preset tokens rather than component hex values.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-console`: navigation becomes configuration-driven with role
  visibility; adds the Sakai-style responsive shell, startup client branding,
  per-user dark/language preferences, auth/401 handling, and runtime
  localization.
- `admin-dashboard-theme`: moves to PrimeNG 21 + Tailwind v4 +
  `tailwindcss-primeui`, CSS layer precedence, a runtime client preset,
  light/dark theming, and Bangla-capable typography.
- `admin-reporting`: adds the Dashboard overview widgets, 7/30/90-day revenue
  range, widget loading/empty/error states, and visibly marked sample-data
  widgets.

## Impact

- Affected code: `apps/admin` dependencies and build config, `src/core`,
  `src/layout`, `src/shared/ui`, `src/features/dashboard`, routes, i18n assets,
  and `client.config.json`; `apps/admin/src/styles.css` and PostCSS.
- Affected contract/tooling: regenerate `packages/api-sdk`; align the analytics
  API responses with `apps/api/openapi/openapi.yaml`.
- Affected APIs: existing admin analytics, orders, customers, inventory, and
  product-list operations only. No new endpoints or database changes.
- Mocks that remain: new-customer stat and its delta, top-selling products, and
  the low-stock delta (shown as unavailable rather than fabricated).
- Supersedes the shell/theme/Dashboard portions of the in-flight
  `add-admin-dashboard` change and reverses `remove-tailwind-and-primeng` for
  this scope; both should be reconciled before apply.

## Non-goals

- Rebuilding the existing CRUD screens beyond shell and menu integration.
- Adding backend endpoints, schema changes, or multi-store/platform admin.
- Storefront implementation or redesign.
- Server-side storage of user preferences.
- Copying Sakai demo pages or code without respecting its MIT license.
