# Spec Delta

## Purpose

Lets store operators manage CMS pages and banners through the admin dashboard.

## ADDED Requirements

### Requirement: CMS page management
The system SHALL allow admins to create, read, update, and delete CMS pages with Bangla/English translations, slug, SEO fields, and status.

#### Scenario: Create a CMS page
- **WHEN** an admin submits a page form with translations in at least one locale, slug, title, and status
- **THEN** the page is created and appears in the page list

#### Scenario: Update a CMS page
- **WHEN** an admin edits an existing page's title, slug, or status and saves
- **THEN** the page list reflects the updated values

#### Scenario: Delete a CMS page
- **WHEN** an admin deletes a CMS page
- **THEN** the page is removed from the page list

### Requirement: CMS banner management
The system SHALL allow admins to create, read, update, and delete banners with placement key, sort order, active status, media association, and translations.

#### Scenario: Create a banner
- **WHEN** an admin submits a banner form with placement key, sort order, active status, and translations in at least one locale
- **THEN** the banner is created and appears in the banner list

#### Scenario: Update a banner
- **WHEN** an admin edits an existing banner's placement, sort order, or active status and saves
- **THEN** the banner list reflects the updated values

#### Scenario: Delete a banner
- **WHEN** an admin deletes a banner
- **THEN** the banner is removed from the banner list
