## Purpose

Defines the shared cart data model for guests and registered customers, cart line items, and the
cart-to-order link that checkout uses. It covers plan.md items 5 and 13 and is the foundation for the
future cart and checkout APIs.

## ADDED Requirements

### Requirement: Carts support guest and registered customers

The system SHALL store carts with an optional reference to a registered customer. A cart without a
customer reference SHALL be treated as a guest cart. Every cart MUST carry a status of `active`,
`converted`, or `abandoned`, and a new cart MUST default to `active`. Deleting a customer SHALL delete
that customer's carts.

#### Scenario: Guest cart

- **WHEN** a cart is created without a customer reference
- **THEN** the cart is stored as a guest cart

#### Scenario: Registered customer cart

- **WHEN** a cart is created for an existing customer
- **THEN** the cart is stored and readable with that customer

#### Scenario: Unknown customer rejected

- **WHEN** a cart is written with a customer reference that does not exist
- **THEN** the write is rejected

#### Scenario: Unsupported cart status rejected

- **WHEN** a cart is written with a status outside `active`, `converted`, and `abandoned`
- **THEN** the write is rejected

#### Scenario: Customer deletion removes carts

- **WHEN** a customer with carts is deleted
- **THEN** those carts are deleted
- **AND** no orphaned cart rows remain

### Requirement: Cart line items represent one variant each

The system SHALL store cart line items with a required cart reference, a required variant reference, and
a positive quantity. A cart MUST NOT contain more than one line for the same variant. Deleting a cart
SHALL delete its line items, and deleting a variant SHALL remove that variant from every cart.

#### Scenario: Item added to a cart

- **WHEN** a positive quantity of an existing variant is added to a cart
- **THEN** the line item is stored with that cart and variant

#### Scenario: Zero or negative quantity rejected

- **WHEN** a cart line item is written with a quantity of zero or less
- **THEN** the write is rejected

#### Scenario: Duplicate variant rejected

- **WHEN** a second line for the same variant is added to the same cart
- **THEN** the write is rejected

#### Scenario: Unknown variant rejected

- **WHEN** a cart line item is written with a variant that does not exist
- **THEN** the write is rejected

#### Scenario: Deleting a cart removes its lines

- **WHEN** a cart with line items is deleted
- **THEN** those line items are deleted

#### Scenario: Deleting a variant removes it from carts

- **WHEN** a variant referenced by a cart line is deleted
- **THEN** that cart line is removed
- **AND** the cart remains

### Requirement: A cart is converted into at most one order

The system SHALL allow an order to reference the cart it was created from, and MUST reject a second
order that references the same cart. When checkout succeeds, the cart MUST become `converted`, and the
order MUST keep its own snapshots so later cart or catalog changes do not alter the order.

#### Scenario: Cart converted to an order

- **WHEN** an order is created from an active cart
- **THEN** the order references that cart
- **AND** the cart status becomes `converted`

#### Scenario: Second order from one cart rejected

- **WHEN** a second order is created from a cart that already produced an order
- **THEN** the second order is rejected

#### Scenario: Converted cart cannot be reused

- **WHEN** checkout is attempted with a cart that is already `converted`
- **THEN** the attempt is rejected

#### Scenario: Cart changes do not rewrite an order

- **WHEN** cart lines or variant prices change after an order is created
- **THEN** the order's items, prices, and totals remain unchanged

### Requirement: Guest checkout does not require a customer account

The system SHALL allow an order to be created without a registered customer. A missing customer
reference MUST NOT by itself reject a cart or an order, and guest contact and delivery details MUST be
stored on the order rather than inferred from a customer account.

#### Scenario: Guest cart becomes a guest order

- **WHEN** a guest cart is converted into an order with valid guest contact details
- **THEN** the order is stored without a customer reference

#### Scenario: Registered cart keeps its customer

- **WHEN** a cart belonging to a customer is converted into an order
- **THEN** the order keeps that customer reference
