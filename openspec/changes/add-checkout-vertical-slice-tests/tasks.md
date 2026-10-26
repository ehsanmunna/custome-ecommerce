## 1. Database-backed HTTP Test Harness

- [x] 1.1 Add an opt-in integration test that starts the cart/checkout controller and real service with `PrismaService`, opens an ephemeral loopback HTTP server, and skips only when `DATABASE_URL` is absent.
- [x] 1.2 Create uniquely scoped catalog, inventory, and shipping fixtures; track fixture IDs and clean up only test-owned records in foreign-key-safe teardown without resetting the schema.

## 2. Checkout Vertical Slice Coverage

- [x] 2.1 Exercise guest cart creation, add a variant, and successful checkout over HTTP; assert returned order fields and persisted order snapshot, poisha totals, and converted cart.
- [x] 2.2 Verify repeat checkout returns the documented conflict and leaves one order; verify insufficient-stock checkout returns an error, keeps the cart active, and creates no order.
- [x] 2.3 Run the new integration suite against an already migrated test database and confirm it skips when `DATABASE_URL` is absent; retain the existing mocked cart/checkout tests unchanged.
