# Tasks

## 1. Orders screens

- [x] 1.1 Implement order list screen with status and date range filters using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 1.2 Implement order detail screen showing snapshots and lifecycle history; verify `pnpm --filter admin build` succeeds
- [x] 1.3 Implement order status change screen with valid transitions dropdown and server-enforced validation; verify `pnpm --filter admin build` succeeds
- [x] 1.4 Add UI tests for orders screens covering successful status transitions, invalid transition rejection, and API failures; verify `pnpm --filter admin test` passes

## 2. Returns screens

- [x] 2.1 Implement return request list screen using the shared API client; verify `pnpm --filter admin build` succeeds
- [x] 2.2 Implement return status change screen with valid transitions dropdown; verify `pnpm --filter admin build` succeeds
- [x] 2.3 Add UI tests for returns screens covering successful status transitions, invalid transition rejection, and API failures; verify `pnpm --filter admin test` passes

## 3. Integration and verification

- [x] 3.1 Wire all screens through the shared API client with permission guards matching API `x-required-permission` values; verify `pnpm --filter admin typecheck` passes
- [x] 3.2 Run `pnpm --filter admin lint` and fix any lint errors in new screens
- [x] 3.3 Verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass with existing SDK types

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
