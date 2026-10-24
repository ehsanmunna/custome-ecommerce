## Purpose

Defines the shared order data model every client database uses: order records, immutable product and
delivery snapshots, money totals, lifecycle history, and returns. It covers plan.md items 5 and 14 and
is the foundation for the order, admin, and storefront APIs.

## ADDED Requirements

### Requirement: Orders have a unique number and a contact identity

The system SHALL store every order with a unique, non-empty order number. An order MAY reference a
registered customer, but it MUST always store a contact name and an E.164 contact phone. A contact email
MAY be stored and MUST be lowercase. Deleting a customer SHALL keep the order and clear its customer
reference; the order's contact and delivery snapshots MUST remain.

#### Scenario: Registered customer order

- **WHEN** an order is created for an existing customer with a unique order number and contact details
- **THEN** the order is stored with that customer reference

#### Scenario: Guest order

- **WHEN** an order is created without a customer but with a contact name and phone
- **THEN** the order is accepted as a guest order

#### Scenario: Duplicate order number rejected

- **WHEN** a second order is saved with an order number already used
- **THEN** the write is rejected

#### Scenario: Missing contact rejected

- **WHEN** an order is saved without a contact name or contact phone
- **THEN** the write is rejected

#### Scenario: Invalid contact phone rejected

- **WHEN** an order contact phone is not valid E.164
- **THEN** the write is rejected

#### Scenario: Mixed-case contact email rejected

- **WHEN** an order contact email contains uppercase characters
- **THEN** the write is rejected

#### Scenario: Customer deletion preserves the order

- **WHEN** a customer with orders is deleted
- **THEN** the orders remain
- **AND** their customer reference is cleared
- **AND** their contact and delivery snapshots remain readable

### Requirement: Orders snapshot the delivery address

The system SHALL store a delivery-address snapshot on every order. The snapshot MUST include a
recipient name, an E.164 recipient phone, address line 1, a district, a division, and a two-letter
uppercase country code that defaults to `BD`. Address line 2, area, and postal code MAY be omitted. The
snapshot MUST NOT depend on a customer address row, so editing or deleting an address book entry MUST
NOT change an existing order.

#### Scenario: Delivery snapshot stored

- **WHEN** an order is created with complete delivery details
- **THEN** the delivery snapshot is stored on the order

#### Scenario: Missing delivery field rejected

- **WHEN** an order is saved without a recipient name, recipient phone, address line 1, district, or
  division
- **THEN** the write is rejected

#### Scenario: Invalid recipient phone rejected

- **WHEN** an order recipient phone is not valid E.164
- **THEN** the write is rejected

#### Scenario: Address book edits do not rewrite orders

- **WHEN** a customer address used at checkout is edited or deleted
- **THEN** the order's delivery snapshot remains unchanged

### Requirement: Orders store immutable money totals in poisha

The system SHALL store order amounts as integer poisha, including subtotal, discount, delivery fee, tax,
and total. All amounts MUST be non-negative, the discount MUST NOT exceed the subtotal, and the tax
amount MUST NOT exceed the subtotal because prices are tax-inclusive. The total MUST equal
`subtotal - discount + delivery_fee`; tax is informational and MUST NOT be added again. An order without
a coupon MUST have a zero discount.

#### Scenario: Totals are consistent

- **WHEN** an order has a 10,000-poisha subtotal, a 1,000-poisha discount, and a 600-poisha delivery fee
- **THEN** the stored total is 9,600 poisha

#### Scenario: Negative amount rejected

- **WHEN** any order amount is written as negative
- **THEN** the write is rejected

#### Scenario: Discount above subtotal rejected

- **WHEN** an order discount exceeds its subtotal
- **THEN** the write is rejected

#### Scenario: Tax is included, not added

- **WHEN** an order has a 1,000-poisha tax amount within a 10,000-poisha subtotal
- **THEN** the total does not add the tax again

#### Scenario: Discount requires a coupon

- **WHEN** an order with no coupon is written with a positive discount
- **THEN** the write is rejected

### Requirement: Orders have a defined lifecycle status

The system SHALL give every order a status of `pending`, `confirmed`, `processing`, `shipped`,
`delivered`, `cancelled`, `returned`, or `partially_delivered`. A new order MUST default to `pending`,
and an unsupported status MUST be rejected.

