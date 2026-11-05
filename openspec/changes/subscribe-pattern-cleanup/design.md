# Design

## Context

The admin Angular app (`apps/admin`) is an Angular 21 standalone application using RxJS 7, PrimeNG 21, Tailwind 4, and `@angular/cdk`. The Prisma-generated API SDK (`packages/api-sdk`) provides typed `components` and `paths` types. The admin already has an `AdminApiService` over Angular `HttpClient` and an `authInterceptor` that attaches tokens and handles 401 refresh with `shareReplay(1)`. The `auth.service.ts` already returns `Observable<T>` correctly.

Current state: Many admin components make HTTP calls via `async/await` with `.toPromise()`-style type assertions (`await this.http.get<...>(...)` cast `as unknown as Type`). The `dashboard.service.ts` uses `firstValueFrom()` extensively and `Promise.all`. Some components (`primeng-translation.ts`) already use `.subscribe()` with `destroyRef.onDestroy()` for teardown; `admin-shell.component.ts` already uses `takeUntilDestroyed(this.destroyRef)`. No services currently subscribe. No nested subscribes exist.

## Goals / Non-Goals

**Goals:**
- Convert all component HTTP calls from `async/await` with type assertions to `Observable`-returning calls consumed via `.subscribe()` with `takeUntilDestroyed(this.destroyRef)` as the last operator before `subscribe`
- Convert `dashboard.service.ts` from `firstValueFrom`/`async`/`await` to pure Observable-returning methods
- Convert `dashboard.store.ts` `load()` from `async`/`await` to Observable subscription
- Convert `primeng-translation.ts` `.subscribe()` to `takeUntilDestroyed` pattern
- Ensure every `.subscribe()` has an `error` handler
- Set loading state to `true` before each request and `false` in `finalize()`
- Reload lists inside the same stream via `switchMap` after create/update/delete
- Keep UI, routes, and API contracts unchanged

**Non-Goals:**
- Rewriting existing CRUD screen logic or UI
- Adding new backend endpoints or API changes
- Changing the OpenAPI contract
- Modifying `auth.service.ts` (already correct)
- Modifying `auth.interceptor.ts` (already correct)

## Decisions

### Type assertion on awaited Observable (`as unknown as T`)
**Decision:** In Angular 21, `await this.http.get<...>()` works at runtime because Observables are thenable, but TypeScript does not infer `T` from `await Observable<T>`. Cast with `as unknown as T` after `await` to satisfy type-checking without `firstValueFrom`.

**Rationale:** Angular 21 supports awaiting HttpClient Observables at runtime. The type assertion preserves runtime behavior while satisfying TypeScript. No new library dependency or build change is needed.

**Alternatives considered:**
- `firstValueFrom(this.http.get<...>())`: Rejected — this is banned by the acceptance criteria ("no firstValueFrom on HTTP calls").
- `await this.http.get<...>()` without cast: Rejected — TypeScript types `res` as `Observable<T>`, not `T`, causing property access errors.

### TakeUntilDestroyed as last operator before subscribe
**Decision:** Every component `.subscribe()` is preceded by `.pipe(takeUntilDestroyed(this.destroyRef))`. `destroyRef` is injected via `inject(DestroyRef)` at class level.

**Rationale:** Angular 21 supports `takeUntilDestroyed()` with no argument when injected in constructor or field initializer. This guarantees teardown on component destroy without manual `Subscription` fields or `ngOnDestroy` unsubscribe code.

### switchMap for dependent calls and list reloads
**Decision:** After a successful create/update/delete, reload the list inside the same stream via `switchMap(() => this.service.getAll())` rather than a separate `await this.load()` call.

**Rationale:** `switchMap` cancels stale requests and keeps the stream linear. A separate `await this.load()` after `await this.save()` reintroduces Promise-style sequencing and nested async handling.

### ExhaustMap for submit buttons
**Decision:** Submit buttons use `exhaustMap` to prevent double submission while a request is in flight.

**Rationale:** Prevents duplicate create/update requests from rapid clicks.

### AsyncState signals in dashboard store
**Decision:** `DashboardStore.load()` converts to Observable subscription. The `DashboardWidgetState` remains `AsyncState<T>` signals (`loading`/`ready`/`empty`/`error`). Widgets consume signals via `input.required<AsyncState<T>>()`.

**Rationale:** Keeps templates declarative and prevents duplicated request logic across widgets. The store converts Observable results to signal state.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Type assertion `as unknown as T` bypasses type checking | Keep types precise on the Observable generic (`<CategoryPage>`) so the assertion is intentional and narrow |
| Missing error handler on some subscribe | Grep verification ensures every subscribe has `error` callback |
| Lists not refreshed after create/update/delete | Task list explicitly covers create/update/delete reload via switchMap |
| `firstValueFrom` still in dashboard.service.ts | Dashboard service fully converted to Observable returns |
| Test files use `async`/`await` and `toPromise` mocks | Test files are out of scope for the grep acceptance criteria (production code only) |
| Angular 21 `takeUntilDestroyed()` with no argument requires field/constructor injection | `destroyRef` is injected at field level via `inject(DestroyRef)` |

## Migration Plan

1. Convert `auth/login.component.ts` `onSubmit()` to `.subscribe()` + `takeUntilDestroyed`
2. Convert `auth/logout.component.ts` `ngOnInit()` to `.subscribe()` + `takeUntilDestroyed`
3. Convert all catalog components (product-list, category-list, brand-list, attribute-list, media-list, variant-list) load/create/update/delete methods
4. Convert all CMS components (page-list, banner-list) load/create/update/delete methods
5. Convert all inventory components (inventory-list, stock-movements, inventory-reservation, inventory-adjustment) methods
6. Convert all orders components (order-list, order-status, order-detail) methods
7. Convert all returns components (return-status, return-list) methods
8. Convert all settings components (shipping-zone-list, coupon-list) methods
9. Convert all reporting components (sales-metrics, low-stock-indicators) methods
10. Convert `dashboard.service.ts` from `firstValueFrom`/`async`/`await` to Observable returns
11. Convert `dashboard.store.ts` `load()` from `async`/`await` to Observable subscription
12. Convert `primeng-translation.ts` `.subscribe()` to `takeUntilDestroyed`
13. Verify `ng build`, `lint`, `typecheck`, and `test` pass
14. Manual check: navigate away mid-request on each screen, confirm no console errors and no further network activity

## Open Questions

None that affect the specs or task breakdown.
