# Design

## Context

The admin dashboard shell, authentication, catalog, and inventory screens are complete (from prior changes). The orders and returns API contract already exists on the NestJS backend: `GET/GET/PATCH /admin/orders/*` and `GET/PATCH /admin/returns/*` with permission checks (`orders.read`, `orders.status.update`, `orders.returns.read`, `orders.returns.update`). Order status transitions are enforced server-side with defined allowed state transitions. Return status transitions are similarly enforced.

See `proposal.md` - Why for motivation and `specs/admin-order-management/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Angular screens for order list, order detail, order status change, return list, and return status change
- All screens use the shared API client (`packages/api-sdk`) generated from OpenAPI
- Permission-aware screens using the existing RBAC guard pattern
- UI tests for successful status transitions, API validation failures on invalid transitions, and permission-denied scenarios

**Non-Goals:**
- Order creation from admin panel (orders originate from storefront checkout)
- Payment provider integrations (handled by existing payment API)
- Courier/shipping label generation (handled by existing shipping API)
- Customer notifications for order status changes

## Decisions

**Angular standalone components with the existing app shell**
- Rationale: The admin shell already uses standalone components and `provideRouter`. Adding new screens as standalone components keeps consistency.
- Alternative: NgModules - rejected as it diverges from the existing shell architecture.

**Reuse the shared api-sdk client**
- Rationale: `packages/api-sdk` already generates typed clients from OpenAPI. New screens use `createApiClient` with the admin's bearer token.
- Alternative: Raw `HttpClient` calls - rejected as it bypasses type safety and requires manual contract maintenance.

**Permission guards on screens**
- Rationale: Order screens require `orders.read`/`orders.status.update` permissions, return screens require `orders.returns.read`/`orders.returns.update`, matching the API contract's `x-required-permission` values.
- Alternative: No screen-level guards - rejected as it would allow users to access screens they cannot use via the API.

**Status transition UI as a select dropdown with server-enforced validation**
- Rationale: The dropdown shows only valid next statuses based on current order/return state; server enforces transitions and returns `Problem` responses for invalid ones.
- Alternative: Free-text status input - rejected as it would generate more client errors.

**Loading state and error display per screen**
- Rationale: Each screen shows loading spinners during API calls and error messages for failed operations, consistent with existing catalog/inventory screens.

## Risks / Trade-offs

- [Status transitions are enforced server-side] → Client pre-validates but cannot prevent all invalid transitions; server `Problem` responses must be handled gracefully.
- [Order detail snapshots may be large] → Paginate line items if needed; the API contract returns full order snapshots in one response.
- [Returns are append-only lifecycle history] → The UI must not allow editing historical entries; only status transitions are permitted.

## Migration Plan

No database or API migration is needed. All screens use existing contract operations. Deploy the admin build alongside the existing admin deployment.

## Open Questions

None.
