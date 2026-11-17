# Spec Delta

## ADDED Requirements

### Requirement: Dashboard widget permission gating

The dashboard SHALL render each widget only when the administrator holds the permission its data requires and SHALL not request data for a widget the administrator cannot access.

#### Scenario: Analytics widgets require analytics permission

- **WHEN** an administrator holds `analytics.read`
- **THEN** the order and revenue stat cards, revenue chart, and top-products widget are shown

#### Scenario: Order widgets require order permission

- **WHEN** an administrator holds `orders.read`
- **THEN** the recent-orders and order-status widgets are shown

#### Scenario: Inventory widgets require inventory permission

- **WHEN** an administrator holds `inventory.read`
- **THEN** the low-stock count and low-stock alerts widgets are shown

#### Scenario: Customer widget requires customer permission

- **WHEN** an administrator holds `customers.read`
- **THEN** the new-customers widget is shown

#### Scenario: Mixed permissions

- **WHEN** an administrator holds some dashboard permissions but not others
- **THEN** only the permitted widgets are shown, restricted widgets show no protected values, and no request for a restricted widget produces a dashboard failure

#### Scenario: No dashboard permission

- **WHEN** the current snapshot grants no dashboard data permission
- **THEN** no protected metric or order detail is rendered
