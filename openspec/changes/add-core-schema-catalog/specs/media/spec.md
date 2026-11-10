## Purpose

Defines the database metadata layer for uploaded media so catalog entities can reference images
without storing binaries in PostgreSQL. This supports plan.md item 9 (media handled by the API in a
later change) and item 23 (admin media management).

## ADDED Requirements

### Requirement: Media assets are referenced by provider and storage key

The system SHALL identify each media asset by a storage provider and a provider-assigned object key.
The binary object MUST live in external object storage, and the database MUST store only the key and
metadata.

#### Scenario: Media asset stored by key

- **WHEN** an asset is recorded for a Cloudflare R2 key
- **THEN** the provider and key are readable back without any binary content in PostgreSQL

#### Scenario: Duplicate storage key rejected

- **WHEN** two media assets are recorded with the same provider and key
- **THEN** the second write is rejected

### Requirement: Media metadata describes the stored object

Each media asset SHALL store its MIME type, byte size, and, for images, width and height in pixels.
Non-image assets MAY omit dimensions, and byte size or dimensions MUST NOT be negative.

#### Scenario: Image metadata stored

- **WHEN** an image asset is recorded with MIME type, byte size, width, and height
- **THEN** all four values are readable back

#### Scenario: Negative size rejected

- **WHEN** an asset is recorded with a negative byte size
- **THEN** the write is rejected

### Requirement: Media alt text is localized

Media assets SHALL support separate Bangla (`bn`) and English (`en`) alt text, with at most one alt
text row per asset per locale.

#### Scenario: Both alt text locales coexist

- **WHEN** an asset has `bn` and `en` alt text
- **THEN** both rows remain readable independently

#### Scenario: Duplicate alt text locale rejected

- **WHEN** a second `en` alt text row is written for the same asset
- **THEN** the write is rejected

### Requirement: Catalog entities associate with media

Products SHALL support multiple media associations and MUST have at most one primary image. A media
association MUST reference an existing media asset. Categories and brands SHALL each support an
optional image reference to an existing media asset.

#### Scenario: Product gallery with one primary image

- **WHEN** a product is linked to several images with exactly one marked primary
- **THEN** all links are stored and the primary image is identifiable

#### Scenario: Second primary image rejected

- **WHEN** a product already has a primary image and another primary image is linked
- **THEN** the second primary link is rejected

#### Scenario: Unknown media asset rejected

- **WHEN** a product is linked to a media asset that does not exist
- **THEN** the write is rejected

### Requirement: Media references do not outlive the asset record

Deleting a media asset SHALL remove its alt text and all catalog associations. The external object
MUST NOT be assumed deleted by the database layer; object cleanup is handled by the media API.

#### Scenario: Delete an associated media asset

- **WHEN** a media asset referenced by a product is deleted
- **THEN** the product-media association and alt text are removed
- **AND** the product itself remains
