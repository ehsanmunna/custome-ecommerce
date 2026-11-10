# Tasks

## 1. Remove R2 media-api implementation

- [ ] 1.1 Remove `apps/api/src/media/media-storage.r2.ts` (R2 storage adapter)
- [ ] 1.2 Remove `apps/api/src/media/media.service.ts` R2-based service
- [ ] 1.3 Remove `apps/api/src/media/media.controller.ts` R2-based controller (presigned upload/complete)
- [ ] 1.4 Remove `apps/api/src/media/media.module.ts` R2-based module
- [ ] 1.5 Remove `apps/api/src/media/media.schemas.ts` R2-based schemas
- [ ] 1.6 Remove `apps/api/src/media/media-storage.ts` StorageAdapter interface (R2-specific)
- [ ] 1.7 Remove R2 dependencies from `apps/api/package.json` (AWS SDK, presigner)
- [ ] 1.8 Remove R2 env vars from `.env.example` (`R2_*` variables)
- [ ] 1.9 Remove R2 references from `apps/api/README.md`

## 2. Keep and refine image-storage module

- [ ] 2.1 Keep `apps/api/src/image-storage/image-storage.module.ts`
- [ ] 2.2 Keep `apps/api/src/image-storage/image-storage.service.ts` (local storage, media_assets rows, mediaId return)
- [ ] 2.3 Keep `apps/api/src/image-storage/image-storage.controller.ts` (multipart upload)
- [ ] 2.4 Add `GET /v1/image-storage/list` endpoint for admin media listing
- [ ] 2.5 Register `ImageStorageModule` in `AppModule`

## 3. OpenAPI contract

- [ ] 3.1 Remove `POST /admin/media`, `POST /admin/media/{mediaId}/complete`, `DELETE /admin/media/{mediaId}`
- [ ] 3.2 Keep `POST /v1/image-storage/upload`, add `GET /v1/image-storage/list`
- [ ] 3.3 Remove `MediaUploadInstruction`, `MediaUploadCompleteRequest` schemas
- [ ] 3.4 Regenerate `packages/api-sdk`

## 4. Admin media integration

- [ ] 4.1 Connect product creation to accept `mediaId` references
- [ ] 4.2 Connect category/brand creation to accept `imageId` references
- [ ] 4.3 Add media listing to admin UI (media-list component)
- [ ] 4.4 Add media upload to admin product/category forms

## 5. Tests

- [ ] 5.1 Remove R2-specific tests (`media-storage.spec.ts`, `media-api.integration.spec.ts`)
- [ ] 5.2 Keep local storage tests (`image-storage.service.spec.ts`, `image-storage-api.integration.spec.ts`)
- [ ] 5.3 Add integration test for media listing
- [ ] 5.4 Run `pnpm --filter api test`

## 6. Verification

- [ ] 6.1 Run `pnpm --filter api lint` and `pnpm --filter api typecheck`
- [ ] 6.2 Run `pnpm contract:lint`, `pnpm contract:check`
- [ ] 6.3 Run `openspec validate remove-media-api-connect-image-storage --strict`

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.