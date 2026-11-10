# Tasks

## 1. Catalog screens

- [x] 1.1 Implement product list screen (list, search, create, edit, delete) using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 1.2 Implement category list and detail screen with parent/child hierarchy and bn/en translations; verify `pnpm --filter admin build` succeeds
- [x] 1.3 Implement brand list and detail screen (CRUD); verify `pnpm --filter admin build` succeeds
- [x] 1.4 Implement attribute definition screen per category; verify `pnpm --filter admin build` succeeds
- [x] 1.5 Implement variant creation screen driven by category attribute combinations; verify `pnpm --filter admin build` succeeds
- [x] 1.6 Implement media upload screen to Cloudflare R2 with product/variant association; verify `pnpm --filter admin build` succeeds
- [x] 1.7 Add UI tests for catalog screens covering successful saves, API validation failures, and upload failures; verify `pnpm --filter admin test` passes

## 2. Inventory screens

- [x] 2.1 Implement inventory listing screen with stock per variant and low-stock flags; verify `pnpm --filter admin build` succeeds
- [x] 2.2 Implement stock adjustment screen (increase/decrease with reason) with validation rejecting below-zero stock; verify `pnpm --filter admin build` succeeds
- [x] 2.3 Implement stock reservation screen (create, release, commit) with status lifecycle; verify `pnpm --filter admin build` succeeds
- [x] 2.4 Implement stock movements ledger view per variant; verify `pnpm --filter admin build` succeeds
- [x] 2.5 Add UI tests for inventory screens proving rejected adjustments do not change displayed quantities; verify `pnpm --filter admin test` passes

## 3. Integration and verification

- [x] 3.1 Wire all screens through the shared API client with permission guards matching API `x-required-permission` values; verify `pnpm --filter admin typecheck` passes
- [x] 3.2 Run `pnpm --filter admin lint` and fix any lint errors in new screens
- [x] 3.3 Verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass with existing SDK types

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
