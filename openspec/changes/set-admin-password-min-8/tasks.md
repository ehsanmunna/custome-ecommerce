# Tasks

## 1. API password rule

- [x] 1.1 Lower `adminUserCreateSchema.password` from `min(10)` to `min(8)` and update its message to "Password must be at least 8 characters" in `apps/api/src/admin-users/admin-users.schemas.ts`; verify with `pnpm --filter api typecheck`.
- [x] 1.2 Add `apps/api/test/admin-users.schemas.spec.ts` covering a 7-character password rejected and an 8-character password accepted through `adminUserCreateSchema.safeParse`; verify with `pnpm --filter api exec vitest run test/admin-users.schemas.spec.ts`.

## 2. Admin dashboard form

- [x] 2.1 Change the create-mode password validator to `Validators.minLength(8)` and update the error text to "Password must be at least 8 characters." in `apps/admin/src/users/admin-users-list.component.ts`; verify with `pnpm --filter admin typecheck`.
- [x] 2.2 Extend `apps/admin/src/users/admin-user-form.component.spec.ts` to assert the form is invalid for a 7-character password and valid for an 8-character password with the other fields populated; verify with `pnpm --filter admin exec vitest run src/users/admin-user-form.component.spec.ts`.

## 3. OpenAPI contract

- [ ] 3.1 Set `AdminUserCreate.password.minLength` to `8` in `apps/api/openapi/openapi.yaml`; verify with `pnpm contract:lint`.
- [ ] 3.2 Add a contract test asserting `AdminUserCreate.password.minLength === 8` by parsing `openapi/openapi.yaml`, following the pattern in `apps/api/test/admin-customers-contract.spec.ts`; verify with `pnpm --filter api exec vitest run test/admin-users.contract.spec.ts`.

## 4. Integration verification

- [ ] 4.1 Run `pnpm --filter api exec vitest run test/admin-users.schemas.spec.ts test/admin-users.contract.spec.ts` and `pnpm --filter admin exec vitest run src/users`; verify all targeted tests pass.
- [ ] 4.2 Run `pnpm --filter api typecheck` and `pnpm --filter admin typecheck`; verify both exit successfully.
- [ ] 4.3 Run `pnpm --filter admin build:app`; verify the build succeeds (the existing bundle-budget warning is acceptable).

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
