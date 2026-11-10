# Observable HTTP Leak Fix - Tasks

## Priority 1: Convert Services to Return Observables

### Auth Service (`apps/admin/src/auth/auth.service.ts`)
- [ ] Replace `login()`: Remove `.toPromise()`, return `Observable<AuthSession>`; callers use `async pipe` or `takeUntilDestroyed`
- [ ] Replace `refresh()`: Remove `.toPromise()`, return `Observable<AuthSession>`; interceptor handles subscription
- [ ] Replace `me()`: Remove `.toPromise()`, return `Observable<AdminUser>`; callers use `async pipe`
- [ ] Replace `logout()`: Remove `.toPromise()`, return `Observable<void>`; callers subscribe with `takeUntilDestroyed`

### Http Dashboard Data Source (`apps/admin/src/features/dashboard/http-dashboard-data-source.ts`)
- [ ] `getOverviewToday()`: Remove `.toPromise()`, return `Observable<{orderCount:number, revenue:number}>`
- [ ] `getOverviewYesterday()`: Remove `.toPromise()`, return `Observable<{orderCount:number, revenue:number}>`
- [ ] `getSales(range)`: Remove `.toPromise()`, return `Observable<RevenuePoint[]>`
- [ ] `getRecentOrders(limit)`: Remove `.toPromise()`, return `Observable<RecentOrder[]>`
- [ ] `getLowStockCount()`: Remove `.toPromise()`, return `Observable<number>`
- [ ] `getOrderStatusCounts()`: Remove `.toPromise()`, return `Observable<OrderStatusCount[]>`
- [ ] `getLowStockAlerts(limit)`: Remove `.toPromise()`, return `Observable<LowStockAlert[]>`
- [ ] `getNewCustomers()`: Change to return `Observable<number>` (or keep as abstract throw)
- [ ] `getTopSellingProducts()`: Change to return `Observable<TopProduct[]>` (or keep as abstract throw)