#### Scenario: New order is pending

- **WHEN** an order is created without an explicit status
- **THEN** the stored status is `pending`

#### Scenario: Supported status accepted

- **WHEN** an order is saved with any supported lifecycle status
- **THEN** the status is stored

#### Scenario: Unsupported order status rejected

- **WHEN** an order is saved with a status outside the supported set
- **THEN** the write is rejected

### Requirement: Order items preserve product and price history

The system SHALL store order line items with a required order reference, a required existing variant
reference, a positive quantity, a non-negative unit price, and a line total equal to unit price
multiplied by quantity. Each line MUST snapshot the product name, variant SKU, and variant attributes at
placement time. An order MUST NOT contain more than one line for the same variant. A product or variant
referenced by an order item MUST NOT be deleted.

#### Scenario: Order item snapshot stored

- **WHEN** an order item is created from a variant with a name, SKU, attributes, and price
- **THEN** those values are stored on the order item

#### Scenario: Zero or negative quantity rejected

- **WHEN** an order item is written with a quantity of zero or less
- **THEN** the write is rejected

#### Scenario: Incorrect line total rejected

- **WHEN** an order item line total does not equal unit price multiplied by quantity
- **THEN** the write is rejected

#### Scenario: Duplicate variant rejected

- **WHEN** a second line for the same variant is added to the same order
- **THEN** the write is rejected

#### Scenario: Unknown variant rejected

- **WHEN** an order item references a variant that does not exist
- **THEN** the write is rejected

#### Scenario: Deleting a referenced product or variant rejected

- **WHEN** a product or variant referenced by an order item is deleted
- **THEN** the delete is rejected

### Requirement: Order status changes are append-only history

The system SHALL record every order status change with the order, the previous status, the next status,
the acting admin when the change is made by a person, an optional note, and a creation timestamp. An
order MUST get an initial history row at creation. Existing history rows MUST NOT be updated or deleted.

#### Scenario: Initial history recorded

- **WHEN** an order is created
- **THEN** an initial history row records no previous status and the `pending` status

#### Scenario: Status transition recorded

- **WHEN** an admin changes an order from `pending` to `confirmed`
- **THEN** a history row records the previous and next status and the acting admin

#### Scenario: History cannot be changed

- **WHEN** an existing order status history row is updated or deleted
- **THEN** the write is rejected

### Requirement: Orders cannot be deleted once history exists

The system SHALL protect order records. An order with line items, status history, payments, shipments,
or returns MUST NOT be deleted.

#### Scenario: Delete an order with history

- **WHEN** an order that has status history is deleted
- **THEN** the delete is rejected

#### Scenario: Delete an order with payments or shipments

- **WHEN** an order that has payments or shipments is deleted
- **THEN** the delete is rejected

### Requirement: Returns are recorded against orders and order items

The system SHALL store return headers with a required existing order, a status of `requested`,
`approved`, `rejected`, `received`, `refunded`, or `cancelled`, a reason, a non-negative refund total,
and the relevant lifecycle timestamps. A new return MUST default to `requested`. Return items MUST
reference an order item from the same order, carry a positive quantity and a non-negative refund amount,
and MUST NOT appear twice in the same return. The cumulative returned quantity for an order item MUST NOT
exceed the ordered quantity. Deleting a return SHALL delete its return items.

#### Scenario: Return requested

- **WHEN** a return is created for an order with a reason
- **THEN** the return is stored with the `requested` status

#### Scenario: Return item recorded

- **WHEN** a return item is added with a valid order item, positive quantity, and refund amount
- **THEN** the return item is stored

#### Scenario: Return item from another order rejected

- **WHEN** a return item references an order item from a different order
- **THEN** the write is rejected

#### Scenario: Return quantity above ordered quantity rejected

- **WHEN** the cumulative returned quantity for an order item would exceed the ordered quantity
- **THEN** the write is rejected

#### Scenario: Duplicate return item rejected

- **WHEN** the same order item is added twice to one return
- **THEN** the second write is rejected

#### Scenario: Unsupported return status rejected

- **WHEN** a return is saved with a status outside the supported set
- **THEN** the write is rejected

#### Scenario: Deleting a return removes its items

- **WHEN** a return with items is deleted
- **THEN** its return items are deleted
