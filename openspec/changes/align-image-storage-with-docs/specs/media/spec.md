# Spec Delta

## Purpose

Defines the behavior contract for local image storage: uploading images to a per-feature folder on the API server's disk, returning a media ID that products, categories, brands, and CMS banners can reference, and serving stored images back through the API.

## ADDED Requirements

### Requirement: Local image storage

The system SHALL store uploaded images as files under an `assets/` directory on the API server's disk, organized into subfolders by feature.

#### Scenario: Image saved under feature subfolder

- **WHEN** an image is uploaded for the `products` feature
- **THEN** the file is stored at `assets/products/<filename>` on disk

#### Scenario: Different features use separate subfolders

- **WHEN** images are uploaded for `products` and `categories` features
- **THEN** files are stored in separate `assets/products/` and `assets/categories/` subfolders

### Requirement: Storage adapter interface

The system SHALL expose all storage operations through an adapter interface so storage providers are swappable (hard rule 4). Credentials are per client and never committed.

#### Scenario: Adapter mediates all storage operations

- **WHEN** an image is uploaded, retrieved, or deleted
- **THEN** the operation goes through the adapter interface, not direct file system calls

### Requirement: Upload returns mediaId

The system SHALL create a `media_assets` database row on upload and return a `mediaId` that products, categories, brands, and CMS banners can reference.

#### Scenario: Upload response includes mediaId

- **WHEN** an image is uploaded successfully
- **THEN** the response includes a `mediaId` referencing the created `media_assets` row

#### Scenario: Media asset is referenceable by products

- **WHEN** a product is created with a `mediaId` from a prior upload
- **THEN** the product's media association references the stored image

### Requirement: Image retrieval by media ID

The system SHALL serve a stored image back to the caller when given its media ID.

#### Scenario: Serve stored image

- **WHEN** a request is made for a media asset by ID
- **THEN** the system returns the image file content with the correct MIME type

#### Scenario: Missing media returns not found

- **WHEN** a request is made for a media ID that does not exist
- **THEN** the system returns a not found error

### Requirement: No external storage dependency

The system SHALL NOT use Cloudflare R2, S3, or any external object storage for image storage.

#### Scenario: No Cloudflare references

- **WHEN** the media capability is implemented
- **THEN** no Cloudflare, R2, S3, or presigned URL code exists in the media module
