# Tasks

## 1. Settings screens

- [x] 1.1 Implement shipping zone list screen (list, create, edit, delete) using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 1.2 Implement coupon list screen (list, create, edit, delete) using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 1.3 Add UI tests for settings screens covering successful saves, API validation failures (e.g., invalid coupon date range, duplicate zone code), and permission-denied scenarios; verify `pnpm --filter admin test` passes

## 2. CMS screens

- [x] 2.1 Implement page list screen (list, create, edit, delete) using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 2.2 Implement banner list screen (list, create, edit, delete) using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 2.3 Add UI tests for CMS screens covering successful saves, API validation failures, and permission-denied scenarios; verify `pnpm --filter admin test` passes

## 3. Integration and verification

- [x] 3.1 Wire all screens through the shared API client with permission guards matching API `x-required-permission` values; verify `pnpm --filter admin typecheck` passes
- [x] 3.2 Run `pnpm --filter admin lint` and fix any lint errors in new screens
- [x] 3.3 Verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass with existing SDK types

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
