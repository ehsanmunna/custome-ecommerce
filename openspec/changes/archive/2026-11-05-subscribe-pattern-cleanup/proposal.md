# Proposal

## Why

The admin Angular dashboard uses inconsistent HTTP patterns: many components call `await this.http.get<...>()` and `await this.http.post<...>()` directly with `async/await` and `.toPromise()`-style type assertions. This mixes Promise and Observable paradigms, scatters error handling, leaves subscriptions unmanaged, and lacks a consistent loading-state pattern. The refactor from Promises to Observables was incomplete — some methods still use `async` solely to await HTTP, `.subscribe()` calls lack `takeUntilDestroyed` teardown, and create/update/delete flows reload lists via separate await calls instead of switching within the same stream.

## What Changes

- Convert all HTTP calls in admin components from `async/await` with type assertions to `Observable`-returning calls consumed via `.subscribe()` with `takeUntilDestroyed(this.destroyRef)`
- Remove all `async`, `await`, `.then()`, `.catch()`, `toPromise()`, `firstValueFrom()`, and `lastValueFrom()` from HTTP-related code
- Ensure every service method returns `Observable<T>` and never calls `.subscribe()`
- Ensure every component `.subscribe()` includes an `error` handler and is cleaned up on destroy
- Replace nested subscribes with `switchMap` (dependent calls/reloads/search), `forkJoin` (parallel one-shot), `exhaustMap` (submit buttons), and `concatMap` (ordered writes)
- Set loading state to `true` before each request and `false` in `finalize()`, so loaders always stop including on error
- After create/update/delete, reload the list inside the same stream via `switchMap`, not via a separate nested subscribe
- Do not change UI, routes, or API contracts

## Capabilities

### New Capabilities

- `admin-http`: Consistent, leak-free Observable HTTP pattern for the admin dashboard. Defines that all admin HTTP calls return Observables, services never subscribe, components clean up subscriptions with `takeUntilDestroyed`, all subscribes have error handlers, loading states reset via `finalize()`, and list reloads happen inside the same stream via `switchMap` after create/update/delete.

### Modified Capabilities

None — no spec-level requirement changes to existing capabilities (`admin-console`, `admin-dashboard-theme`, `admin-reporting`, `admin-angular`). The change fixes implementation patterns without altering capability requirements.

## Impact

- Affected code: all admin component files under `apps/admin/src/` that make HTTP calls (catalog, CMS, inventory, orders, returns, settings, reporting, dashboard, auth, layout, primeng-translation)
- Shared/core services: `auth.service.ts` already returns Observables correctly; `dashboard.service.ts` still uses `firstValueFrom`/`async`/`await` and must be converted
- Tests: existing vitest specs use `async`/`await` and `toPromise` mocks; these may need updates to match the new pattern
- No changes to OpenAPI contracts, API endpoints, or database schema
