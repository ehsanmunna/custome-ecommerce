# Tasks

## 1. Reporting API operations

- [x] 1.1 Sales metrics API already provided by existing `GET /admin/analytics/sales` (permission: `analytics.read`); verify `pnpm --filter api build` succeeds
- [x] 1.2 Low-stock indicators API already provided by existing `GET /admin/inventory?lowStock=true` (permission: `inventory.read`); verify `pnpm --filter api build` succeeds
- [x] 1.3 Add API tests for existing analytics and inventory endpoints covering successful reads, empty results, and permission denial; verify focused API tests pass

## 2. Admin reporting screens

- [x] 2.1 Implement sales metrics screen using the shared API client with permission guard; verify `pnpm --filter admin build` succeeds
- [x] 2.2 Implement low-stock indicators screen using the shared API client with permission guard; verify `pnpm --filter admin build` succeeds

## 3. Routes, guards, and verification

- [x] 3.1 Wire reporting screens through app routes with `analytics.read` / `inventory.read` permission guards matching API `x-required-permission` values; verify `pnpm --filter admin typecheck` passes
- [x] 3.2 Add UI tests for reporting screens covering successful loads, permission denial, empty results, and API errors; verify `pnpm --filter admin test` passes
- [x] 3.3 Run `pnpm --filter admin lint` and fix any lint errors in new screens
- [x] 3.4 Verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
