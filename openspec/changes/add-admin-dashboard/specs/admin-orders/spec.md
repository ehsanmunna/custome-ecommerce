# Spec Delta

## Purpose

Lets store administrators process customer orders and returns while enforcing the order lifecycle and the administrator's permissions.

## ADDED Requirements

### Requirement: Order search and review
The dashboard SHALL let authorized administrators list and inspect orders using the available status and date filters.

#### Scenario: Review filtered orders
- **WHEN** an administrator with order read permission selects supported filters
- **THEN** the dashboard shows the matching paginated orders returned by the API

#### Scenario: Inspect order details
- **WHEN** an administrator opens an order
- **THEN** the dashboard shows its item and customer snapshots, current status, and status history returned by the API

### Requirement: Order confirmation and status changes
The dashboard SHALL let authorized administrators request only status transitions permitted by the order API. The API SHALL allow only these transitions: `pending` to `confirmed` or `cancelled`; `confirmed` to `processing` or `cancelled`; `processing` to `shipped` or `cancelled`; `shipped` to `delivered` or `partially_delivered`; `partially_delivered` to `delivered`; and `delivered` to `returned`.

#### Scenario: Confirm a pending order
- **WHEN** an authorized administrator confirms an eligible pending order
- **THEN** the dashboard shows the server-confirmed status and updated history

#### Scenario: Rejected status change
- **WHEN** a status change is denied by permissions or lifecycle validation
- **THEN** the dashboard keeps the server-confirmed status and explains that the change did not complete

### Requirement: Return review and status management
The dashboard SHALL let authorized administrators review returns and update their status through the return-management API. The API SHALL allow `requested` returns to become `approved`, `rejected`, or `cancelled`; `approved` returns to become `received` or `cancelled`; and `received` returns to become `refunded`. Rejected, cancelled, and refunded returns SHALL be terminal. Every return SHALL expose append-only status history containing the previous status when present, new status, acting administrator when applicable, optional note, and timestamp.

#### Scenario: Review and update a return
- **WHEN** an administrator with the required return permissions opens a return and submits a valid status change
- **THEN** the dashboard displays the server-confirmed return status

#### Scenario: Return action not permitted
- **WHEN** an administrator lacks the permission required to read or update returns
- **THEN** the corresponding return data or action is not available

#### Scenario: Return status history
- **WHEN** a return is created or its status is changed
- **THEN** the API records and returns an append-only history entry, including the initial requested status and any supplied transition note

#### Scenario: Invalid return transition
- **WHEN** an administrator attempts a transition not allowed by the return lifecycle or updates a terminal return
- **THEN** the API rejects the change and leaves the current status and history unchanged
