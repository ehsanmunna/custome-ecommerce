## 1. Prisma schema

- [x] 1.1 Add the `ReservationStatus`, `ReservationReferenceType`, and `StockMovementType` enums to `packages/database/prisma/schema.prisma`
- [x] 1.2 Add the `InventoryItem` model with `variant_id` as both primary key and foreign key to `ProductVariant`, on-hand/reserved counters, low-stock threshold, and timestamps
- [x] 1.3 Add the `StockReservation` model with quantity, status, optional typed reference, optional expiry, timestamps, and the indexes from `design.md`
- [x] 1.4 Add the `StockMovement` model with movement type, on-hand/reserved deltas, resulting balances, optional typed reference, optional note, and `created_at` only
- [x] 1.5 Add the reverse inventory/reservation/movement relations to `ProductVariant`, then run `prisma format` and `prisma validate`
- [x] 1.6 Run `pnpm --filter database db:generate` and confirm the Prisma client builds with the new models

## 2. Forward migration

- [x] 2.1 Create `packages/database/prisma/migrations/20260103000000_inventory/migration.sql`
- [x] 2.2 Create the PostgreSQL enums, then the `inventory_items`, `stock_reservations`, and `stock_movements` tables in dependency order
- [x] 2.3 Add foreign keys with `ON DELETE RESTRICT` from inventory items, reservations, and movements to variants, and confirm deleting a variant with inventory history is rejected
- [x] 2.4 Add the quantity checks (non-negative on-hand/reserved, reserved not greater than on-hand, non-negative threshold) and the reservation quantity/reference checks
- [x] 2.5 Add the movement checks: type-specific delta signs, at least one non-zero delta, non-negative resulting balances, and resulting reserved not greater than resulting on-hand
- [x] 2.6 Add the listing and lookup indexes from `design.md`
- [x] 2.7 Add the `BEFORE UPDATE OR DELETE` trigger and trigger function that reject changes to stock movements
- [x] 2.8 Confirm the SQL applies cleanly to an empty database with `pnpm --filter database db:migrate`
- [x] 2.9 Run `db:migrate` a second time and confirm it is a no-op, then confirm `db:status` and `schema_version` report the inventory migration
- [x] 2.10 Regenerate `src/expected-version.ts` and confirm it names the inventory migration

## 3. Integration tests

- [x] 3.1 Add `packages/database/test/integration/inventory-schema.spec.ts` using the existing migration reset helper
- [x] 3.2 Test that an inventory item requires an existing variant, a second item for the same variant is rejected, and deleting a variant with an inventory item is rejected
- [x] 3.3 Test negative on-hand, negative reserved, reserved greater than on-hand, and negative threshold rejection, plus the derived availability cases
- [x] 3.4 Test zero/negative reservation quantity, unsupported reservation status, reference-type/id pairing, and reservation insert/delete restrictions
- [x] 3.5 Test each movement type's delta signs, rejection of inconsistent deltas, and rejection of negative or impossible resulting balances
- [x] 3.6 Test that updating or deleting an existing stock movement is rejected by the trigger
- [x] 3.7 Test that reservations and movements cannot reference a variant without an inventory item, and that deleting a variant with reservations or movements is rejected
- [x] 3.8 Update `migrations.spec.ts` ledger assertions to expect the init, catalog, and inventory migrations instead of only `EXPECTED_SCHEMA_VERSION`
- [x] 3.9 Run `pnpm --filter database test:integration` against a fresh local database and confirm every inventory constraint test passes

## 4. Documentation and verification

- [x] 4.1 Document the inventory tables, shared variant key, derived availability/low-stock rule, reservation references, and append-only ledger in `packages/database/README.md`
- [x] 4.2 Run `pnpm --filter database lint`, `pnpm --filter database typecheck`, and `pnpm --filter database test`
- [x] 4.3 Run a full fresh-database migration and the database integration suite one final time
- [x] 4.4 Run `openspec validate add-core-schema-inventory --strict`
