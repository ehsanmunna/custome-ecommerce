## 1. API Module and Validation

- [x] 1.1 Create the NestJS inventory module, controller, and service using the existing Prisma service, and register the module in the application.
- [x] 1.2 Add strict Zod schemas and parsing for inventory pagination/filtering, stock adjustments, manual reservations, reservation status updates, and reservation listing.

## 2. Inventory Reads

- [x] 2.1 Implement paginated inventory listing with optional low-stock filtering and derived available/low-stock values.
- [x] 2.2 Implement paginated reservation listing with optional status filtering.
- [x] 2.3 Add unit tests for available quantity and low-stock calculations, including threshold boundaries.

## 3. Transactional Stock Mutations

- [x] 3.1 Implement stock adjustments with variant row locking, first-positive-adjustment initialization, balance validation, optional threshold updates, and an append-only movement entry in one transaction.
- [x] 3.2 Implement manual reservation creation with row locking, positive-quantity and available-stock validation, and atomic reserved-balance and movement updates.
- [x] 3.3 Implement active reservation release and commit transitions with atomic balance changes and movement entries; reject invalid or repeated transitions.
- [x] 3.4 Add service tests for insufficient stock, invalid balances, missing variants/reservations, failed transactions, and reservation state transitions.

## 4. API Contract and Verification

- [x] 4.1 Expose the inventory endpoints defined in the OpenAPI contract and map contract permissions to the persisted inventory role permissions.
- [x] 4.2 Add API integration tests for inventory and reservation endpoints, validation failures, and permission enforcement.
- [x] 4.3 Update `x-implemented-operations` in the OpenAPI document for the inventory operations implemented by this change.
- [x] 4.4 Run the focused API tests, OpenAPI contract tests, lint, and typecheck; resolve any failures caused by the inventory implementation.
