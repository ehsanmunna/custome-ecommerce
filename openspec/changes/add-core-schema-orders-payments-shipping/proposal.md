## Why

Checkout, order management, payment adapters, courier booking, and coupons all need shared tables before
any API code can be written. This change adds the order-side schema from Phase 1 item 5.

## What Changes

- Add Prisma models and one forward migration for carts, cart items, orders, order items, status
  history, returns, return items, payments, shipping zones, district mappings, shipments, coupons, and
  redemptions.
- Allow guest or customer carts. A cart holds one line per variant with a positive quantity; checkout
  later converts it into an order.
- Store orders with a human-readable number, optional customer, guest contact, delivery-address
  snapshot, delivery zone, and immutable poisha totals. Order items snapshot product, SKU, attributes,
  and price so catalog edits cannot rewrite history.
- Record every order status change in append-only history with the previous/next status, acting admin,
  note, and timestamp.
- Store returns as a header plus returned items, with quantities, reasons, status, and refund amounts.
  Refund execution stays an API/payment concern.
- Store payment attempts with method (`cod`, `bkash`, `shurjopay`), status, amount, provider references,
  and lifecycle timestamps. Raw provider payloads and credentials are not stored.
- Store flat delivery zones with district mappings and Steadfast shipment records, including tracking
  number, status, COD amount, and delivery timestamps.
- Store coupons (percentage or fixed, minimum order, validity window, total/per-customer limits) and
  one redemption per order.
- Enforce integrity with checks, unique and partial unique indexes, foreign keys, append-only history
  protection, return-quantity validation, and integration tests against real PostgreSQL.

## Capabilities

### New Capabilities

- `cart-checkout`: guest/customer carts, line items, order snapshots, and totals.
- `orders`: order lifecycle, line items, immutable status history, and returns.
- `payments`: payment methods, state, amounts, and provider references.
- `shipping`: delivery zones, district mappings, and courier shipments.
- `pricing-promotions`: coupons and redemptions.

### Modified Capabilities

- None. The inventory reservation reference stays a typed UUID.

## Non-goals

- Cart, checkout, order, payment, shipping, coupon, or return APIs and guards.
- Payment/courier integration, webhooks, retries, or signature verification.
- Stock reservation/release/deduction transactions; the inventory API owns them later.
- Tax calculation, invoices, accounting, refund execution, or partial refunds.
- Admin UI, storefront, notifications, seed zones/coupons, or a default admin user.
- Coupon stacking, automatic discounts, loyalty points, or gift cards.
- Multi-currency, multi-location shipping, partial-shipment rules, or cross-border delivery.

## Impact

- Affected specs: `cart-checkout`, `orders`, `payments`, `shipping`, and `pricing-promotions` (all new).
- Affected code: `packages/database` (Prisma models, one migration, `expected-version.ts`, integration
  tests, and README); no API routes.
- Dependencies: no new runtime packages; PostgreSQL 16 features only.
- Operational impact: every client database must run `db:migrate` before a build that expects this
  schema.
