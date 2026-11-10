# Tasks

## 1. Adapter interface and local implementation

- [x] 1.1 Define `StorageAdapter` interface (`put`, `get`, `delete`, `exists`, `getPublicUrl`) in `apps/api/src/image-storage/` and verify it compiles
- [x] 1.2 Implement `LocalStorageAdapter` using `node:fs` with keys `<yyyy>/<mm>/<uuid>/<variant>.webp` and verify put/get/delete/exists work against a temp directory

## 2. media_assets row and mediaId on upload

- [x] 2.1 Update upload service to create a `media_assets` row (provider: `local`, `storage_key`, `mime_type`, `size_bytes`) and verify the row is persisted
- [x] 2.2 Update upload response to return `mediaId` (the row's `id`) alongside existing fields and verify the response includes it
- [x] 2.3 Update OpenAPI contract for the new `mediaId` field and verify `pnpm contract:lint` passes

## 3. Docs updates (R2 → local store)

- [x] 3.1 Update `docs/openspec-ecommerce-instructions.md` tech stack Media line and capability table row to local store; verify no Cloudflare/R2 references remain
- [x] 3.2 Update `docs/use-case-user-flow-architecture.md` architecture diagrams, UC-15, and MediaAsset provider to local store; verify no R2 references remain
- [x] 3.3 Update `docs/plan.md` item 9 and `docs/root-agent.md` onboarding line to local media volume; verify no R2 references remain

## 4. Tests

- [x] 4.1 Write unit tests for `StorageAdapter` interface and `LocalStorageAdapter` (key generation, put/get/delete/exists, traversal rejection) and verify they pass
- [x] 4.2 Write integration test for upload returning `mediaId` and for serving by mediaId; verify they pass

## 5. Verification

- [x] 5.1 Run `pnpm --filter api lint` and `pnpm --filter api typecheck` and verify both pass
- [x] 5.2 Run `pnpm --filter api test` for image-storage tests and verify all pass
- [x] 5.3 Run `openspec validate align-image-storage-with-docs --strict` and verify validation passes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
