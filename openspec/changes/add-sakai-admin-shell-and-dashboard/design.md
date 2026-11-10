# Design

## Context

See `proposal.md` - Why. The current admin is an Angular 21.2 standalone
application with no NgModules. `apps/admin/src/shell/admin-shell.component.ts`
renders a fixed sidebar and `<router-outlet>`; `features/dashboard` is a
placeholder. Navigation is derived from route metadata in
`apps/admin/src/navigation/admin-menu.ts`. Tailwind 3 and plain CSS coexist:
components still use Tailwind utility classes, while the theme layer uses
`--color-*` CSS variables. PrimeNG is not installed.

Authentication lives in `apps/admin/src/auth`: credentials are posted directly
with `HttpClient`, the access token and refresh token are persisted, but the
expiry and current user are memory-only, and there is no interceptor or 401
handling. `packages/api-sdk` already contains an OpenAPI-generated `paths` type
and an `openapi-fetch` wrapper, but the admin does not consume it.

The API contract at `apps/api/openapi/openapi.yaml` provides
`/admin/analytics/overview`, `/admin/analytics/sales`, `/admin/orders`,
`/admin/customers`, `/admin/inventory`, and `/admin/products`. The analytics
service currently returns Money as `{ amount, currency }` and sales as
`{ series }`, while the contract declares Money as integer poisha and the sales
response as an array. The dashboard must not build on that mismatch.

Sakai-NG (`primefaces/sakai-ng`, MIT) is the visual and structural reference.
Its v21 branch uses Angular 21, PrimeNG 21, `@primeuix/themes`, Tailwind 4, and
`tailwindcss-primeui`. We reuse the layout structure and interaction model, not
its demo pages or assets.

## Goals / Non-Goals

**Goals:**

- Deliver the shell and Dashboard page described by the three modified specs.
- Keep every existing admin screen reachable and visually functional.
- Make the API contract, generated types, and runtime responses agree.
- Keep client differences in configuration and one runtime preset.

**Non-Goals:**

- Rewriting the CRUD screens, their data flows, or their tests.
- New backend endpoints, database changes, or multi-store administration.
- A configurator for arbitrary theme presets or surfaces.
- Server-side preference storage or cross-device preference sync.

## Decisions

### PrimeNG 21, Tailwind 4, and explicit CSS layers

**Decision:** Add `primeng@21.1.x`, `@primeuix/themes@2.x`, `primeicons`,
`chart.js`, `tailwindcss@4.x`, `@tailwindcss/postcss`,
`tailwindcss-primeui`, `@jsverse/transloco`, and `@angular/cdk`. Remove the
Tailwind 3 `tailwind.config.js`, replace `postcss.config.js` with the
`@tailwindcss/postcss` plugin, and declare the layer order in `styles.css`:

```css
@layer theme, base, primeng, components, utilities;
@import "tailwindcss";
@plugin "tailwindcss-primeui";
```

PrimeNG is configured with `cssLayer: { name: 'primeng', order: 'theme, base,
primeng, components, utilities' }` and `darkModeSelector: '.app-dark'`. This
places PrimeNG before Tailwind utilities, so layout utilities can override
component styles without `!important`.

**Rationale:** This is the combination Sakai-NG v21 uses and is compatible with
the existing Angular 21.2 line. Explicit layers satisfy the override rule
without Tailwind selectors targeting PrimeNG internals.

**Alternatives considered:**

- Keep the plain-CSS direction from `remove-tailwind-and-primeng`: rejected by
  the accepted request; it would not provide the requested PrimeNG dashboard
  components.
- PrimeNG without Tailwind: rejected because the requested layout system and
  `tailwindcss-primeui` utilities would be lost.
- Tailwind 3: rejected; Tailwind 4 is the requested stack and the version
  Sakai-NG v21 targets.

The existing `--color-*` variables stay defined as aliases to PrimeNG tokens so
the already-written CRUD screens keep rendering while they are migrated later.

### Sakai-style layout with a signal-based layout service

