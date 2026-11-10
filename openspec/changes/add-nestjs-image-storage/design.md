# Design

## Context

The API is a NestJS application versioned at `/v1` using PostgreSQL and Prisma. The `add-media-api` change previously described media storage via Cloudflare R2 with presigned URLs; this change supersedes that for simple local file storage. The API module structure follows NestJS conventions: modules, controllers, and services under `apps/api/src/`.

## Goals / Non-Goals

**Goals:**

- Store uploaded images locally on disk under `assets/<feature>/` using NestJS `@nestjs/storage`
- Serve stored images back via a REST endpoint given feature and filename
- Remove all Cloudflare R2 / external storage references from image storage artifacts
- Keep the implementation simple: one NestJS module, one service, one controller

**Non-Goals:**

- Image resizing, variants, or image processing
- External storage providers (Cloudflare R2, S3, B2, etc.)
- Presigned direct uploads or background jobs
- Database schema changes for file metadata

## Decisions

### Use `@nestjs/storage` for local file storage

**Decision:** Use `@nestjs/storage` instead of a custom `StorageAdapter` interface.

**Rationale:** `@nestjs/storage` is a NestJS-native abstraction for local file storage that handles file system operations, path resolution, and serving files out of the box. It keeps the implementation simple without custom adapter code.

**Alternatives considered:** Custom `StorageAdapter` with `fs` module (rejected: more code, reinvents what `@nestjs/storage` already provides); Cloudflare R2/S3 (rejected: external dependency, contradicts the local-first goal).

### Feature-based subfolders under `assets/`

**Decision:** Store images at `assets/<feature>/<filename>` where `<feature>` is a caller-supplied category (e.g., `products`, `categories`).

**Rationale:** Keeps files organized by feature without a database table for metadata. Simple and predictable paths.

**Alternatives considered:** Flat `assets/` folder (rejected: filename collisions across features); database-tracked storage keys (rejected: unnecessary schema change for this scope).

### API versioning at `/v1`

**Decision:** Mount image-storage endpoints under `/v1/image-storage/`.

**Rationale:** Consistent with the project's API versioning convention (API versioning at /v1).

**Alternatives considered:** Unversioned `/image-storage/` (rejected: inconsistent with project conventions).

## Risks / Trade-offs

[No database metadata] → Deleted files cannot be recovered unless tracked elsewhere; acceptable for v1 simplicity.

[Feature name as directory segment] → Caller-supplied feature names must be sanitized to prevent path traversal; validate feature names against an allowlist.

[No image processing] → Original files are stored as-is; consumers must handle display sizing.

## Migration Plan

1. Add `@nestjs/storage` to API package dependencies
2. Create `apps/api/src/image-storage/` module, service, controller
3. Mount endpoints under `/v1/image-storage/`
4. Remove Cloudflare R2 references from media-related artifacts
5. Deploy API with `assets/` volume mounted on the server

Rollback: Revert to the previous `add-media-api` R2-based implementation; no database migration is involved.

## Open Questions

None.
