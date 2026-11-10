# Spec Delta

## ADDED Requirements

### Requirement: Dashboard overview page

The admin application SHALL provide a single dashboard overview page that combines operational metrics and lists for the signed-in administrator. The page SHALL use a responsive grid with four stat cards on top, two-column widget rows below, and a single-column stack on mobile.

#### Scenario: All widgets render

- **WHEN** an administrator with the required permissions opens the dashboard
- **THEN** the page shows the stat cards, revenue chart, recent orders, top-selling products, order-status chart, and low-stock alerts

#### Scenario: Responsive layout

- **WHEN** the dashboard is viewed on a narrow viewport
- **THEN** the stat cards and widget rows stack into a single column without horizontal scrolling

### Requirement: Dashboard stat cards

The dashboard SHALL show four stat cards: orders today, revenue today, new customers, and low-stock items. Each card SHALL show a value and an icon, and SHALL show a comparison with yesterday when the source data provides one.

#### Scenario: Today and yesterday comparison

- **WHEN** today's and yesterday's values are available
- **THEN** the card shows the current value and the change from yesterday with its direction

#### Scenario: Comparison unavailable

- **WHEN** a source does not provide a yesterday value
- **THEN** the card shows an explicit unavailable indicator instead of a fabricated change

### Requirement: Revenue range selection

The revenue chart SHALL support 7-day, 30-day, and 90-day ranges. Changing the range SHALL reload the chart without a page reload and SHALL keep the rest of the dashboard visible.

#### Scenario: Change the revenue range

- **WHEN** the administrator selects 30 days or 90 days
- **THEN** the chart requests and displays the revenue series for that range

#### Scenario: Default range

- **WHEN** the dashboard first loads
- **THEN** the revenue chart uses the 7-day range

### Requirement: Recent orders widget

The dashboard SHALL show between five and ten recent orders with order number, customer name, status, total, and creation time. Each row SHALL link to the corresponding order detail page.

#### Scenario: Recent orders are listed

- **WHEN** orders exist
- **THEN** the widget lists the most recent orders with a status badge and a working detail link

#### Scenario: No recent orders

- **WHEN** no orders exist
- **THEN** the widget shows an empty state instead of an empty table

### Requirement: Top-selling products widget

The dashboard SHALL show a ranked list of top-selling products for the selected revenue period, including product name and units sold.

#### Scenario: Ranked product list

- **WHEN** product sales data is available
- **THEN** the widget lists products in descending order of units sold

#### Scenario: No product sales

- **WHEN** no product sales data is available
- **THEN** the widget shows an empty state

### Requirement: Order status distribution widget

The dashboard SHALL show the current count of orders in each lifecycle status as a doughnut chart with a legend.

#### Scenario: Status counts are shown

- **WHEN** orders exist in one or more statuses
- **THEN** the chart shows one segment per status with the count in the legend

#### Scenario: No orders

- **WHEN** the store has no orders
- **THEN** the widget shows an empty state instead of an empty chart

### Requirement: Low-stock alerts widget

The dashboard SHALL list inventory variants at or below their low-stock threshold, showing the product name or SKU, available quantity, and threshold, and SHALL link to the inventory screen.

#### Scenario: Low-stock variants are listed

- **WHEN** variants are at or below their threshold
- **THEN** the widget lists them with available quantity and threshold and links to inventory

#### Scenario: No low-stock variants

- **WHEN** every variant is above its threshold
- **THEN** the widget shows an empty state indicating no low-stock items

### Requirement: Dashboard widget states

Every dashboard widget SHALL provide a loading skeleton, an empty state, and an error state with a retry action. A failing widget SHALL not prevent the other widgets from rendering.

#### Scenario: Loading state

- **WHEN** a widget is waiting for its data
- **THEN** it shows a skeleton placeholder with the widget's approximate shape

#### Scenario: Empty state

- **WHEN** a widget receives no records
- **THEN** it shows a translated empty message

#### Scenario: Error state

- **WHEN** a widget's request fails
- **THEN** it shows a translated error message and a retry action that reloads only that widget

#### Scenario: Failure isolation

- **WHEN** one widget fails
- **THEN** the other widgets still render their own data or states

### Requirement: Dashboard permission gating

A dashboard widget SHALL be shown only when the signed-in administrator has the permission required by the widget's source data. An unauthorized widget SHALL be hidden or replaced with a restricted state rather than exposing its data.

#### Scenario: Analytics permission absent

- **WHEN** an administrator lacks analytics read permission
- **THEN** revenue and sales widgets are not shown

#### Scenario: Orders permission absent

- **WHEN** an administrator lacks orders read permission
- **THEN** recent-order and order-status widgets are not shown

#### Scenario: Inventory permission absent

- **WHEN** an administrator lacks inventory read permission
- **THEN** low-stock widgets are not shown

### Requirement: Sample-data disclosure

A widget that cannot be backed by a contract operation SHALL use the same service interface as a real widget and SHALL visibly identify its data as sample data. The label SHALL come from the translation catalogs.

#### Scenario: Sample-data badge

- **WHEN** a widget renders sample data
- **THEN** it shows a translated sample-data label near the widget content

#### Scenario: Real data has no sample label

- **WHEN** a widget renders data from a contract operation
- **THEN** it does not show the sample-data label
