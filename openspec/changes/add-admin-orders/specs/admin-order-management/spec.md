# Spec Delta

## Purpose

Lets store operators manage order lifecycle status and return requests through the admin dashboard.

## ADDED Requirements

### Requirement: Order list with filters
The system SHALL display a paginated list of orders filterable by order status and date range, showing order number, customer, status, total, and date.

#### Scenario: List all orders
- **WHEN** an admin opens the order list screen
- **THEN** the system displays a paginated table of orders with order number, customer name, status, total amount, and order date

#### Scenario: Filter orders by status
- **WHEN** an admin selects a status filter (e.g., "pending", "confirmed", "shipped")
- **THEN** the system displays only orders matching the selected status

#### Scenario: Filter orders by date range
- **WHEN** an admin sets a createdFrom and createdTo date range
- **THEN** the system displays only orders created within that date range

### Requirement: Order detail view
The system SHALL display order details including customer information, line items, snapshots, and lifecycle history.

#### Scenario: View order details
- **WHEN** an admin opens an order detail page
- **THEN** the system shows the order number, customer information, shipping address, line items with quantities and prices, payment status, and full lifecycle history

### Requirement: Order status change
The system SHALL allow admins to change an order's lifecycle status with enforced state transitions, appending a history entry for each change.

#### Scenario: Advance order from pending to confirmed
- **WHEN** an admin sets the status of a pending order to "confirmed"
- **THEN** the system updates the order status to confirmed and appends a status history entry

#### Scenario: Cancel an order
- **WHEN** an admin sets the status of a pending order to "cancelled"
- **THEN** the system updates the order status to cancelled and appends a status history entry

#### Scenario: Reject invalid order status transition
- **WHEN** an admin attempts to set a shipped order directly to "returned" (skipping delivered)
- **THEN** the system rejects the transition with an error explaining the invalid transition

#### Scenario: Ship an order
- **WHEN** an admin sets the status of a processing order to "shipped"
- **THEN** the system updates the order status to shipped and appends a status history entry

#### Scenario: Deliver an order
- **WHEN** an admin sets the status of a shipped order to "delivered"
- **THEN** the system updates the order status to delivered and appends a status history entry

### Requirement: Return request list
The system SHALL display a paginated list of return requests with return ID, order reference, status, and date.

#### Scenario: List all return requests
- **WHEN** an admin opens the returns screen
- **THEN** the system displays a paginated table of return requests with return ID, order number, status, and request date

### Requirement: Return status change
The system SHALL allow admins to change a return request's status with enforced state transitions.

#### Scenario: Approve a return request
- **WHEN** an admin sets the status of a requested return to "approved"
- **THEN** the system updates the return status to approved and appends a status history entry

#### Scenario: Reject a return request
- **WHEN** an admin sets the status of a requested return to "rejected"
- **THEN** the system updates the return status to rejected (terminal state) and appends a status history entry

#### Scenario: Receive an approved return
- **WHEN** an admin sets the status of an approved return to "received"
- **THEN** the system updates the return status to received and appends a status history entry

#### Scenario: Refund a received return
- **WHEN** an admin sets the status of a received return to "refunded"
- **THEN** the system updates the return status to refunded (terminal state) and appends a status history entry

#### Scenario: Cancel a requested return
- **WHEN** an admin sets the status of a requested return to "cancelled"
- **THEN** the system updates the return status to cancelled (terminal state) and appends a status history entry

#### Scenario: Reject invalid return status transition
- **WHEN** an admin attempts to set a rejected return directly to "refunded" (skipping required intermediate states)
- **THEN** the system rejects the transition with an error explaining the invalid transition
