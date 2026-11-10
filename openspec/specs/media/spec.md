# media Specification

## Purpose

Replaces Cloudflare R2-based media storage (media-api) with local image storage (image-storage) and connects media uploads to admin media features: product category/brand image association, media listing in admin, and media references in catalog content.

## Requirements

### Requirement: Media listing for admin

The system SHALL provide a list of uploaded media assets for admin management.

#### Scenario: List media assets

- **WHEN** an admin requests media list
- **THEN** the system returns media assets with mediaId, key, URL, MIME type, size, and created timestamp

### Requirement: Media association with catalog entities

The system SHALL allow media IDs to be associated with products, categories, brands, and CMS banners.

#### Scenario: Product references media

- **WHEN** a product is created or updated with a mediaId
- **THEN** the product references the uploaded media asset

#### Scenario: Category references media

- **WHEN** a category is created or updated with an imageId
- **THEN** the category references the uploaded media asset

### Requirement: Serve media by ID

The system SHALL serve a stored image when given its media ID (not just storage key).

#### Scenario: Serve by media ID

- **WHEN** a request is made with a valid mediaId
- **THEN** the system returns the image file content
