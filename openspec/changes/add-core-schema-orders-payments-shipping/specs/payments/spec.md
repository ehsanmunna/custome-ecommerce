## Purpose

Defines payment attempts and their lifecycle for cash on delivery and online payment gateways in the
shared order schema. It covers plan.md items 15-17 and is the foundation for the future payment
adapters.

## ADDED Requirements

### Requirement: Payments use supported methods and statuses

The system SHALL store a payment method of `cod`, `bkash`, or `shurjopay`. Every payment MUST carry a
status of `pending`, `authorized`, `paid`, `failed`, `cancelled`, `refunded`, or `partially_refunded`.
A new payment MUST default to `pending`, and an unsupported method or status MUST be rejected.

#### Scenario: COD payment created

- **WHEN** a COD payment is created
- **THEN** it is stored with the `cod` method and the `pending` status

#### Scenario: Online payment created

- **WHEN** a bKash or ShurjoPay payment is created
- **THEN** it is stored with that method and the `pending` status

#### Scenario: Unsupported method rejected

- **WHEN** a payment is written with a method outside `cod`, `bkash`, and `shurjopay`
- **THEN** the write is rejected

#### Scenario: Unsupported payment status rejected

- **WHEN** a payment is written with a status outside the supported set
- **THEN** the write is rejected

### Requirement: Payments belong to orders and carry positive amounts

The system SHALL require every payment to reference an existing order and carry a positive amount in
poisha. An order MAY have more than one payment attempt, and a payment MUST NOT be stored with a zero or
negative amount.

#### Scenario: Payment attached to an order

- **WHEN** a payment is created for an existing order
- **THEN** the payment is stored and readable with that order

#### Scenario: Payment without an order rejected

- **WHEN** a payment is written without an existing order reference
- **THEN** the write is rejected

#### Scenario: Zero or negative payment rejected

- **WHEN** a payment is written with an amount of zero or less
- **THEN** the write is rejected

#### Scenario: Multiple attempts allowed

- **WHEN** a failed payment attempt exists for an order
- **THEN** another payment attempt may be created for the same order

### Requirement: Provider references are unique and contain no secrets

The system SHALL store an optional provider reference for each payment. A provider reference MUST be
unique per payment method when it is present. The schema MUST NOT contain provider credentials, raw
webhook payloads, or unhashed card data.

#### Scenario: Provider reference stored

- **WHEN** an online payment is stored with a provider reference
- **THEN** the reference is readable back with the payment

#### Scenario: Duplicate provider reference rejected

- **WHEN** two payments of the same method are saved with the same provider reference
- **THEN** the second write is rejected

#### Scenario: COD without provider reference

- **WHEN** a COD payment is stored without a provider reference
- **THEN** the payment is accepted

### Requirement: Payment status timestamps match the lifecycle

The system SHALL record a paid timestamp when a payment is `paid`, a refunded timestamp when it is
`refunded` or `partially_refunded`, and a cancellation timestamp when it is `cancelled`. A payment in
those states MUST NOT be stored without the corresponding timestamp.

#### Scenario: Paid payment timestamp

- **WHEN** a payment is saved with the `paid` status
- **THEN** a paid timestamp is stored

#### Scenario: Paid payment without timestamp rejected

- **WHEN** a payment is saved with the `paid` status and no paid timestamp
- **THEN** the write is rejected

#### Scenario: Refunded payment timestamp

- **WHEN** a payment is saved with `refunded` or `partially_refunded`
- **THEN** a refunded timestamp is stored

#### Scenario: Cancelled payment timestamp

- **WHEN** a payment is saved with the `cancelled` status
- **THEN** a cancellation timestamp is stored
