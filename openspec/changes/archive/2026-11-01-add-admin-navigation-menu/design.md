## Context

See proposal.md - Why. `apps/admin` is a standalone Angular 22 application. `AppComponent` currently renders only `<router-outlet>`, and all protected screens live as flat children of the guarded `''` route in `apps/admin/src/app.routes.ts`; `login` and `logout` are sibling routes outside the guard. Components are standalone and use Tailwind utility classes plus the CSS variables defined in `apps/admin/src/theme/theme.css`. There is no shell, sidebar, navigation model, or menu configuration today.

## Goals / Non-Goals

**Goals:**
- Make `app.routes.ts` the single source of truth for both routing and menu content.
- Keep menu derivation a pure, unit-testable function rather than component-embedded logic.
- Introduce the shell without changing existing route paths, guards, or screen components.

**Non-Goals:**
- Permission-based visibility, icons, collapsible/mobile behavior, or a redesigned visual system.
- Changing how authentication state or tokens are handled.

## Decisions

### Declare menu metadata on route definitions

Add an optional `data.menu` object to protected route definitions, typed as `{ label: string; group?: string }`. `data` is the Angular-native place for static route metadata and keeps menu information next to the path it describes. A separate menu list was rejected because it duplicates the route table and reintroduces the drift this change exists to remove.

Only routes that explicitly declare `data.menu` appear in the menu, so parameterized detail routes (`orders/:orderId`), redirects, wildcards, `login`, and `logout` are excluded without path-pattern heuristics.

### Derive the menu with a pure function over the route tree

Add a `buildAdminMenu(routes: Routes, parentPath = '')` helper that walks `Route.children`, composes full paths from parent segments, and returns ordered groups. Group order follows the first declaration of each `group`; entries within a group follow declaration order. Routes without a `group` form a leading ungrouped section. This runs once in the shell component and is tested directly, avoiding a menu service and its lifecycle.

The same helper will later accept a permission filter; keeping it pure lets the in-flight permission-aware navigation work extend it instead of rewriting it.

### Mount the shell as the component of the guarded parent route

Set `component: AdminShellComponent` on the existing guarded `''` route. Its template renders a persistent left sidebar built from `buildAdminMenu(routes)` and a `<router-outlet>`, so every protected child renders inside the shell. `login` and `logout` remain sibling routes and keep rendering full-page. Conditional layout logic in `AppComponent` was rejected because a layout route expresses the same intent declaratively and keeps `AppComponent` trivial.

### Use `routerLinkActive` for active indication

Render each entry as a `routerLink` with `routerLinkActive` and default (non-exact) matching, so a detail location such as `/orders/abc` activates the `/orders` entry. Prefix matching intentionally keeps an area highlighted while an operator is in one of its sub-screens; inputs without a matching menu entry (for example `/profile` if not exposed) simply leave no link active.

## Risks / Trade-offs

- [Menu metadata and route path can disagree] → Derive paths from `children`, never hand-type a path in menu data, and test that each generated entry navigates to a real route.
- [A new route is added without menu metadata and silently stays hidden] → Document the `data.menu` convention near `app.routes.ts` and cover derivation with a test asserting all menu-visible routes are included.
- [Duplicate labels or paths confuse operators] → Add a test asserting generated paths are unique.
- [Prefix matching over-highlights an entry] → Angular matches by URL segments, and grouping already nests sub-screens under their area, so this is acceptable; revisit only if a false positive appears.
- [Shell regression blocks all protected screens] → Keep existing screen components unchanged and add shell rendering tests for a protected route and for `login`.

## Migration Plan

1. Add menu metadata and the menu helper, with unit tests.
2. Add the shell component and attach it to the guarded parent route.
3. Verify `pnpm --filter admin test`, `pnpm --filter admin typecheck`, and `pnpm --filter admin build`.

Rollback is limited to removing the shell component reference from `app.routes.ts` and the `data.menu` values; no data or API migration is involved.
