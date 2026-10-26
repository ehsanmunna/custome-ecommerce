## Why

The cart/checkout HTTP tests currently replace the service with mocks, while service tests mock Prisma; neither exercises the real request-to-database path. Add a database-backed vertical slice so checkout routing, validation, transactional persistence, and order snapshots are verified together without changing production behavior.

## What Changes

- Add an opt-in API integration test that sends real HTTP requests through the cart/checkout controller and service to PostgreSQL.
- Cover guest cart creation, adding a variant, checkout, and persisted order/cart results, plus failure cases that prove checkout does not partially persist an order.
- Use uniquely scoped test fixtures and cleanup; do not reset or drop the shared database schema.
- Keep the existing fast controller and service unit tests.

## Non-goals

- No production API, database schema, contract, SDK, or storefront behavior changes.
- No payment, courier, authentication, or external-service integration.
- No destructive database-wide setup or migration reset from the API test.

## Capabilities

### New Capabilities

None. This change adds verification for existing behavior and does not introduce a system capability.

### Modified Capabilities

None. The cart/checkout requirements are unchanged.

This change opts out of spec deltas with `skip_specs: true` because it changes tests only.

## Impact

- `apps/api/test`: add a PostgreSQL-backed HTTP integration test alongside the existing mocked cart/checkout tests.
- Test execution: the new test is skipped when `DATABASE_URL` is absent and requires an already migrated test database when enabled.
- No runtime dependencies or production files are changed.
