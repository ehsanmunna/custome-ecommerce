## Context

See proposal.md for motivation. Existing `cart-checkout-api.integration.spec.ts` exercises real HTTP routes but replaces `CartCheckoutService` with a mock; `cart-checkout.service.spec.ts` exercises the service with mocked Prisma. PostgreSQL-backed schema tests already use unique fixture data, while `catalog.database.integration.spec.ts` demonstrates an API package test gated by `DATABASE_URL` and cleanup of its own records.

## Goals / Non-Goals

**Goals:**
- Exercise the real cart/checkout controller, service, and Prisma persistence through HTTP requests.
- Verify the returned order against persisted cart and order records for a successful guest checkout.
- Verify a rejected checkout leaves no partial order and does not convert the cart.
- Keep tests opt-in with the existing database environment and safe for a database containing unrelated data.

**Non-Goals:**
- Reset schemas, run migrations, or use the migration identity from the API integration test.
- Replace the fast mocked HTTP and service unit tests.
- Add new fixtures, test dependencies, or production changes unrelated to checkout.

## Decisions

1. **Create a separate database-backed integration test.** Keep `cart-checkout-api.integration.spec.ts` as a deterministic controller/HTTP contract test and add a clearly named vertical-slice integration spec. The new suite will instantiate the actual controller and service with `PrismaService`, host the Nest application on an ephemeral loopback port, and make real HTTP requests. This verifies routing and validation as well as database behavior; mocking the service again would not close the existing coverage gap.

2. **Gate execution on `DATABASE_URL` and require an already migrated database.** Match the API's existing database integration convention: describe the suite as skipped when `DATABASE_URL` is absent, and connect with the runtime `PrismaService` when present. Do not invoke migration, reset, or schema cleanup commands from the test. This avoids granting the API test migration privileges or destroying a shared schema.

3. **Use uniquely scoped fixtures and clean them up in dependency order.** Create fixture names/codes using a random suffix; create only records needed for the test (category/product/variant, inventory, and shipping zone/district, followed by carts through the HTTP API). Track created IDs and delete only test-owned orders/redemptions, carts, inventory, variants, products, category, and shipping-zone records in foreign-key-safe order. Cleanup must run even when assertions fail and must disconnect Prisma and close the HTTP server.

4. **Cover a complete guest checkout and a rollback case.** The success path creates a guest cart and adds a variant via HTTP, checks out with valid contact and delivery details, and verifies the response plus persisted `pending` order, poisha totals and line-item snapshot, and `converted` cart. A second checkout of that cart must return the documented conflict and leave exactly one order. A separate insufficient-stock checkout must return the documented error, preserve the active cart, and create no order. These cases exercise transactional behavior without adding unrelated coupon or payment-provider test scope.

5. **Keep assertions at observable boundaries.** Use HTTP status codes, problem response content type, returned data, and direct Prisma reads of owned fixture records. Do not assert internal private methods, query counts, or implementation-specific SQL details.

## Risks / Trade-offs

- [A configured `DATABASE_URL` may point at a shared database] → Require unique fixture identifiers, track ownership, delete only records created by the test, and never reset schemas.
- [A local database may be unavailable or not migrated] → Skip only when `DATABASE_URL` is absent; when configured, surface connection or missing-schema failures rather than hiding them.
- [Fixture relationships make cleanup fragile] → Record identifiers as each fixture is created and delete dependent records before their referenced parents in `finally`/test teardown.
- [The current cart service may expose behavior defects when exercised against PostgreSQL] → Treat failures as test findings and do not weaken assertions to accommodate a discrepancy.

## Migration Plan

No schema or runtime migration is required. Run the new test with `DATABASE_URL` pointed at an already migrated test database; without that variable it is skipped, matching existing API database integration tests. Remove the test file to roll back the change. The test must never reset the database schema.
