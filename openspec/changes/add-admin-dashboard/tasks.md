# Tasks

## 1. Complete admin API prerequisites

- [x] 1.1 Align admin OpenAPI permissions and store-scoped read-only customer lookup contracts with the dashboard specs; seed canonical endpoint-level permission keys, translate legacy grants without deleting custom-role grants, reconcile baseline system-role grants, update the admin flow documentation, and add seed/contract tests verifying this behavior.
- [x] 1.2 Implement order and return list/detail/status operations with permission and lifecycle enforcement; add append-only return status history including notes; add API tests and update API documentation; verify the focused API tests and `pnpm contract:check` pass.
- [x] 1.3 Implement settings, shipping-zone, coupon, and CMS admin operations required by the specs, add API tests and update API documentation, and verify the focused API tests and `pnpm contract:check` pass.
- [x] 1.4 Implement analytics and read-only customer lookup operations with least-privilege store scope, add tests proving customer credentials and OTP data are excluded, update API documentation, and verify the focused API tests and `pnpm contract:check` pass.

## 2. Generate and wire the shared API client

- [ ] 2.1 Regenerate SDK types from the finalized OpenAPI contract and verify `pnpm --filter api-sdk generate:check` and `pnpm --filter api-sdk typecheck` pass.

## 3. Establish Angular application shell and authentication

- [x] 3.1 Replace the placeholder build setup with the documented Angular application entry and dependencies, update the admin README with local build/run instructions, and verify `pnpm --filter admin build` succeeds.
- [x] 3.2 Implement runtime API/branding configuration, login, in-memory token lifecycle, refresh, logout, and protected routes; add UI tests for successful login, refresh failure, and reload behavior, and verify `pnpm --filter admin test` passes.
- [ ] 3.3 Implement permission-aware navigation and role/permission screens using the shared API client; add UI tests for hidden/denied actions and protected system roles, and verify `pnpm --filter admin test` passes.

## 4. Deliver catalog and inventory workflows

- [ ] 4.1 Implement product, variant, brand, category, and attribute-driven forms with media upload; add UI tests for successful saves and API validation/upload failures, and verify `pnpm --filter admin test` passes.
- [ ] 4.2 Implement inventory, reservation, and stock adjustment screens; add UI tests proving rejected adjustments do not change displayed quantities, and verify `pnpm --filter admin test` passes.

## 5. Deliver order and customer support workflows

- [ ] 5.1 Implement order search/detail, confirmation, permitted status changes, and return management; add UI tests for permission and lifecycle rejection, and verify `pnpm --filter admin test` passes.
- [ ] 5.2 Implement read-only customer search/detail with permitted order context; add UI/API tests that enforce authorization and exclude credentials/OTP data, and verify the focused tests pass.

## 6. Deliver settings and CMS workflows

- [ ] 6.1 Implement non-secret store settings, shipping-zone/district, and coupon management; add UI tests for API validation and rejected deletion, and verify `pnpm --filter admin test` passes.
- [ ] 6.2 Implement localized banner and page management; add UI tests that preserve existing translations and report failed saves, and verify `pnpm --filter admin test` passes.

## 7. Deliver reporting and integration coverage

- [ ] 7.1 Implement sales/order metrics and low-stock indicators using the API and per-item threshold; add UI tests for permission denial, empty results, and API errors, and verify `pnpm --filter admin test` passes.
- [ ] 7.2 Add end-to-end coverage for sign-in, permission-filtered navigation, and representative catalog, order, settings, and reporting workflows; verify the admin build, lint, typecheck, API tests, and contract checks pass.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
