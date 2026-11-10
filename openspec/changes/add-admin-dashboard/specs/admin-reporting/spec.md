# Spec Delta

## Purpose

Summarizes store sales, order activity, and stock risk so authorized administrators can monitor day-to-day operations.

## ADDED Requirements

### Requirement: Sales and order summary
The dashboard SHALL show sales and order metrics returned by the analytics API for the selected supported interval.

#### Scenario: Load analytics
- **WHEN** an administrator with analytics read permission opens the dashboard for a supported interval
- **THEN** the dashboard shows the corresponding server-provided sales and order metrics

#### Scenario: Analytics unavailable
- **WHEN** analytics cannot be loaded
- **THEN** the dashboard reports the failure and does not present stale values as current

### Requirement: Low-stock visibility
The dashboard SHALL identify low-stock items using inventory data and the configured stock threshold.

#### Scenario: Items below threshold
- **WHEN** inventory contains items at or below the configured low-stock threshold
- **THEN** the dashboard identifies those items and their available quantities

#### Scenario: No low-stock items
- **WHEN** no inventory items are at or below the configured threshold
- **THEN** the dashboard indicates that no low-stock items require attention

### Requirement: Reporting access control
The dashboard SHALL restrict sales and order analytics to administrators with analytics read permission.

#### Scenario: Analytics permission absent
- **WHEN** an administrator without analytics read permission opens the dashboard
- **THEN** protected sales and order metrics are not shown
