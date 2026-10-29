## Purpose

Exposes the platform's single-location, per-variant inventory through an authenticated API with derived availability, auditable adjustments, and reservation management.

## ADDED Requirements

### Requirement: Inventory listing
The system SHALL allow authorized administrators to retrieve paginated inventory records and optionally filter to records whose available quantity is at or below the configured low-stock threshold. Available quantity MUST be derived as on-hand quantity minus reserved quantity; low-stock state MUST be derived by comparing available quantity to the threshold.

#### Scenario: List inventory
- **WHEN** an administrator with `inventory.read` requests `GET /v1/admin/inventory`
- **THEN** the system returns a paginated list with on-hand, reserved, available, threshold, and low-stock values for each variant

#### Scenario: Filter low-stock inventory
- **WHEN** an administrator requests `GET /v1/admin/inventory?lowStock=true`
- **THEN** the system returns only records whose available quantity is less than or equal to their low-stock threshold

### Requirement: Stock adjustments
The system SHALL allow administrators with `inventory.adjust` to adjust stock for a valid product variant. Each adjustment MUST have a non-zero quantity delta and non-empty reason, MUST preserve non-negative available stock, and MUST atomically update the inventory balance and append a stock movement. Inventory writes MUST be serialized for the affected variant.

#### Scenario: Apply a stock adjustment
- **WHEN** an administrator posts a valid adjustment to `/v1/admin/inventory/{variantId}/adjustments`
- **THEN** the system returns the updated inventory record and records the adjustment in the append-only stock movement ledger

#### Scenario: Initialize inventory for a variant
- **WHEN** an administrator applies a positive adjustment to a valid variant that does not yet have an inventory record
- **THEN** the system creates a zero-balance inventory record and applies the adjustment atomically

#### Scenario: Reject an adjustment that makes stock invalid
- **WHEN** an adjustment would make on-hand quantity negative or lower than reserved quantity
- **THEN** the system rejects the adjustment without changing the inventory balance or movement ledger

### Requirement: Stock reservations
The system SHALL allow authorized administrators to list reservations, create manual reservations, and release or commit active reservations. Creating a reservation MUST require a valid variant, a positive quantity no greater than available stock, and MUST update the reserved balance atomically. Reservation status changes MUST update the reserved balance and append the corresponding stock movement in the same transaction.

#### Scenario: Create a manual reservation
- **WHEN** an administrator with `inventory.adjust` creates a reservation for a valid variant with sufficient available stock
- **THEN** the system creates an active reservation and decreases the variant's available quantity by the reserved amount

#### Scenario: Reject a reservation exceeding available stock
- **WHEN** an administrator requests a reservation greater than the variant's available quantity
- **THEN** the system rejects the request without changing the inventory balance

#### Scenario: Release an active reservation
- **WHEN** an administrator releases an active reservation
- **THEN** the system marks it released and restores its quantity to available stock exactly once

#### Scenario: Commit an active reservation
- **WHEN** an administrator commits an active reservation
- **THEN** the system marks it committed and deducts the reserved quantity from on-hand and reserved balances

### Requirement: Inventory access control
The system MUST require the `inventory.read` permission to list inventory or reservations and the `inventory.adjust` permission to adjust stock or manage reservations. Requests without the required authorization MUST be rejected.

#### Scenario: Deny inventory access without permission
- **WHEN** an administrator without the required inventory permission requests a protected inventory operation
- **THEN** the system rejects the request without exposing or changing inventory data
