# Spec Delta

## Purpose

Lets store operators manage shipping zones and coupons through the admin dashboard.

## ADDED Requirements

### Requirement: Shipping zone management
The system SHALL allow admins to create, read, update, and delete shipping zones with delivery fees and active status.

#### Scenario: Create a shipping zone
- **WHEN** an admin submits a shipping zone form with a unique code, name, fee, and active status
- **THEN** the shipping zone is created and appears in the shipping zone list

#### Scenario: Update a shipping zone
- **WHEN** an admin edits an existing shipping zone's fee or active status and saves
- **THEN** the shipping zone list reflects the updated values

#### Scenario: Delete a shipping zone
- **WHEN** an admin deletes a shipping zone
- **THEN** the shipping zone is removed from the shipping zone list

### Requirement: Coupon management
The system SHALL allow admins to create, read, update, and delete coupons with discount type, value, minimum order, validity window, and usage limits.

#### Scenario: Create a coupon
- **WHEN** an admin submits a coupon form with a unique code, discount type, value, start date, and expiry date
- **THEN** the coupon is created and appears in the coupon list

#### Scenario: Update a coupon
- **WHEN** an admin edits an existing coupon's discount value or active status and saves
- **THEN** the coupon list reflects the updated values

#### Scenario: Delete a coupon
- **WHEN** an admin deletes a coupon
- **THEN** the coupon is removed from the coupon list

### Requirement: Coupon date validation
The system SHALL reject coupon creation when the expiry date is not later than the start date.

#### Scenario: Reject invalid coupon date range
- **WHEN** an admin submits a coupon form with an expiry date earlier than or equal to the start date
- **THEN** the system rejects the request with a validation error
