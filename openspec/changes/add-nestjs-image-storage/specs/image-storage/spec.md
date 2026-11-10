# Spec Delta

## Purpose

Lets the API store uploaded images locally on disk under `assets/<feature>/` using NestJS `@nestjs/storage`, replacing external object storage.

## ADDED Requirements

### Requirement: Local image storage to asset folder

The system SHALL store uploaded images as files under an `assets/` directory on the API server's disk, organized into subfolders by feature.

#### Scenario: Image saved under feature subfolder

- **WHEN** an image is uploaded for the `products` feature
- **THEN** the file is stored at `assets/products/<filename>` on disk

#### Scenario: Different features use separate subfolders

- **WHEN** images are uploaded for `products` and `categories` features
- **THEN** files are stored in separate `assets/products/` and `assets/categories/` subfolders

### Requirement: Image retrieval by feature and filename

The system SHALL serve a stored image back to the caller when given its feature and filename.

#### Scenario: Serve stored image

- **WHEN** a request is made for an image at `assets/products/<filename>`
- **THEN** the system returns the image file content with the correct MIME type

### Requirement: No external storage dependency

The system SHALL NOT use Cloudflare R2, S3, or any external object storage for image storage.

#### Scenario: No Cloudflare references

- **WHEN** the image-storage capability is implemented
- **THEN** no Cloudflare, R2, S3, or presigned URL code exists in the image-storage module
