## Purpose

Implements the storefront cart and checkout capability: guest and customer carts, line items, coupon
application, flat delivery charge by zone, price/stock re-check at checkout, immutable order snapshots, and
order placement (COD first). Covers plan.md item 13 and the `cart-checkout` capability.

## ADDED Requirements

### Requirement: Cart operations are public and support guest and customer carts

The system SHALL expose `POST /storefront/carts`, `GET /storefront/carts/{cartId}`,
`POST /storefront/carts/{cartId}/items`, `PATCH /storefront/carts/{cartId}/items/{itemId}`, and
`DELETE /storefront/carts/{cartId}/items/{itemId}` without authentication. A cart MAY reference a customer;
a cart without a customer reference is a guest cart. Every cart carries status `active`, `converted`, or
`abandoned` and defaults to `active`. A cart holds at most one line per variant with a positive quantity.

#### Scenario: Create a guest cart

- **WHEN** a client posts to `POST /storefront/carts` with no customer reference
- **THEN** the system returns a new active cart with no customer and empty items

#### Scenario: Create a cart for a registered customer

- **WHEN** an authenticated or identified customer creates a cart
- **THEN** the cart stores the customer reference and is readable as that customer's cart

#### Scenario: Add, update, and remove cart line items

- **WHEN** a client adds a variant with a positive quantity, updates the quantity, and removes the item
- **THEN** the cart reflects each change and a duplicate variant or non-positive quantity is rejected

### Requirement: Checkout re-checks price and stock and places an order

The system SHALL expose `POST /storefront/carts/{cartId}/checkout` without authentication. Checkout MUST
re-check variant price and available stock from the database inside one transaction, reject the request when
stock is insufficient, the variant is missing, or the cart is already `converted`, and on success create an
order with status `pending`, snapshot order items and poisha totals, mark the cart `converted`, and return
the order. One cart MUST produce at most one order.

#### Scenario: Successful COD checkout

- **WHEN** a client checks out an active cart with sufficient stock and valid guest contact and delivery
  details
- **THEN** the system returns a `pending` order with snapshotted items and totals, and the cart becomes
  `converted`

#### Scenario: Insufficient stock at checkout

- **WHEN** a cart line quantity exceeds the variant's available stock
- **THEN** checkout is rejected with an insufficient-stock error, no order is created, and the cart remains
  active

#### Scenario: One order per cart

- **WHEN** checkout is attempted twice for the same cart
- **THEN** the first succeeds and the second is rejected because the cart is already `converted`

### Requirement: Delivery charge by zone and coupon application

The system SHALL apply a flat delivery fee from the cart's shipping zone and accept at most one coupon code
per checkout. A coupon MUST be valid (active window, minimum order, usage limits) and MUST NOT stack. The
order total equals subtotal minus discount plus delivery fee; tax is single-rate, tax-inclusive, and
informational. All money is BDT stored as integer poisha.

#### Scenario: Delivery fee applied by zone

- **WHEN** a delivery address resolves to a shipping zone with a flat fee
- **THEN** the order's delivery fee equals that zone's fee and is included in the total

#### Scenario: Single coupon applied; stacking rejected

- **WHEN** a checkout supplies one valid coupon meeting the minimum order
- **THEN** the discount is applied once and the order records a single coupon redemption

#### Scenario: Money represented as integer poisha

- **WHEN** an order is returned
- **THEN** all monetary fields are integers in poisha and the total equals subtotal minus discount plus
  delivery fee

### Requirement: Checkout requires valid guest contact and delivery details

The system SHALL require contact name, contact phone, delivery recipient, line 1, district, and division at
checkout, and SHALL store them on the order. A missing customer reference MUST NOT by itself reject a guest
checkout.

#### Scenario: Guest checkout stores contact and delivery on the order

- **WHEN** a guest cart is checked out with valid contact and delivery details
- **THEN** the order is stored without a customer reference and retains the supplied contact and delivery
  snapshot
