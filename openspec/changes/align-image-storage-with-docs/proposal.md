# Proposal

## Why

The project docs (`docs/openspec-ecommerce-instructions.md`, `docs/use-case-user-flow-architecture.md`, `docs/plan.md`, `docs/root-agent.md`) describe media storage as Cloudflare R2 — presigned uploads, a `media` capability with R2-backed object storage, and architecture diagrams showing R2 as the media store. But the implemented `add-nestjs-image-storage` change uses local disk storage under `assets/<feature>/` via direct multipart upload, with no `@nestjs/storage` adapter (incompatible with NestJS 11.x), no `media_assets` DB rows, no `mediaId` returned, and no adapter interface behind storage providers. The docs and the artifact contradict each other, and hard rule 4 (all storage providers sit behind adapter interfaces) is violated.

This change aligns the image-storage artifact with the documented instructions: update docs to reflect local store instead of R2, add a `media` capability spec (local file storage behind a pluggable adapter), return a `mediaId` so uploaded images can be associated with products/categories/banners, and introduce an adapter interface so storage providers remain swappable.

## What Changes

- `docs/openspec-ecommerce-instructions.md`: Tech stack Media line → local store; capability table row → `media` (local store, pluggable adapter); change plan row 12 → multipart upload to local store; open decisions add default media driver.
- `docs/use-case-user-flow-architecture.md`: R2 references → local image store; UC-15 storage target; architecture diagrams; MediaAsset provider enum.
- `docs/plan.md`: Item 9 → local image store.
- `docs/root-agent.md`: R2 bucket → media volume.
- New capability `media` spec (`specs/media/spec.md`): local file storage requirements with scenarios.
- Update `add-nestjs-image-storage` artifacts (proposal/design/specs/tasks) to reference the `media` capability, add adapter interface, return `mediaId`, create `media_assets` rows on upload.

## Capabilities

### New Capabilities

- `media`: Local file storage behind a pluggable adapter interface; upload returns `mediaId` for product/category/banner association; images stored under `assets/<feature>/`.

### Modified Capabilities

- None (no existing `media` spec under `openspec/specs/`).

## Impact

- Affected code: `apps/api/src/image-storage/` (adapter interface, `media_assets` row creation, `mediaId` in upload response), `docs/` (R2 → local store references).
- APIs: `POST /v1/image-storage/upload` returns `mediaId`; OpenAPI contract updated.
- Dependencies: none added.
- Database: `media_assets` rows created on upload (existing table, no migration).
- No breaking changes.

## Non-goals

- Cloudflare R2, S3, or any external object storage provider (implementation); R2 remains documented only as a future driver option and backup target.
- Image resizing, variants, or sharp processing.
- Background jobs or queues.
- Presigned direct-to-object-storage uploads.
