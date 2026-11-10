# Spec Delta

## MODIFIED Requirements

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
