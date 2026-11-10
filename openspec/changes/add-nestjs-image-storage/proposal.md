# Proposal

## Why

Image uploads currently depend on Cloudflare R2 (external object storage) and presigned URLs, adding operational complexity and client-managed credentials. The change replaces this with simple local file storage using NestJS `@nestjs/storage`, saving images to an `assets/` folder on the API server's disk, organized into subfolders by feature (e.g., `assets/products/`, `assets/categories/`). This removes the external storage dependency entirely and keeps image handling self-contained.

## What Changes

- Add `@nestjs/storage` dependency to the API package
- Create `image-storage` NestJS module with service and controller for local file upload/retrieval
- Store images under `assets/` with feature-based subfolders (`<feature>/<filename>`)
- Remove Cloudflare R2 / external storage references from media artifacts and docs
- Add OpenAPI contract for image upload/retrieval endpoints

## Capabilities

### New Capabilities

- `image-storage`: Local file storage using `@nestjs/storage`, images saved to `assets/<feature>/`, served back via API

### Modified Capabilities

- None

## Impact

- Affected code: New `image-storage` module/service/controller in `apps/api/src/image-storage/`
- Dependencies: `@nestjs/storage` added to API
- APIs: `POST /v1/image-storage/upload`, `GET /v1/image-storage/serve/<feature>/<filename>`
- No database changes; files stored on disk only
- Removes Cloudflare R2 / external storage dependency

## Non-goals

- Cloudflare R2, S3, or any external object storage provider
- Image resizing, variants, or sharp processing
- Background jobs or queues
- Presigned direct-to-object-storage uploads
- Authentication/authorization integration beyond existing admin guard
