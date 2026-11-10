# Design

## Context

The `add-nestjs-image-storage` change implemented local file storage with a `StorageAdapter` interface, multipart upload, `media_assets` DB rows, and `mediaId` returns. The `add-media-api` change implemented R2-based presigned uploads that conflict with the local design. This change removes the R2 implementation and connects local image storage to the admin media workflow.

## Goals / Non-Goals

**Goals:**

- Remove all R2-based media code (storage adapter, routes, env vars, SDK types, docs)
- Keep the `image-storage` multipart upload endpoint (`POST /v1/image-storage/upload`)
- Add media listing endpoint (`GET /v1/image-storage/list`) for admin
- Connect media IDs to product/category/brand/CMS banner associations
- Remove `media-api` routes (`POST /admin/media`, `POST /admin/media/{mediaId}/complete`, `DELETE /admin/media/{mediaId}`)

**Non-Goals:**

- Image resizing or processing
- R2 bucket provisioning or cleanup
- Storefront media endpoints
- Background jobs or queues

## Decisions

### Remove `add-media-api` entirely

**Decision:** Delete the R2-based `media-api` change implementation and its artifacts.

**Rationale:** The local `image-storage` implementation supersedes it. Keeping both creates confusion and maintenance burden.

**Alternative considered:** Keep both flows side-by-side. Rejected — two upload paths with different contracts is confusing.

### Serve media by ID, not key

**Decision:** The serving endpoint accepts a `mediaId` (database ID), not a storage key. The server looks up the storage key from `media_assets` and serves the file.

**Rationale:** Media records are the authoritative reference; clients work with media IDs, not storage keys.

**Alternative considered:** Serve by storage key directly. Rejected — keys are internal implementation details.

### Product/category/brand media association

**Decision:** Media IDs from uploads can be passed to catalog creation/update endpoints as `mediaId` or `imageId` references.

**Rationale:** `media_assets` rows already exist and are referenced by catalog tables.

## Risks / Trade-offs

- Orphaned files if upload succeeds but DB row creation fails → deferred cleanup sweep
- Cache invalidation after delete → immutable keys + long TTLs acceptable for v1

## Migration Plan

1. Remove `add-media-api` code (R2 storage, routes, env vars, SDK types, docs)
2. Verify `image-storage` module works with `media_assets` table
3. Add media listing endpoint
4. Wire media IDs into catalog associations
5. Deploy; removing R2 code is safe if R2 was not configured

## Open Questions

None.