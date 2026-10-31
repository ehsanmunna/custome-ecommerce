# Spec Delta

## Purpose

Lets store administrators configure operational settings and manage the delivery and promotional content presented by the store.

## ADDED Requirements

### Requirement: Store settings
The dashboard SHALL let authorized administrators view and update non-secret store settings supported by the settings API.

#### Scenario: Update store settings
- **WHEN** an administrator with settings update permission submits valid setting values
- **THEN** the dashboard displays the server-confirmed values

#### Scenario: Secret setting protection
- **WHEN** settings are displayed or updated
- **THEN** secret credentials are not exposed in the dashboard

### Requirement: Shipping zone management
The dashboard SHALL let authorized administrators view and maintain delivery zones and their district mappings using the shipping-zone API.

#### Scenario: Update delivery zone
- **WHEN** an administrator with the required shipping-zone permission saves a valid zone change
- **THEN** the dashboard displays the server-confirmed zone and district mapping

#### Scenario: Zone update rejected
- **WHEN** the API rejects a zone change
- **THEN** the dashboard retains the last confirmed zone data and reports the failure

### Requirement: Coupon management
The dashboard SHALL let authorized administrators list and maintain coupons using the coupon API and its validation rules.

#### Scenario: Create or update coupon
- **WHEN** an administrator with the required coupon permission submits a valid coupon
- **THEN** the dashboard shows the server-confirmed coupon

#### Scenario: Coupon cannot be deleted
- **WHEN** the API rejects coupon deletion because the coupon has redemptions or another constraint
- **THEN** the dashboard keeps the coupon visible and explains that deletion did not complete

### Requirement: CMS page and banner management
The dashboard SHALL let authorized administrators create, update, list, and delete CMS pages and banners supported by the CMS API.

#### Scenario: Manage localized content
- **WHEN** an administrator edits a page or banner with localized content
- **THEN** the dashboard lets them review and save the available translations without silently dropping existing locales

#### Scenario: CMS action denied
- **WHEN** an administrator lacks the permission required for a CMS action
- **THEN** the action is unavailable or the API rejection is reported without showing an unsaved change as complete
