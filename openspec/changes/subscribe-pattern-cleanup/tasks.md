# Tasks

## 1. Auth

- [x] 1.1 Convert `auth/login.component.ts` `onSubmit()` from `async/await` to `.subscribe()` with `takeUntilDestroyed(this.destroyRef)` — verifies login form submits via Observable and redirect happens inside same stream
- [x] 1.2 Convert `auth/logout.component.ts` `ngOnInit()` from `async/await` to `.subscribe()` with `takeUntilDestroyed(this.destroyRef)` — verifies logout clears session and navigates to /login via Observable stream

## 2. Catalog (products, categories, brands, attributes, media, variants)

- [x] 2.1 Convert `catalog/product-list.component.ts` `loadProducts`, `loadCategories`, `loadBrands`, `createProduct`, `updateProduct`, `deleteProduct` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload products after create/update/delete — verifies all methods compile and load via Observable
- [x] 2.2 Convert `catalog/category-list.component.ts` `loadCategories`, `createCategory`, `updateCategory`, `deleteCategory` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload categories after create/update/delete — verifies category tree reloads inside same stream
- [x] 2.3 Convert `catalog/brand-list.component.ts` `loadBrands`, `createBrand`, `updateBrand`, `deleteBrand` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload brands after create/update/delete — verifies brand list reloads inside same stream
- [x] 2.4 Convert `catalog/attribute-list.component.ts` `loadCategories`, `loadAttributes`, `createAttribute`, `updateAttribute`, `deleteAttribute` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies attribute management compiles without async/await
- [x] 2.5 Convert `catalog/media-list.component.ts` `loadMedia`, `createMediaUpload`, `completeMediaUpload`, `deleteMedia` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap`/`exhaustMap` as appropriate — verifies media upload and delete use Observable streams
- [x] 2.6 Convert `catalog/variant-list.component.ts` `loadVariants`, `loadAttributeDefs`, `createVariant`, `updateVariant`, `deleteVariant` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies variant management compiles without async/await

## 3. CMS (pages, banners)

- [x] 3.1 Convert `cms/page-list.component.ts` `loadPages`, `createPage`, `updatePage`, `deletePage` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload pages after create/update/delete — verifies CMS page CRUD compiles without async/await
- [x] 3.2 Convert `cms/banner-list.component.ts` `loadBanners`, `createBanner`, `updateBanner`, `deleteBanner` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload banners after create/update/delete — verifies banner CRUD compiles without async/await

## 4. Inventory

- [x] 4.1 Convert `inventory/inventory-list.component.ts` `loadInventory`, `loadVariantSkus` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies inventory list loads via Observable
- [x] 4.2 Convert `inventory/inventory-reservation.component.ts` `loadReservations`, `createReservation`, `updateReservationStatus` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies reservation management compiles without async/await
- [x] 4.3 Convert `inventory/stock-movements.component.ts` `loadMovements` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies stock movements load via Observable
- [x] 4.4 Convert `inventory/inventory-adjustment.component.ts` `createAdjustment` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies inventory adjustment compiles without async/await

## 5. Orders & Returns

- [x] 5.1 Convert `orders/order-list.component.ts` `loadOrders` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies order list loads via Observable
- [x] 5.2 Convert `orders/order-status.component.ts` `loadOrder`, `changeStatus` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies order status change uses Observable stream
- [x] 5.3 Convert `orders/order-detail.component.ts` `loadOrder` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies order detail loads via Observable
- [x] 5.4 Convert `returns/return-status.component.ts` `loadReturn`, `changeStatus` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies return status change uses Observable stream
- [x] 5.5 Convert `returns/return-list.component.ts` `loadReturns` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies return list loads via Observable

## 6. Settings (coupons, shipping zones)

- [x] 6.1 Convert `settings/shipping-zone-list.component.ts` `loadZones`, `createZone`, `updateZone`, `deleteZone` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload zones after create/update/delete — verifies shipping zone CRUD compiles without async/await
- [x] 6.2 Convert `settings/coupon-list.component.ts` `loadCoupons`, `createCoupon`, `updateCoupon`, `deleteCoupon` from `async/await` to `.subscribe()` with `takeUntilDestroyed`; use `switchMap` to reload coupons after create/update/delete — verifies coupon CRUD compiles without async/await

## 7. Reporting

- [x] 7.1 Convert `reporting/sales-metrics.component.ts` `loadSalesMetrics` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies sales metrics load via Observable
- [x] 7.2 Convert `reporting/low-stock-indicators.component.ts` `loadLowStockIndicators` from `async/await` to `.subscribe()` with `takeUntilDestroyed` — verifies low-stock indicators load via Observable

## 8. Dashboard

- [x] 8.1 Convert `features/dashboard/dashboard.service.ts` from `firstValueFrom`/`async`/`await` to pure Observable-returning methods — verifies service methods return Observable<T> without `firstValueFrom`
- [x] 8.2 Convert `features/dashboard/dashboard.store.ts` `load()` from `async`/`await` to Observable subscription — verifies store loads via Observable subscription

## 9. Shared/Core

- [x] 9.1 Convert `core/i18n/primeng-translation.ts` `.subscribe()` from `destroyRef.onDestroy(() => subscription.unsubscribe())` to `takeUntilDestroyed(this.destroyRef)` pattern — verifies translation subscription uses consistent teardown pattern

## 10. Verification

- [ ] 10.1 Run `pnpm --filter admin typecheck` — verifies no TypeScript errors
- [ ] 10.2 Run `pnpm --filter admin lint` — verifies no lint errors
- [ ] 10.3 Run `pnpm --filter admin test` — verifies existing tests pass
- [ ] 10.4 Grep production code: zero matches for `async`, `await`, `.then(`, `toPromise`, `firstValueFrom`, `lastValueFrom` in HTTP-related code — verifies no Promise patterns remain
- [ ] 10.5 Grep production code: no `.subscribe()` inside any service — verifies services never subscribe
- [ ] 10.6 Grep production code: every `.subscribe()` in components preceded by `takeUntilDestroyed` — verifies all component subscriptions cleaned up
- [ ] 10.7 Grep production code: no nested subscribes — verifies no subscription inside subscribe
- [ ] 10.8 Manual check: navigate away from each list/form screen mid-request — confirms no console errors and no further network activity after navigation

## Workflow follow-up

- Archive the change after review requirements are satisfied.