**Decision:** Reproduce Sakai-NG's structure in our own folders:
`layout/shell`, `layout/sidebar`, `layout/topbar`, `layout/menu`, and
`layout/layout.service.ts`. `LayoutService` owns signals for
`layoutConfig` (`menuMode: 'static' | 'overlay'`, `darkTheme`) and
`layoutState` (`staticMenuDesktopInactive`, `overlayMenuActive`,
`mobileMenuActive`, `activePath`). A `BreakpointService` uses
`matchMedia('(min-width: 992px)')`. The shell applies
`layout-static`, `layout-overlay`, `layout-static-inactive`, and
`layout-mobile-active` classes, locks body scroll while the mobile drawer is
open, and closes the drawer on route change or outside click.

**Rationale:** Signals match the Angular 21 style and make the shell fully
OnPush. The class-based state mirrors Sakai-NG and keeps responsive behavior in
CSS where it belongs.

**Alternatives considered:**

- Keep the fixed sidebar: rejected; it cannot collapse or behave as a mobile
  drawer.
- Use `p-drawer` for the sidebar: rejected for desktop static mode; a custom
  shell gives the exact Sakai layout and avoids nested overlay behavior.

### Configuration-driven menu with role visibility

**Decision:** Replace `navigation/admin-menu.ts` with
`layout/menu/admin-menu.config.ts`: a typed array of entries containing
`id`, `labelKey`, `icon`, `routerLink`, `roles`, and optional `children`.
`MenuService` filters by `AuthService` role and exposes a computed tree. The
template renders that tree; it contains no route literals. The six top-level
entries are Dashboard, Products, Orders, Customers, Inventory, and Settings.
Products and Settings may carry children for existing category, brand, media,
shipping-zone, coupon, CMS, and report screens so existing work stays
discoverable.

Route definitions keep their paths and add `data: { roles: [...] }` for
`roleGuard`. A unit test asserts each menu entry's `roles` match the route's
`data.roles` so the two cannot drift.

**Rationale:** The menu is now a product configuration surface, and role rules
belong next to the label and icon. Existing screens remain reachable; only the
navigation source changes.

**Alternatives considered:**

- Keep route-derived navigation: rejected by the accepted request and unable to
  express translation keys and role visibility cleanly.
- Put role checks only in the template: rejected; a direct URL would bypass
  them.

### Client configuration and a runtime PrimeNG preset

**Decision:** `ClientConfigService` loads `/assets/client.config.json` during a
`provideAppInitializer` and validates
`{ name, logo?, primaryColor, defaultLanguage }`. Defaults are applied when the
file is missing or invalid. The app initializer then builds a preset with
`definePreset(Aura, { semantic: { primary: buildPalette(primaryColor) } })` and
registers it with `PrimeNG.setConfig({ theme: { preset, options: { ... } } })`.
`buildPalette` is a small pure utility in `core/theme/palette.ts`; it is the
only place a client hex color is converted to tokens.

**Rationale:** `PrimeNG` exposes `setConfig` in v21, so an app initializer can
apply the client preset before the first routed view renders. Keeping palette
generation pure makes it testable and keeps hex values out of components.

**Alternatives considered:**

- Load the config in `main.ts` before bootstrap: workable, but the request
  explicitly asks for an app initializer and initializers are easier to test.
- Use CSS variable overrides only: rejected; the PrimeNG preset would not carry
  the primary palette into charts, tags, and overlays consistently.

### Per-user preferences and localization

**Decision:** `PreferencesService` stores `{ darkMode, language }` under
`admin.prefs.<adminId>`. It applies `.app-dark` on `<html>` and calls
`TranslocoService.setActiveLang`. On sign-in it restores the user's entry; on
sign-out it falls back to client defaults. A one-time migration maps the old
`admin_theme=darks` value to the new format. Transloco loads
`/assets/i18n/en.json` and `/assets/i18n/bn.json`; a small bridge copies table,
paginator, and dialog labels into `PrimeNG.setTranslation` when the language
changes. Fonts are self-hosted with `@fontsource/inter` and
`@fontsource/hind-siliguri`, and the stack is applied through the PrimeNG preset
and the legacy `--font-family` alias.

**Rationale:** Per-user keys satisfy the persistence requirement without a
backend change. Transloco owns UI text; the PrimeNG bridge covers built-in
component labels so no English string leaks into the Bangla UI.

**Alternatives considered:**

