# Proposal

## Why

The admin app currently renders only a bare `<router-outlet>`, so the routes defined in `apps/admin/src/app.routes.ts` are reachable only by typing URLs. Administrators need a persistent menu that reflects the routes the application actually defines, without maintaining a second hand-written list that drifts from the router.

## What Changes

- Add menu metadata (`label`, optional `icon`, optional `group`, `showInMenu`) to the admin route definitions in `apps/admin/src/app.routes.ts`.
- Add a small navigation model/helper that walks the route tree and derives an ordered, grouped menu from that metadata, skipping routes that omit it (dynamic-parameter routes, login/logout, redirects).
- Add an authenticated shell layout with a persistent left sidebar plus `<router-outlet>`, and make the protected route subtree render inside it.
- Group entries as Dashboard, Catalog, Inventory, Orders, Returns, Settings, CMS, Reports, and Profile.
- Highlight the entry that matches the current route, including nested detail routes such as `/orders/:orderId`.
- Keep all entries visible for now; permission-based filtering remains with the broader dashboard work.
- Add unit tests for menu derivation, ordering/grouping, active-route matching, and rendering.

## Capabilities

### New Capabilities
- `admin-console`: Adds a route-derived navigation menu and authenticated shell to the existing admin console behavior.

### Modified Capabilities

None.

## Impact

- `apps/admin/src/app.routes.ts` gains menu metadata on protected routes.
- New shell/sidebar component, navigation model, and tests under `apps/admin/src`.
- `apps/admin/src/app.component.ts` renders the shell for authenticated routes while login/logout stay full-page.
- No API, database, or contract changes; no new dependencies.
- No permission filtering in this change; the existing `admin-console` permission-aware navigation requirement is unaffected and remains tracked by the in-flight dashboard change.

## Non-goals

- Permission-based menu hiding or role management screens.
- Mobile/collapsible sidebar behavior or redesign of existing screens.
- Changing route paths, guards, or authentication flow.
- Adding storefront or API navigation.
