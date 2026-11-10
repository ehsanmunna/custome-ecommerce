# Design

## Context

The `add-nestjs-image-storage` change implemented local file storage using Node.js `fs` directly under `assets/<feature>/`, but `@nestjs/storage` is incompatible with NestJS 11.x (requires ^12.1.0). The artifact does not create `media_assets` DB rows, does not return a `mediaId`, and has no adapter interface — so uploaded images cannot be referenced by products, categories, brands, or CMS banners, and hard rule 4 (storage providers behind adapter interfaces) is violated. The project docs still describe media storage as Cloudflare R2.

This change aligns the artifact with the docs: add an adapter interface, create `media_assets` rows on upload, return `mediaId`, and update all R2 references in docs to local store.

## Goals / Non-Goals

**Goals:**

- Add a `StorageAdapter` interface (`put`, `get`, `delete`, `exists`, `getPublicUrl`) behind which all storage providers sit
- Create `media_assets` database row on upload and return `mediaId`
- Allow `mediaId` to be passed in product/category/brand CMS banner creation
- Update `docs/` to describe local store instead of Cloudflare R2
- Keep `add-nestjs-image-storage` implementation intact where compatible

**Non-Goals:**

- Implement an `s3` or R2 driver (documented as future only)
- Image resizing, variants, or sharp processing
- Presigned direct-to-object-storage uploads
- Database migrations (no schema change needed)

## Decisions

### Adapter interface replaces direct fs calls

**Decision:** Define a `StorageAdapter` interface (`put`, `get`, `delete`, `exists`, `getPublicUrl`) and implement a `LocalStorageAdapter` using `node:fs`. All storage operations go through the interface.

**Rationale:** Satisfies hard rule 4 (providers behind adapter interfaces). Keeps provider-specific behavior isolated so `s3`/`R2` can be added later without changing the media module.

**Alternatives considered:** Direct `fs` calls (current state, rejected — violates hard rule 4); `@nestjs/storage` (rejected — incompatible with NestJS 11.x).

### `media_assets` row created on upload

**Decision:** The upload endpoint inserts a `media_assets` row (provider: `local`, `storage_key`: the key, `mime_type`, `size_bytes`, dimensions) and returns the generated `mediaId` (the row's `id`).

**Rationale:** Products, categories, brands, and CMS banners reference `media_assets.id` as `mediaId`. Without a row, no `mediaId` exists to pass.

**Alternatives considered:** Returning only a URL/filename (current state, rejected — cannot be associated with products); generating a UUID without a DB row (rejected — no authoritative record).

### Key layout

**Decision:** Keys are `<yyyy>/<mm>/<uuid>/<variant>.webp` under `MEDIA_LOCAL_ROOT`, matching the existing `add-media-api` design. User-supplied filenames never appear in paths.

**Rationale:** Prevents path traversal; consistent with the existing project decision for media storage.

### Docs updates mirror the artifact

**Decision:** Update `docs/openspec-ecommerce-instructions.md`, `docs/use-case-user-flow-architecture.md`, `docs/plan.md`, and `docs/root-agent.md` to replace Cloudflare R2 references with local image store. R2 remains documented only as a future driver option and backup target.

**Rationale:** The docs describe the intended system state; the artifact must match.

## Risks / Trade-offs

[Orphaned files if API crashes mid-upload] → Files are written before the DB row; a startup sweep can remove directories without a matching record (deferred to a later change).

[Cache invalidation after delete] → Immutable keys plus long TTLs mean deleted images may stay cached until TTL expiry; acceptable for v1 media.

[mediaId contract change] → The upload response shape changes (adds `mediaId`); clients consuming the old shape must update. This is additive, not breaking, per hard rule 8.

## Migration Plan

1. Add `StorageAdapter` interface and `LocalStorageAdapter` implementation to `apps/api/src/image-storage/`
2. Update upload controller/service to create `media_assets` row and return `mediaId`
3. Update OpenAPI contract for the new `mediaId` field
4. Update `docs/` R2 references to local store
5. Deploy API; additive contract change is harmless if reverted

Rollback: revert the API deployment; additive contract changes are harmless. Do not delete media files or DB rows during rollback.

## Open Questions

None.
