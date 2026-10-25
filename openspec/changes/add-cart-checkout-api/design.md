# Design

## Context

The database already contains Prisma models and migrations for `carts`, `cart_items`, `orders`,
`order_items`, `shipping_zones`, `shipping_zone_districts`, and `coupons`. The OpenAPI contract already
declares `createCart`, `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, and `checkoutCart`
under `/storefront/carts...`, all with `security: []` and `x-access: public`. None are listed in
`x-implemented-operations`. Money is stored as integer poisha (BDT only), per the hard rules. See
`proposal.md` and the cart-checkout requirements for scope.

## Goals / Non-Goals

**Goals:**

- Implement the six declared cart/checkout operations in the API.
- Make checkout re-check price and stock from the database inside one transaction and snapshot an immutable
  order.
- Keep cart operations public and unauthenticated, matching the contract.
- Preserve the v1 contract: no request/response shape changes; only mark operations implemented.

**Non-Goals:**

- Database schema changes, payment/courier adapters, admin order lifecycle, stock reservation/deduction
  transactions, or storefront UI.

## Decisions

### 1. Public, unauthenticated cart access

The contract marks every cart/checkout route `x-access: public` with no bearer requirement, so guest and
registered customers share the same endpoints. A cart optionally references a customer; a missing customer
reference makes it a guest cart. No permission or role guard is applied to these routes.

**Why:** the contract intentionally exposes cart/checkout publicly to support guest checkout. Adding auth
here would contradict the declared access level and break generated SDK clients that call without tokens.

**Alternatives:** require customer auth (would block guest checkout and the contract's public declaration).

### 2. Transactional checkout with database re-check of price and stock

`checkoutCart` locks the cart and each variant's inventory row, re-reads the current variant price and
available stock, validates quantities, computes subtotal/discount/delivery/tax/total in poisha, creates the
order and order items in one transaction, marks the cart `converted`, and appends no stock movement (stock
reservation/deduction is owned by the inventory change). Rejects with 409 on insufficient stock, missing
variant, already-converted cart, or coupon/zone validation failure.

**Why:** hard rule 5 requires checkout to re-check price and stock from the database. A single transaction
prevents oversell and keeps the order snapshot consistent.

**Alternatives:** trust cart snapshots (violates re-check rule); reserve/deduct stock inline (inventory owns
that; this change only reads availability).

### 3. Integer poisha money, BDT only

All monetary fields use integer poisha (`subtotalPoisha`, `discountPoisha`, `deliveryFeePoisha`, `taxPoisha`,
`totalPoisha`, `unitPricePoisha`, `lineTotalPoisha`), matching the Prisma schema and the contract's `Money`
type. Tax is single-rate, tax-inclusive, and informational; total = subtotal - discount + delivery fee.

**Why:** hard rule 6 mandates one money representation everywhere; poisha avoids floating-point error.

### 4. One coupon per order, no stacking

`CheckoutRequest` accepts at most one `couponCode`. Coupon validity (exists, active window, min order,
per-customer/total limits, no stacking with an existing redemption) is validated at checkout and a single
`CouponRedemption` is recorded on success. Redemption execution and inventory deduction remain out of scope.

**Why:** the domain decision lists coupons as "no stacking" and a single redemption per order.

### 5. Delivery charge flat by zone

The order's `shippingZoneId` selects a `ShippingZone`, whose flat `deliveryFeePoisha` is applied. Guest and
customer carts both supply a delivery address whose district/division resolves to a zone. Zone resolution
happens at checkout inside the transaction.

**Why:** the domain decision specifies flat delivery charge by zone (inside Dhaka / outside Dhaka).

### 6. Immutable order snapshots

Order items snapshot `productName`, `variantSku`, `attributes`, `unitPricePoisha`, and `lineTotalPoisha`.
The order stores its own totals. Cart or catalog changes after checkout cannot alter the order. A cart may
produce at most one order (`Order.cartId` is unique); a second checkout from the same cart is rejected.

**Why:** hard rule / schema design keeps order history stable despite later catalog edits.

**Alternatives:** recompute totals from live cart (would rewrite historical orders and violate snapshot
intent).

### 7. No new database migration

Carts, cart items, orders, order items, shipping zones, districts, and coupons already exist from the
core-schema change. This change only reads/writes them; no Prisma or migration changes are introduced.

**Why:** hard rule 3 requires schema changes only through migrations, and the needed tables already exist.

## Risks / Trade-offs

- **Checkout vs. concurrent stock changes** → Row-level locking on the inventory row inside the transaction
  serializes validation and order creation; a late stock change fails the checkout with insufficient stock
  rather than overselling.
- **Coupon redemption race** → A coupon limit check plus a unique redemption constraint per order prevents
  double-use; contention falls back to the database unique violation and a conflict response.
- **Order total drift from live prices** → Intentional: snapshots protect historical orders, and hard rule 5
  only requires re-check at checkout time, not price immutability guarantees thereafter.
- **No stock deduction at checkout** → Reserved/deducted stock is deferred to the inventory change; an order
  may be placed for stock that is later reserved by another flow until that dependency lands. This is
  documented as a known ordering dependency rather than hidden.

## Migration Plan

No database migration is required. Implement the module, mark the six operations in
`x-implemented-operations`, regenerate the SDK, run contract checks, and run API tests against a migrated
database. Rollback removes the cart-checkout module and the implementation markers; existing order/cart data
and migrations remain untouched.
