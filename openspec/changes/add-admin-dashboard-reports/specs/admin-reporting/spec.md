# Spec Delta

## Purpose

Lets store operators view sales, order, and low-stock metrics from the admin dashboard without querying the database directly.

## ADDED Requirements

### Requirement: Sales metrics
The system SHALL allow admins to view sales revenue, order count, and average order value for a configurable date range.

#### Scenario: View sales metrics for a date range
- **WHEN** an admin opens the sales metrics screen and selects a date range
- **THEN** the system displays total revenue, total order count, and average order value for that range

#### Scenario: Sales metrics with no orders
- **WHEN** an admin selects a date range with no orders
- **THEN** the system displays zero revenue, zero orders, and no average

### Requirement: Low-stock indicators
The system SHALL allow admins to view inventory variants whose stock is at or below their per-item low-stock threshold.

#### Scenario: View low-stock variants
- **WHEN** an admin opens the low-stock indicators screen
- **THEN** the system lists each variant with stock at or below its threshold, showing current stock and threshold

#### Scenario: No low-stock variants
- **WHEN** every variant is above its low-stock threshold
- **THEN** the system displays an empty state indicating no low-stock items
