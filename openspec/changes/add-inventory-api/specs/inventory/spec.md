# Spec Delta

## Purpose

Provides inventory management for products across multiple locations, including warehouse definitions, inventory tracking, availability calculation, and location-based pricing.

## ADDED Requirements

### Requirement: Inventory CRUD operations
The system SHALL allow administrators to create, read, update, and delete inventory records for products at warehouses. Each inventory item MUST belong to a valid warehouse and product. Inventory quantity can be modified via PUT requests.

#### Scenario: Create inventory item
- **WHEN** administrator sends POST to `/api/inventory/products/<product-id>`
- **THEN** system creates inventory item with initial quantity and returns 201 status

#### Scenario: Update inventory quantity
- **WHEN** administrator sends PUT to `/api/inventory/products/<product-id>` with new quantity
- **THEN** system updates inventory item and returns 200 status with updated data

#### Scenario: Delete inventory item
- **WHEN** administrator sends DELETE to `/api/inventory/products/<product-id>`
- **THEN** system deletes inventory item and returns 204 status

### Requirement: Availability calculation
The system SHALL calculate product availability based on inventory status. A product is available for purchase only when inventory quantity exceeds zero for all applicable warehouses. Availability status must be returned in product detail responses.

#### Scenario: Calculate available product
- **WHEN** product has inventory quantity greater than zero
- **THEN** system returns `inventory_status: 'available'` in product detail response

#### Scenario: Calculate unavailable product
- **WHEN** product has inventory quantity of zero at all warehouses
- **THEN** system returns `inventory_status: 'unavailable'` in product detail response

#### Scenario: Calculate partially available product
- **WHEN** product has inventory quantity greater than zero at some warehouses but not all
- **THEN** system returns `inventory_status: 'partially_available'` in product detail response

### Requirement: Warehouse management
The system SHALL allow administrators to define and manage warehouses. Each warehouse has a name, location, and description. Warehouses must have unique names and cannot be deleted when active inventory exists.

#### Scenario: Create warehouse
- **WHEN** administrator sends POST to `/api/inventory/warehouses` with valid data
- **THEN** system creates warehouse and returns 201 status

#### Scenario: Create warehouse with duplicate name
- **WHEN** administrator sends POST with a name that already exists
- **THEN** system returns 409 status with validation error

#### Scenario: Delete warehouse with inventory
- **WHEN** administrator sends DELETE to `/api/inventory/warehouses/<warehouse-id>`
- **AND** warehouse has active inventory items
- **THEN** system returns 403 status with message indicating inventory dependency

### Requirement: Inventory validation on checkout
The system SHALL validate product inventory before processing checkout requests. A product must have positive inventory quantity at the selected warehouse. Checkout requests to unavailable products MUST be rejected.

#### Scenario: Checkout with available product
- **WHEN** user sends POST to `/api/checkout` with product ID and warehouse ID where inventory exists
- **THEN** checkout proceeds with inventory validation passing

#### Scenario: Checkout with unavailable product
- **WHEN** user sends POST to `/api/checkout` with product ID where inventory quantity is zero
- **THEN** system returns 400 status with inventory validation error

#### Scenario: Checkout with missing warehouse
- **WHEN** user sends POST to `/api/checkout` with product ID and non-existent warehouse ID
- **THEN** system returns 404 status with warehouse not found error

## MODIFIED Requirements

### Requirement: Product availability
**MODIFIED**: Product availability is now determined by inventory status rather than product status. Products with inventory quantity greater than zero are considered available regardless of their product status field. Product availability for purchase must check inventory status first.

#### Scenario: Available product with inactive status
- **WHEN** product has inventory quantity greater than zero but product status is `inactive`
- **THEN** product is still considered available for purchase

#### Scenario: Unavailable product with active status
- **WHEN** product has inventory quantity of zero but product status is `active`
- **THEN** product is NOT available for purchase

### Requirement: Product detail response
**MODIFIED**: Product detail response MUST include inventory status information. The response MUST contain a new field `inventory_status` with possible values: `available`, `unavailable`, or `partially_available`. The response MUST contain `inventory_items` array listing warehouse-specific inventory data.

#### Scenario: Product detail with inventory
- **WHEN** GET request to `/api/products/<product-id>` for product with inventory
- **THEN** response includes `inventory_status: 'available'` and `inventory_items` array with warehouse details