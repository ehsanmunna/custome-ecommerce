## Purpose

Defines the shared inventory data model every client database uses: stock per variant, reservations,
an append-only movements ledger, adjustments, and low-stock thresholds. This covers plan.md items 4
and 11 and is the foundation for checkout stock reservation, the inventory API, and the admin stock
screens.

## ADDED Requirements

### Requirement: Inventory is held per variant at one location

The system SHALL store inventory for every sellable variant, with exactly one inventory item per
variant. The schema MUST NOT contain location-specific stock rows, because v1 has a single location.
An inventory item MUST reference an existing variant, and a second inventory item for the same
variant MUST be rejected.

#### Scenario: Inventory item created for a variant

- **WHEN** an inventory item is created for an existing variant with an on-hand quantity
- **THEN** the item is stored and linked to that variant

#### Scenario: Second inventory item for one variant rejected

- **WHEN** a second inventory item is created for a variant that already has one
- **THEN** the write is rejected

#### Scenario: Inventory without a variant rejected

- **WHEN** an inventory item is written without an existing variant reference
- **THEN** the write is rejected

### Requirement: Stock quantities cannot become invalid

Each inventory item SHALL track a non-negative on-hand quantity and a non-negative reserved quantity.
The reserved quantity MUST NOT exceed the on-hand quantity, and an available quantity SHALL be derived
as on-hand minus reserved. The available quantity MUST never be negative.

#### Scenario: Available quantity is derived

- **WHEN** a variant has 10 units on hand and 3 units reserved
- **THEN** its available quantity is 7

#### Scenario: Negative on-hand rejected

- **WHEN** an inventory item is written with a negative on-hand quantity
- **THEN** the write is rejected

#### Scenario: Negative reserved quantity rejected

- **WHEN** an inventory item is written with a negative reserved quantity
- **THEN** the write is rejected

#### Scenario: Reserved exceeds on-hand rejected

- **WHEN** an inventory item is written with 2 units on hand and 3 units reserved
- **THEN** the write is rejected

### Requirement: Low stock is derived from a per-item threshold

Each inventory item SHALL carry a non-negative low-stock threshold. An item SHALL be considered low on
stock when its available quantity is less than or equal to its threshold. Changing the threshold MUST
NOT change on-hand or reserved quantities.

#### Scenario: Item at or below its threshold is low

- **WHEN** an item has 4 units available and a threshold of 4
- **THEN** the item is reported as low on stock

#### Scenario: Item above its threshold is not low

- **WHEN** an item has 5 units available and a threshold of 4
- **THEN** the item is not reported as low on stock

#### Scenario: Negative threshold rejected

- **WHEN** an inventory item is written with a negative threshold
- **THEN** the write is rejected

### Requirement: Reservations hold stock without removing it

The system SHALL record reservations as their own rows, each referencing an existing variant and
carrying a positive quantity, a status, and an optional expiry. A reservation status MUST be one of
`active`, `released`, `committed`, or `expired`. Only `active` reservations SHALL count towards the
reserved quantity, and a reservation MUST NOT hold more units than are available.

#### Scenario: Active reservation holds stock

- **WHEN** a reservation for 2 units of a variant with 5 available units is created with `active`
  status
- **THEN** the reservation is stored and the variant's reserved quantity increases by 2

#### Scenario: Release returns reserved stock

- **WHEN** an `active` reservation is released
- **THEN** its status becomes `released`
- **AND** the held units return to available stock

#### Scenario: Commit consumes reserved stock

- **WHEN** an `active` reservation is committed
- **THEN** its status becomes `committed`
- **AND** the reserved quantity and on-hand quantity both decrease by the reserved units

#### Scenario: Expire releases reserved stock

- **WHEN** an `active` reservation expires
- **THEN** its status becomes `expired`
- **AND** the held units return to available stock

#### Scenario: Zero or negative reservation rejected

- **WHEN** a reservation is written with a quantity of zero or less
- **THEN** the write is rejected

#### Scenario: Unsupported reservation status rejected

- **WHEN** a reservation is written with a status outside the supported set
- **THEN** the write is rejected

#### Scenario: Reservation above availability rejected

- **WHEN** a reservation requests more units than are currently available
- **THEN** the reservation is rejected and no stock is held

### Requirement: Reservations are traceable to their source action

A reservation MAY carry a typed external reference (`cart`, `order`, or `manual`) and a reference
identifier. The schema MUST NOT require a foreign key to carts or orders, because those tables are
introduced by a later change.

#### Scenario: Reservation for an order is traceable

- **WHEN** a reservation is created with an `order` reference and an order identifier
- **THEN** the reference type and identifier are readable back with the reservation

#### Scenario: Manual reservation omits a reference

- **WHEN** a reservation is created for a manual stock hold without a reference
- **THEN** the reservation is accepted

### Requirement: Every stock change is written to an append-only ledger

The system SHALL record every change to on-hand or reserved quantities as a stock movement. Each
movement MUST carry a movement type, the on-hand delta, the reserved delta, the resulting on-hand and
reserved balances, an optional reference, an optional note, and a creation timestamp. Stock movements
MUST be append-only: an existing movement MUST NOT be updated or deleted.

Movement types SHALL be `initial`, `adjustment`, `reservation`, `release`, `deduction`, and
`return`. A reservation movement increases reserved quantity; a release movement decreases it; a
deduction decreases both on-hand and reserved quantity; and initial, adjustment, and return movements
change on-hand quantity without changing reserved quantity.

#### Scenario: Reservation movement recorded

- **WHEN** 2 units are reserved for a variant
- **THEN** a `reservation` movement is recorded with an on-hand delta of 0 and a reserved delta of +2
- **AND** the resulting balances are stored on the movement

#### Scenario: Release movement recorded

- **WHEN** a 2-unit reservation is released
- **THEN** a `release` movement is recorded with an on-hand delta of 0 and a reserved delta of -2

#### Scenario: Deduction movement recorded

- **WHEN** a committed 2-unit reservation is deducted at fulfilment
- **THEN** a `deduction` movement is recorded with an on-hand delta of -2 and a reserved delta of -2

#### Scenario: Manual adjustment recorded

- **WHEN** an operator adjusts on-hand quantity by +5
- **THEN** an `adjustment` movement is recorded with an on-hand delta of +5 and a reserved delta of 0

#### Scenario: Existing movement cannot be changed

- **WHEN** an existing stock movement is updated or deleted
- **THEN** the write is rejected

### Requirement: Inventory history cannot be orphaned

The system SHALL protect inventory history. A variant that has an inventory item, a reservation, or a
stock movement MUST NOT be deleted, and every inventory reference MUST point to an existing variant.

#### Scenario: Delete a variant with inventory

- **WHEN** a variant that has an inventory item is deleted
- **THEN** the delete is rejected

#### Scenario: Delete a variant with reservation history

- **WHEN** a variant that has a stock reservation is deleted
- **THEN** the delete is rejected

#### Scenario: Delete a variant with movement history

- **WHEN** a variant that has stock movements is deleted
- **THEN** the delete is rejected

#### Scenario: Unknown variant rejected

- **WHEN** a reservation or stock movement references a variant that does not exist
- **THEN** the write is rejected
