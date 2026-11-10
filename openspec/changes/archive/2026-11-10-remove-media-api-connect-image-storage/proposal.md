# Proposal

## Why

The `add-media-api` change implemented Cloudflare R2-based presigned uploads (create-upload intent, client PUT to R2, complete via HeadObject). This adds operational complexity, client-managed credentials, and external storage dependency. The `add-nestjs-image-storage` change already implemented local multipart uploads with a `StorageAdapter` interface, `media_assets` rows, and `mediaId` returns. But nothing connects image uploads to the admin media feature — products, categories, brands, and CMS banners cannot reference uploaded media.

This change removes the R2-based `add-media-api` change entirely and connects the local `image-storage` capability to the admin media workflow: media listing for admin, media ID returned from uploads that products/categories/brands/CMS banners can reference.

## What Changes

- Remove `add-media-api` change: R2 storage adapter, presigned upload/complete/delete routes, R2 dependencies, R2 env vars, media permission grants
- Add `GET /v1/image-storage/list` endpoint to image-storage controller for admin media listing
- Connect image upload response `mediaId` to product/category/brand media associations in catalog
- Remove R2 from OpenAPI contract, `.env.example`, README, and docs

## Capabilities

### New Capabilities

- `image-storage`: Local file storage with upload, list, serve by media ID; media ID returned for product/category/brand/CMS banner association

### Removed Capabilities

- `media-api`: Cloudflare R2 presigned upload/complete/delete flow

### Modified Capabilities

- `media`: Now backed by local storage instead of R2; media rows created on upload, mediaId returned

## Impact

- Affected code: Remove `apps/api/src/media/media-storage.r2.ts`, `R2MediaStorage`, R2 routes; keep `image-storage` module; add media listing endpoint; wire image IDs into catalog/admin routes
- Contract: Remove `POST /admin/media`, `POST /admin/media/{mediaId}/complete`, `DELETE /admin/media/{mediaId}`; keep `POST /v1/image-storage/upload`, `GET /v1/image-storage/serve`, add `GET /v1/image-storage/list`
- Database: No migration needed; `media_assets` table already exists; `mediaProvider` enum needs `local` value (already added in `align-image-storage-with-docs`)
- Dependencies: Remove AWS SDK/R2 client packages; keep `node:fs` based local storage
- Env: Remove `R2_*` variables; keep `MEDIA_*` variables

## Non-goals

- Image resizing, variants, sharp processing
- Background jobs or queues
- Storefront media endpoints
- R2 bucket provisioning or lifecycle rules
- Editing existing media record metadata