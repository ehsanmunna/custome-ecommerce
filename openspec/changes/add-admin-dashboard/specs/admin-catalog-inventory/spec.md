# Spec Delta

## Purpose

Lets store staff maintain the product catalog and inventory through administrative workflows backed by the store API.

## ADDED Requirements

### Requirement: Product and category management
The dashboard SHALL let authorized administrators list and maintain products, variants, brands, categories, and category attribute definitions using the API's supported operations.

#### Scenario: Attribute-driven product form
- **WHEN** an administrator creates or edits a product in a category with attribute definitions
- **THEN** the form presents the applicable attributes and validates required values before submission

#### Scenario: Save catalog changes
- **WHEN** an authorized administrator submits valid catalog changes
- **THEN** the dashboard shows the saved server representation and reflects it in the relevant list

#### Scenario: Catalog validation error
- **WHEN** the API rejects catalog input
- **THEN** the dashboard identifies the rejected input where possible and does not show the change as saved

### Requirement: Product media management
The dashboard SHALL let authorized administrators associate uploaded media with catalog content using the media API's upload lifecycle.

#### Scenario: Complete media upload
- **WHEN** an administrator uploads an allowed media asset and the upload completes successfully
- **THEN** the dashboard makes the resulting media asset available for association with catalog content

#### Scenario: Failed media upload
- **WHEN** media upload or completion fails
- **THEN** the dashboard reports the failure and does not present the incomplete asset as available

### Requirement: Inventory visibility and adjustment
The dashboard SHALL display inventory and reservation information and let authorized administrators submit stock adjustments through the inventory API.

#### Scenario: Review stock
- **WHEN** an administrator with inventory read permission opens inventory
- **THEN** the dashboard shows current stock and reservation information returned by the API

#### Scenario: Adjust stock
- **WHEN** an authorized administrator submits a valid stock adjustment with its reason
- **THEN** the dashboard displays the server-confirmed quantity and adjustment result

#### Scenario: Adjustment denied or rejected
- **WHEN** the API rejects an adjustment because of permission or validation
- **THEN** the dashboard preserves the current displayed stock and reports that the adjustment did not complete
