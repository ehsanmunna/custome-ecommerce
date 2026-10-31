# Proposal

## Why

The admin dashboard has a working shell, authentication, catalog, and inventory screens (from prior changes), but no order management screens exist yet. Store operators cannot view orders, change order lifecycle status, or manage return requests through the admin panel, which blocks Milestone 2: "A client can run the business from the admin panel." This change builds those admin workflows on top of the existing orders and returns API contract.

## What Changes

- Build order management screens: order list with filters (status, date range), order detail with snapshots and lifecycle history, and order status change (pending → confirmed/cancelled, confirmed → processing/cancelled, processing → shipped/cancelled, shipped → delivered/partially_delivered, partially_delivered → delivered, delivered → returned)
- Build return request management screens: return list, return detail with lifecycle history, and return status change (requested → approved/rejected/cancelled, approved → received/cancelled, received → refunded)
- Wire all screens through the shared API client (`packages/api-sdk`) generated from the OpenAPI contract
- Add permission-aware UI using the existing RBAC guard pattern, matching API `x-required-permission` values (`orders.read`, `orders.status.update`, `orders.returns.read`, `orders.returns.update`)
- Add UI tests for order and return workflows covering successful status transitions, API validation failures on invalid transitions, and permission-denied scenarios

## Capabilities

### New Capabilities

- `admin-order-management`: Order list/detail, order status lifecycle transitions, return request list/detail, and return status lifecycle transitions for the admin dashboard

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin` (new Angular components and screens for orders and returns)
- Affected APIs: existing orders API (`GET/GET/PATCH /admin/orders/*`), returns API (`GET/PATCH /admin/returns/*`)
- Depends on: `define-openapi-contract` (OpenAPI contract + SDK already generated), `add-admin-catalog-and-inventory` (admin shell + auth already built)
- Non-goals: Storefront order flow, payment processing, courier integrations beyond existing API capabilities, order creation from admin panel

## Non-goals

- Creating orders from the admin panel (orders originate from storefront checkout)
- Payment provider integrations (handled by existing payment API)
- Courier/shipping label generation (handled by existing shipping API)
- Email/SMS notifications for order status changes
