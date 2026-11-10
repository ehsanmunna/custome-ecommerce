# Tasks

## 1. Configure API base URL

- [x] 1.1 Update `defaultAdminAuthConfig` in `apps/admin/src/auth/auth.config.ts` to default `apiBaseUrl` to `http://localhost:3000`; verify `pnpm --filter admin typecheck` passes
- [x] 1.2 Update `apps/admin/src/app.config.ts` to read `ADMIN_API_BASE_URL` from `process.env` and override `apiBaseUrl` when set; verify `pnpm --filter admin typecheck` passes
- [x] 1.3 Add `ADMIN_API_BASE_URL` to `.env.example`; verify `pnpm --filter admin typecheck` passes

## 2. Verification

- [x] 2.1 Run `pnpm --filter admin build` and verify the admin build succeeds with the new default API base URL
- [x] 2.2 Run `pnpm --filter admin lint` and fix any lint errors in changed files
- [x] 2.3 Run `pnpm --filter admin test` and verify all existing admin tests pass
- [x] 2.4 Run `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` to verify no SDK impact

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
