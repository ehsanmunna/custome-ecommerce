## Purpose

Defines flat delivery zones, district mappings, and courier shipment tracking for customer orders. It
covers plan.md items 5, 18, and 26 and is the foundation for the future delivery-charge and Steadfast
adapter work.

## ADDED Requirements

### Requirement: Delivery zones have unique codes and flat fees

The system SHALL store delivery zones with a unique code, a display name, a non-negative flat delivery
fee in poisha, and an active flag. A second zone MUST NOT use an existing code, and a negative delivery
fee MUST be rejected.

#### Scenario: Zone created

- **WHEN** a zone is saved with a unique code, a name, and a non-negative fee
- **THEN** the zone is stored and readable

#### Scenario: Duplicate zone code rejected

- **WHEN** a second zone is saved with an existing code
- **THEN** the write is rejected

#### Scenario: Negative delivery fee rejected

- **WHEN** a zone is saved with a negative delivery fee
- **THEN** the write is rejected

### Requirement: Each district maps to at most one zone

The system SHALL map delivery districts to zones. A district MUST map to at most one zone, while a zone
MAY cover many districts. Every mapping MUST reference an existing zone. Deleting a zone SHALL delete its
district mappings unless an order still references that zone.

#### Scenario: District assigned to a zone

- **WHEN** a district is mapped to an existing zone
- **THEN** the mapping is stored

#### Scenario: District assigned to a second zone rejected

- **WHEN** a district already mapped to one zone is mapped to another zone
- **THEN** the second write is rejected

#### Scenario: Mapping without a zone rejected

- **WHEN** a district mapping references a zone that does not exist
- **THEN** the write is rejected

#### Scenario: Unused zone deletion removes mappings

- **WHEN** a zone with district mappings but no orders is deleted
- **THEN** its mappings are deleted

### Requirement: Orders keep the delivery zone and fee at placement

The system SHALL store the chosen delivery zone and the delivery fee on every order. The fee stored on
the order MUST match the zone's fee at placement. Later changes to the zone's fee or district mappings
MUST NOT change an existing order, and a zone referenced by an order MUST NOT be deleted.

#### Scenario: Order stores its zone and fee

- **WHEN** an order is placed with a delivery zone
- **THEN** the order stores that zone and the zone's current fee

#### Scenario: Zone fee change does not rewrite orders

- **WHEN** a zone's delivery fee changes after orders used it
- **THEN** existing order fees remain unchanged

#### Scenario: Deleting a zone used by an order rejected

- **WHEN** a zone referenced by an order is deleted
- **THEN** the delete is rejected

### Requirement: Shipments track courier delivery for an order

The system SHALL store shipments with a required existing order, the `steadfast` courier, a supported
shipment status, an optional tracking number, and a non-negative COD amount in poisha. A tracking number
MUST be unique when it is present. An order MAY have more than one shipment, and an order with shipments
MUST NOT be deleted.

#### Scenario: Shipment created for an order

- **WHEN** a shipment is created for an existing order with the Steadfast courier
- **THEN** the shipment is stored with the `pending` status

#### Scenario: Tracking number assigned

- **WHEN** a shipment is saved with a tracking number
- **THEN** the tracking number is readable back with the shipment

#### Scenario: Duplicate tracking number rejected

- **WHEN** a second shipment is saved with an existing tracking number
- **THEN** the write is rejected

#### Scenario: Negative COD amount rejected

- **WHEN** a shipment is saved with a negative COD amount
- **THEN** the write is rejected

#### Scenario: Multiple shipments for one order

- **WHEN** a second shipment is created for an order that already has one
- **THEN** the second shipment is accepted

#### Scenario: Deleting an order with shipments rejected

- **WHEN** an order with shipments is deleted
- **THEN** the delete is rejected

### Requirement: Shipment statuses follow the courier lifecycle

The system SHALL give every shipment a status of `pending`, `booked`, `picked_up`, `in_transit`,
`delivered`, `returned`, `cancelled`, or `failed`. A new shipment MUST default to `pending`, and an
unsupported status MUST be rejected. A shipment that is `delivered` MUST store a delivered timestamp.

#### Scenario: New shipment is pending

- **WHEN** a shipment is created without a status
- **THEN** the stored status is `pending`

#### Scenario: Courier status accepted

- **WHEN** a shipment is saved with any supported courier status
- **THEN** the status is stored

#### Scenario: Unsupported shipment status rejected

- **WHEN** a shipment is saved with a status outside the supported set
- **THEN** the write is rejected

#### Scenario: Delivered shipment requires a timestamp

- **WHEN** a shipment is saved as `delivered` without a delivered timestamp
- **THEN** the write is rejected
