# product-controller Specification

## Purpose

Defines dedicated product controllers for storefront and admin with role-based access control, separating product routing from the combined catalog controllers.

## Requirements

### Requirement: Storefront product listing is publicly readable
The system SHALL provide a paginated public product list route on the storefront controller. The response SHALL include page metadata and stable ordering. Unauthenticated storefront callers MAY read products; no write operations are exposed on the storefront product controller.

#### Scenario: List products from storefront
- **WHEN** a guest requests the storefront product list with pagination
- **THEN** the response returns active products with page metadata

#### Scenario: Storefront rejects product writes
- **WHEN** a caller attempts POST, PATCH, or DELETE on the storefront product controller
- **THEN** the API returns a method-not-allowed or forbidden response

### Requirement: Admin has full product CRUD
The system SHALL provide create, read, update, and delete product operations on the admin product controller. Product creation and update SHALL support attaching previously uploaded media assets, with at most one marked as primary. Admin callers with the required permission and scope SHALL perform all four operations subject to catalog validation.

#### Scenario: Admin creates a product
- **WHEN** an authorized admin submits a valid product creation request
- **THEN** the product is created and returned

#### Scenario: Admin creates a product with media
- **WHEN** an authorized admin submits a valid product creation request with one or more media IDs and at most one marked primary
- **THEN** the product is created with the media assets attached

#### Scenario: Admin reads a product
- **WHEN** an authorized admin requests a product by ID
- **THEN** the API returns the product detail including attached media

#### Scenario: Admin updates a product
- **WHEN** an authorized admin submits a valid product update request
- **THEN** the product is updated and returned

#### Scenario: Admin updates a product media
- **WHEN** an authorized admin submits a valid product update request with updated media IDs
- **THEN** the product media attachments are replaced with the new set

#### Scenario: Admin deletes a product
- **WHEN** an authorized admin deletes a product that has no dependent references
- **THEN** the product is removed and no content is returned

### Requirement: Staff can create products only
The system SHALL restrict staff callers on the admin product controller to the create operation. Staff SHALL NOT read, update, or delete products through the dedicated product controller.

#### Scenario: Staff creates a product
- **WHEN** an authorized staff caller submits a valid product creation request
- **THEN** the product is created and returned

#### Scenario: Staff cannot read products
- **WHEN** a staff caller requests a product list or product detail
- **THEN** the API returns a forbidden response

#### Scenario: Staff cannot update products
- **WHEN** a staff caller submits a product update request
- **THEN** the API returns a forbidden response

#### Scenario: Staff cannot delete products
- **WHEN** a staff caller submits a product delete request
- **THEN** the API returns a forbidden response

### Requirement: Manager can do everything except delete
The system SHALL allow manager callers on the admin product controller to create, read, and update products but NOT delete them. Manager SHALL be blocked from delete with a forbidden response.

#### Scenario: Manager creates a product
- **WHEN** an authorized manager submits a valid product creation request
- **THEN** the product is created and returned

#### Scenario: Manager reads a product
- **WHEN** an authorized manager requests a product by ID
- **THEN** the API returns the product detail

#### Scenario: Manager updates a product
- **WHEN** an authorized manager submits a valid product update request
- **THEN** the product is updated and returned

#### Scenario: Manager cannot delete a product
- **WHEN** an authorized manager submits a product delete request
- **THEN** the API returns a forbidden response and the product is preserved
