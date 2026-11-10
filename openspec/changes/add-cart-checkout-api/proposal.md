# Proposal

## Why

The platform already stores carts, cart items, orders, order items, shipping zones, and coupons, and the
canonical OpenAPI contract already declares the storefront cart and checkout operations, but none of them
are implemented. Customers cannot build a cart, adjust items, apply a coupon, or place an order, so the
core buying flow is missing from the API.

## What Changes

- Implement the six storefront cart/checkout operations: create cart, get cart, add cart item, update cart
  item quantity, remove cart item, and checkout cart. All are public per the contract and require no
  authentication.
- Checkout always re-checks variant price and stock from the database in a transaction, snapshots order
  items and poisha totals into the order, marks the cart `converted`, and rejects checkout when stock is
  insufficient or the cart is already converted.
- Apply a single flat delivery charge from the configured shipping zone and apply one coupon (percentage or
  fixed, min order, validity, usage limits) per order, with no stacking.
- Default order status to `pending` (COD first; payment adapters and status transitions are separate
  changes). Order items snapshot product name, SKU, attributes, unit price, and line total so later catalog
  edits cannot rewrite an order.
- Mark the implemented cart/checkout operations in `x-implemented-operations` and keep the generated SDK
  current. No database migration: the cart, order, shipping-zone, and coupon tables already exist.

## Capabilities

### New Capabilities

- `cart-checkout`: Guest and customer carts, line items, coupon application, delivery charge by zone, and
  order placement (COD first).

### Modified Capabilities

- None.

## Non-goals

- Payment adapters (bKash, ShurjoPay), payment webhooks, or payment status transitions.
- Shipping/courier adapter (Steadfast), shipment creation, or tracking.
- Admin order lifecycle, status transitions, history, and returns.
- Stock reservation or deduction at checkout; the inventory API owns reservations separately.
- Admin cart management, cart expiration/abandonment cleanup, stored addresses, or storefront UI.
- Coupon stacking, automatic discounts, loyalty points, gift cards, multi-currency, or multi-location shipping.

## Impact

- Affected spec: `cart-checkout` (new).
- Affected code: new NestJS `cart-checkout` module under `apps/api/src/cart-checkout` (controller, service,
  validation schemas, response mappers), wired into `AppModule`; contract implementation markers in
  `apps/api/openapi/openapi.yaml`; `packages/api-sdk` regenerated if needed.
- Affected API: the six `Carts and checkout` operations become implemented. Existing request/response shapes
  and the v1 contract remain compatible; only `x-implemented-operations` changes.
- Depends on: `cart-checkout` database schema (carts, cart items, orders, order items), `shipping` zones for
  delivery fee, `pricing-promotions` coupons, `inventory` stock read at checkout time, and customer auth for
  optional customer-linked carts. No new runtime packages.
