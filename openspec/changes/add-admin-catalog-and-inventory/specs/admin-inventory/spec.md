# Spec Delta

## Purpose

Lets store operators manage stock levels, reservations, adjustments, and low-stock alerts through the admin dashboard.

## ADDED Requirements

### Requirement: Inventory listing
The system SHALL display current stock levels per variant, with derived low-stock state when stock is at or below the per-item threshold.

#### Scenario: View inventory list
- **WHEN** an admin opens the inventory screen
- **THEN** the system lists each variant with its available stock quantity and low-stock flag

#### Scenario: Filter low-stock items
- **WHEN** an admin filters the inventory list to low-stock items only
- **THEN** the system shows only variants at or below their low-stock threshold

### Requirement: Stock adjustments
The system SHALL allow admins to record stock adjustments (increase or decrease) for a variant, with reason and reference, writing a stock movement ledger entry for each adjustment.

#### Scenario: Record a stock increase
- **WHEN** an admin records a positive stock adjustment for a variant with a reason
- **THEN** the variant's available stock increases and a stock movement of type `adjustment` is recorded

#### Scenario: Record a stock decrease
- **WHEN** an admin records a negative stock adjustment that would not drop stock below zero
- **THEN** the variant's available stock decreases and a stock movement is recorded

#### Scenario: Reject negative stock adjustment
- **WHEN** an admin records a negative stock adjustment that would drop stock below zero
- **THEN** the adjustment is rejected and no stock movement is recorded

### Requirement: Stock reservations
The system SHALL allow admins to create manual stock reservations for a variant, with status lifecycle (active, released, committed, expired).

#### Scenario: Create a manual reservation
- **WHEN** an admin creates a reservation for a variant with sufficient available stock
- **THEN** the reservation is created with status `active` and the reserved units are excluded from available stock

#### Scenario: Release a reservation
- **WHEN** an admin releases an active reservation
- **THEN** the reservation status becomes `released` and the reserved units return to available stock

#### Scenario: Commit a reservation
- **WHEN** an admin commits an active reservation against an order
- **THEN** the reservation status becomes `committed` and the reserved units are deducted from available stock

### Requirement: Stock movements ledger
The system SHALL maintain an append-only ledger of all stock movements (adjustments, reservations, releases, commitments) with variant, quantity, type, reason, and timestamp.

#### Scenario: View stock movements for a variant
- **WHEN** an admin views the stock movement history for a variant
- **THEN** the system lists all movements chronologically with type, quantity, reason, and timestamp

### Requirement: Low-stock alerts
The system SHALL flag variants as low-stock when their available quantity is at or below the per-item threshold defined in settings.

#### Scenario: Low-stock flag appears
- **WHEN** a variant's available stock drops to its low-stock threshold
- **THEN** the variant is flagged as low-stock in the inventory list
