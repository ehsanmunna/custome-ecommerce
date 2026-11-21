# Zoneless Signals Refactor Plan

## Goal

Eliminate repeated manual `ChangeDetectorRef.detectChanges()` calls in the zoneless Angular admin app by converting component state to Angular signals, where async HTTP updates automatically notify the view.

## Current State

- The admin app runs without `zone.js` and is effectively zoneless.
- Many components store async HTTP results in mutable properties and bind directly in templates.
- In zoneless mode, those assignments do not mark the view dirty, causing stale UI until user interaction.
- Recent manual `detectChanges()` calls were added to a subset of components as a workaround.

## Scope

Refactor components that own async-loaded state and mutate it after HTTP responses. Priority order:

1. Catalog: `product-list`, `category-list`, `brand-list`, `attribute-list`, `variant-list`, `media-list`
2. Inventory: `inventory-list`, `inventory-adjustment`, `inventory-reservation`, `stock-movements`
3. Orders/returns: `order-list`, `order-detail`, `order-status`, `return-list`, `return-status`
4. Customers/settings: `customers`, `shipping-zone-list`, `coupon-list`
5. Admin management: `admin-users-list`, `admin-roles-list`
6. CMS/reporting/dashboard: `page-list`, `banner-list`, `sales-metrics`, `low-stock-indicators`, dashboard widgets
7. Auth/shell where async state is displayed

## Recommended Approach

Use signals as the default state mechanism:

- Replace mutable array/object properties with `signal<T>([])` / `signal<T | null>(null)`.
- Update HTTP callbacks with `.set()` / `.update()` instead of direct assignment.
- Derive filtered/computed values with `computed()`.
- For reloadable list data, prefer `rxResource()` with a reload trigger, or `toSignal()` where reload is not needed.
- Keep HTTP calls in services/components as observables; convert at the boundary with `toSignal()`/`rxResource()`.
- Remove `ChangeDetectorRef` injection and manual `detectChanges()` after the component is signal-based.
- Update templates to call signals (`products()` instead of `products`).

## Implementation Steps

1. Pilot on `product-list.component.ts`:
   - Convert `products`, `categories`, `brands`, `media`, `categoryNames`, `brandNames` to signals/computed.
   - Replace `loadProducts()` body with resource reload or signal `.set()`.
   - Update template bindings to signal calls.
   - Update `product-list.component.spec.ts` expectations to read signals.
2. Apply the same pattern to category, brand, attribute, media, variant list components.
3. Migrate inventory, orders, returns, customers, settings, roles, users components.
4. Migrate CMS, reporting, dashboard components.
5. Remove now-unused `ChangeDetectorRef` imports/properties.
6. Run validation.

## Data Flow Notes

- Mutations (create/update/delete) should update the relevant signal or call resource reload.
- Error states should be signals too if templates depend on them.
- Avoid mixing mutable properties and signals in the same component unless clearly separated.

## Risks

- Template changes are required wherever state is read; missing `()` calls will break compilation.
- Tests instantiate components directly and may need updated constructor arguments and signal reads.
- `rxResource` requires Angular version support; verify available APIs before using.
- Some components use `takeUntilDestroyed`; ensure signal updates happen inside subscription callbacks.

## Validation

- `pnpm --filter admin typecheck`
- `pnpm --filter admin lint`
- `pnpm --filter admin test`

## Open Questions

- Should the refactor be incremental (component-by-component) or a single coordinated change?
- Should list data use `rxResource()` with reload triggers, or manual signal updates after mutations?
- Should services be introduced to centralize HTTP calls before signal conversion?