### Admin API Service (`apps/admin/src/core/api/admin-api.service.ts`)
- All methods already return `Observable<T>` - verify no `.toPromise()` conversions exist (they don't, good!)

## Priority 2: Components - Replace `.toPromise()` with `async pipe` or `takeUntilDestroyed`

### Catalog Components (convert Http Observables, use `async pipe` in templates)
- [ ] `apps/admin/src/catalog/product-list.component.ts` - convert 6 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/catalog/category-list.component.ts` - convert 4 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/catalog/brand-list.component.ts` - convert 4 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/catalog/media-list.component.ts` - convert 4 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/catalog/attribute-list.component.ts` - convert 3 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/catalog/variant-list.component.ts` - convert 6 `.toPromise()` calls to Observables; use `async pipe` in template

### CMS Components
- [ ] `apps/admin/src/cms/page-list.component.ts` - convert 4 `.toPromise()` calls to Observables; use `async pipe` in template
- [ ] `apps/admin/src/cms/banner-list.component.ts` - convert 4 `.toPromise()` calls to Observables; use `async pipe` in template

### Inventory Components
- [ ] `apps/admin/src/inventory/stock-movements.component.ts` - convert `.toPromise()` to Observable; use `async pipe`
- [ ] `apps/admin/src/inventory/inventory-reservation.component.ts` - convert 2 `.toPromise()` calls to Observables; use `async pipe`
- [ ] `apps/admin/src/inventory/inventory-list.component.ts` - check for `.toPromise()` calls, convert if present

### Other Components
- [ ] `apps/admin/src/auth/login.component.ts` - check for HTTP subscribe/patterns
- [ ] `apps/admin/src/auth/logout.component.ts` - check for HTTP subscribe/patterns

## Priority 3: Remove `.toPromise()` from Components (specific calls)

### CMS Page List (`apps/admin/src/cms/page-list.component.ts`)
- [ ] Line 234: Remove `.toPromise()`, convert to Observable subscription with `takeUntilDestroyed`
- [ ] Line 291: Remove `.toPromise()`, same as above
- [ ] Line 331: Remove `.toPromise()`, same as above
- [ ] Line 348: Remove `.toPromise()`, same as above

### CMS Banner List (`apps/admin/src/cms/banner-list.component.ts`)
- [ ] Line 257: Remove `.toPromise()`, convert to Observable with `takeUntilDestroyed`
- [ ] Line 313: Remove `.toPromise()`, same
- [ ] Line 362: Remove `.toPromise()`, same
- [ ] Line 379: Remove `.toPromise()`, same

### Product List (`apps/admin/src/catalog/product-list.component.ts`)
- [ ] Lines 248,262,278,325,368,385: Remove `.toPromise()`, convert to Observables

### Media List (`apps/admin/src/catalog/media-list.component.ts`)
- [ ] Lines 195,232,263,280: Remove `.toPromise()`, convert to Observables

### Category List (`apps/admin/src/catalog/category-list.component.ts`)
- [ ] Lines 209,264,311,328: Remove `.toPromise()`, convert to Observables

### Brand List (`apps/admin/src/catalog/brand-list.component.ts`)
- [ ] Lines 188,224,269,286: Remove `.toPromise()`, convert to Observables

### Attribute List (`apps/admin/src/catalog/attribute-list.component.ts`)
- [ ] Lines 185,204,243: Remove `.toPromise()`, convert to Observables

### Stock Movements (`apps/admin/src/inventory/stock-movements.component.ts`)
- [ ] Line 111: Remove `.toPromise()`, convert to Observable

### Inventory Reservation (`apps/admin/src/inventory/inventory-reservation.component.ts`)
- [ ] Lines 160,188: Remove `.toPromise()`, convert to Observables

## Priority 4: Replace `.subscribe()` Patterns (non-Http, but needs teardown)

### Auth Translation (`apps/admin/src/core/i18n/primeng-translation.ts`)
- [ ] Line 62: `.subscribe(() => syncLabels())` → use `takeUntilDestroyed(this.destroyRef)` or `toSignal`

### Admin Shell (`apps/admin/src/layout/shell/admin-shell.component.ts`)
- [ ] Line 128: `.subscribe((event) => this.layout.onRouteChange(event.urlAfterRedirects))` → wrap with `takeUntilDestroyed(this.destroyRef)`

### Http Interceptor Spec (`apps/admin/src/core/http/auth.interceptor.spec.ts`)
- [ ] Lines 89,172: Test `.subscribe()` calls - add `.complete()` or use `takeUntilDestroyed` in tests

## Priority 5: Shared/Core Services

### Http Interceptor (`apps/admin/src/core/http/auth.interceptor.ts`)
- [ ] Verify `shareReplay({ bufferSize: 1, refCount: false })` is correct - keep as is (no refCount means it's a one-time share, which is fine for refresh session)
- [ ] Verify no memory leaks in refresh session logic; `finalize()` resets `refreshInFlight` - good pattern

### Admin API Service (`apps/admin/src/core/api/admin-api.service.ts`)
- [ ] Verify all methods return `Observable<T>` (already confirmed) - no changes needed
- [ ] Verify `toParams` private method is pure and doesn't have side effects

### Breakpoint Service (`apps/admin/src/layout/breakpoint.service.ts`)
- [ ] Lines 24-26: `addEventListener`/`removeEventListener` - ensure `takeUntilDestroyed(this.destroyRef)` is used or convert to Angular `onChange` observable pattern

## Priority 6: Project-Wide Grep Verification

- [ ] Run `grep -rn "toPromise" apps/admin/src --include="*.ts"` and verify 0 results (excluding test files after they're updated)
- [ ] Run `grep -rn "\.subscribe(" apps/admin/src --include="*.ts" | grep -v "\.spec\.ts"` and verify all remaining `.subscribe()` calls have `takeUntilDestroyed` before them or are on completing streams
- [ ] Run `grep -rn "new Subscription\|ngOnDestroy" apps/admin/src --include="*.ts"` and verify 0 results (no manual Subscription fields)
- [ ] Run `grep -rn "firstValueFrom\|lastValueFrom" apps/admin/src --include="*.ts"` and verify 0 results on HTTP calls
- [ ] `ng build` passes with no errors
- [ ] `pnpm lint` passes with no new errors
- [ ] Existing unit tests pass (`pnpm test`)

## Acceptance Criteria (per your spec)
- [ ] Grep finds no `toPromise`, `firstValueFrom`, `lastValueFrom` on HTTP calls
- [ ] No `.subscribe()` in services (except test files, which we update separately)
- [ ] Every remaining `.subscribe()` in components is preceded by `takeUntilDestroyed`, or is on a stream that completes (and the audit table says which)
- [ ] No nested subscribes remain
- [ ] `ng build` and lint pass; existing tests pass
- [ ] Manual check: navigate away from each list/form screen mid-request and confirm no console errors and no further network activity