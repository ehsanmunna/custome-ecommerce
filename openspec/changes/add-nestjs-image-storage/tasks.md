# Tasks

## 1. Dependencies

- [x] 1.1 Add `@nestjs/storage` dependency to `apps/api/package.json` and verify `pnpm install` succeeds
- [x] 1.2 Create `assets/` directory structure on disk and verify `assets/products/` and `assets/categories/` can be created

## 2. Image Storage Module

- [x] 2.1 Create `apps/api/src/image-storage/image-storage.module.ts` NestJS module and verify it compiles
- [x] 2.2 Implement `ImageStorageService` using `@nestjs/storage` to save files under `assets/<feature>/` and verify files are written to disk
- [x] 2.3 Implement `ImageStorageController` with `POST /v1/image-storage/upload` and `GET /v1/image-storage/serve/:feature/:filename` and verify routes register
- [x] 2.4 Register `ImageStorageModule` in `AppModule` and verify the API starts without errors

## 3. OpenAPI Contract

- [x] 3.1 Add `POST /v1/image-storage/upload` and `GET /v1/image-storage/serve/:feature/:filename` to `openapi.yaml` and verify `pnpm contract:lint` passes
- [x] 3.2 Verify `pnpm contract:check` passes

## 4. Tests

- [x] 4.1 Write unit tests for `ImageStorageService` verifying file save and retrieval under `assets/<feature>/`
- [x] 4.2 Write integration tests for upload and serve endpoints verifying status codes and file content
- [x] 4.3 Run `pnpm --filter api test` and verify all image-storage tests pass

## 5. Remove Cloudflare References

- [x] 5.1 Remove Cloudflare R2 / external storage references from image storage artifacts and docs and verify no Cloudflare/R2/S3 references remain in `apps/api/src/image-storage/`

## 6. Verification

- [x] 6.1 Run `pnpm --filter api lint` and `pnpm --filter api typecheck` and verify both pass
- [x] 6.2 Run `openspec validate add-nestjs-image-storage --strict` and verify validation passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