- Store preferences per browser only: rejected; the requirement is per user.
- Translate only our own templates: rejected; empty-table and paginator labels
  would remain English.

### Typed API access through Angular `HttpClient`

**Decision:** Regenerate `packages/api-sdk` from the OpenAPI file, add it as an
admin workspace dependency, and create a thin `AdminApiService` over Angular
`HttpClient` typed with `paths` and `components['schemas']`. The service exposes
only the operations the shell and dashboard use. A functional
`authInterceptor` attaches the access token; on 401 it performs a single-flight
refresh (`shareReplay(1)`) and retries the original request once. A failed
refresh clears the session and redirects to `/login` with a return URL.
`roleGuard` reads the route's `data.roles`.

**Rationale:** Angular's interceptor pipeline gives one place for token and 401
behavior across every service. The existing `createApiClient` wrapper remains
available for non-Angular consumers, but using it here would bypass the
interceptor.

**Alternatives considered:**

- Use `openapi-fetch` directly: rejected for this change; its middleware would
  duplicate the refresh and redirect logic that the interceptor owns.
- Hand-write request/response interfaces: rejected; the generated contract is
  the requested source of truth.

**Contract alignment:** `apps/api/src/analytics/analytics.service.ts` will
return `Money` as integer poisha and `getSales` as a `SalesSeriesPoint[]` array.
The controller and tests are updated to the OpenAPI shape. This is a corrective
change to an operation whose contract already promised these shapes; it is not
a new endpoint.

### Dashboard store plus presentational widgets

**Decision:** `features/dashboard/dashboard.store.ts` owns all dashboard state
as signals of `AsyncState<T>`, where
`AsyncState<T> = { status: 'loading' | 'ready' | 'empty' | 'error'; data?: T; error?: string }`.
It loads independent widgets in parallel so one failure does not block the
others. `features/dashboard/dashboard.component.ts` is an OnPush page that
composes presentational widgets; widgets receive `input.required<AsyncState<T>>()`
and emit a retry output. Shared UI wrappers live in `shared/ui/stat-card`,
`shared/ui/status-badge`, and `shared/ui/data-table`.

**Rationale:** Keeping loading, empty, error, permission, and mapping logic in a
store keeps templates declarative and prevents duplicated request logic in six
widgets. Presentational widgets are independently testable.

**Alternatives considered:**

- Each widget injects the API and loads itself: rejected; shared range changes
  and one-failure isolation become harder to coordinate.
- Put state in the page component: rejected; the page would become the service
  the request explicitly says not to build.

### Real data, sample data, and the widget-to-endpoint map

| Widget | Source | Notes |
| --- | --- | --- |
| Orders today + delta | `GET /admin/analytics/overview` for today and yesterday | Two calls; day boundaries in Asia/Dhaka (`+06:00`). |
| Revenue today + delta | Same overview calls | Revenue is integer poisha. |
| New customers + delta | Sample data source | No date-filtered customer operation exists. |
| Low-stock count | `GET /admin/inventory?lowStock=true&pageSize=1` | Uses `total`. |
| Revenue chart | `GET /admin/analytics/sales?interval=day` | 7/30/90-day ranges; default 7. |
| Recent orders | `GET /admin/orders?pageSize=8` | API already returns newest first. |
| Top-selling products | Sample data source | No top-products aggregate exists. |
| Order status distribution | `GET /admin/orders?status=<status>&pageSize=1` per status | Eight parallel calls; reads `total`. Real, contract-backed. |
| Low-stock alerts | `GET /admin/inventory?lowStock=true&pageSize=5` + `GET /admin/products?pageSize=100` | Product names mapped by variant id; variant id/SKU fallback. |

`DashboardDataSource` is one interface. `HttpDashboardDataSource` implements the
real methods; `SampleDashboardDataSource` implements the two missing ones. The
composed `DashboardService` returns `{ data, isSample }` so widgets can show the
translated sample-data badge. Low-stock delta is `undefined`; the stat card
shows a translated "comparison unavailable" state rather than a fabricated
number.

**Rationale:** The user asked for mocks behind the same interface and clearly
marked. Returning `isSample` from the data layer keeps that decision out of
templates and makes it testable.

**Alternatives considered:**

- Derive top products from the first orders page: rejected; it would silently
  report partial data as complete.
- Add backend endpoints: rejected by the request and the planning boundary.

### Dashboard layout, charts, and states

**Decision:** The page uses a Tailwind grid: four stat cards in
`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`, then two-column rows on `xl` and a
single column below. Each widget uses `p-skeleton` while loading,
`p-message` plus a retry button on error, and a translated empty state. The
revenue chart uses `p-chart` (line) and the status widget uses `p-chart`
(doughnut). Chart colors are read at runtime from PrimeNG CSS variables such as
`--p-primary-500` and `--p-surface-200` through a `ChartThemeService`; no hex
values appear in component code.

**Rationale:** Tailwind handles layout only, while PrimeNG handles component
visuals. Reading chart colors from tokens keeps charts consistent with client
branding.

**Alternatives considered:**

- Hardcode chart colors: rejected by the no-hex rule and client branding.
- Use `p-card` for every widget shell: acceptable, but a shared card wrapper
  avoids six copies of the same header and state markup.

### Testing and verification

**Decision:** Add focused tests for the layout service, menu filtering,
client-config validation, auth interceptor refresh behavior, dashboard state
mapping, sample-data flags, and permission gating. Component tests that need a
DOM use a `// @vitest-environment jsdom` file header so the existing node-based
suite is unaffected. Verification runs `pnpm --filter api-sdk generate`,
`pnpm --filter api-sdk build`, `pnpm --filter admin typecheck`,
`pnpm --filter admin lint`, `pnpm --filter admin test`, and
`pnpm --filter admin exec ng build`. The existing `build` script stays as the
`tsc` package build; a new `build:app` script runs the Angular build.

**Rationale:** The current `build` script does not compile templates, so a
separate Angular build is required to catch template and stylesheet errors.

## Risks / Trade-offs

- **Reversing an in-flight decision** → `remove-tailwind-and-primeng` is still
  in progress and must be withdrawn or narrowed before this change applies.
  Record the supersession in review; do not merge both.
- **Dependency churn and bundle size** → Pin PrimeNG, themes, and CDK to the
  Angular 21-compatible line; measure the production bundle and keep lazy
  loading for the dashboard.
- **Tailwind 4 vs existing Tailwind 3 classes** → Reintroducing Tailwind 4 can
  change utilities used by existing CRUD screens. Keep the legacy `--color-*`
  aliases, run the Angular build, and smoke-test every existing route.
- **Analytics contract correction** → Returning integer Money and an array from
  sales is a behavior change for any current consumer. Only the admin consumes
  these operations today; add API tests and update the contract check in the
  same change.
- **Sample widgets mistaken for real data** → Every sample widget shows a
  translated badge and is listed in the implementation summary. The data layer
  returns `isSample`, not the template.
- **Low-stock product-name lookup** → `/admin/products` is capped at 100 rows,
  so a low-stock variant outside that page falls back to its variant id or SKU.
  A future contract operation can remove the fallback.
- **Eight status-count requests** → They are lightweight and parallel. If the
  store grows, add a contract-backed aggregate rather than adding a cache layer
  (the project forbids caching for now).
- **Fixed `+06:00` day boundary** → Correct for Bangladesh v1. If a client
  operates in another timezone, make the offset configuration before launch.

## Migration Plan

1. Add the new dependencies and Tailwind 4/PostCSS configuration; keep the
   legacy CSS aliases and run the Angular build before touching the shell.
2. Regenerate `api-sdk` and align the analytics API responses with the contract;
   run API contract tests.
3. Add core services (client config, preferences, i18n, auth interceptor,
   role guard) and their tests.
4. Replace the shell and navigation, add the stubs and settings landing page,
   then verify Part 1 with typecheck, lint, tests, and an Angular build.
5. Add the dashboard store, shared UI, widgets, and translations, then verify
   Part 2 with the same commands plus a route smoke test.
6. Roll back by restoring the previous `package.json`, PostCSS/Tailwind
   configuration, shell, routes, and auth files; the API analytics correction
   is independently revertible.

## Open Questions

None that affect the specs or task breakdown. Exact PrimeNG 21.1.x and
`@primeuix/themes` patch versions are pinned at apply time from the
Angular-21-compatible set.
