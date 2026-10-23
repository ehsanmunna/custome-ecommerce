## Why

Variants became sellable in the catalog change, but nothing yet records how many units exist, how many
are held for pending checkouts, or why a quantity changed. Carts, checkout, and admin stock screens
all need one shared inventory schema, and it must land before order tables start referencing stock.
This is change #3 in the Phase 1 database plan.

## What Changes

- Add Prisma models and one forward migration for inventory items, stock reservations, and a
  stock-movements ledger.
- Keep inventory single-location: exactly one inventory item per variant, no warehouse or location
  table, and no per-location stock rows.
- Track `quantity_on_hand` and `quantity_reserved` per variant, with available quantity derived as
  on-hand minus reserved. Never store a negative quantity.
- Add a per-item low-stock threshold so the admin can flag items whose available quantity has fallen
  to or below it. No background job or alert transport in this change.
- Record every stock change as an immutable movement row carrying the on-hand and reserved deltas,
  the resulting balances, a movement type, an optional reference to a cart/order/manual action, and a
  note.
- Model reservations as their own rows with quantity, status (`active`, `released`, `committed`,
  `expired`), and an optional expiry, so checkout can reserve and later release or commit them.
- Reference future carts and orders by a typed external reference instead of a foreign key, because
  those tables do not exist yet. This keeps the inventory schema independent and forward compatible.
- Enforce integrity with a unique variant per inventory item, foreign keys that restrict deleting a
  variant that still has stock or movement history, non-negative balance checks, and
  reserved-not-greater-than-on-hand checks.
- Add migration integration tests for the new constraints and ledger behavior.

## Capabilities

### New Capabilities

- `inventory`: stock per variant, reservations, stock movements, adjustments, and low-stock
  thresholds for the shared database schema.

### Modified Capabilities

- None. This change adds new schema only; the existing `database-migrations` requirements already
  cover how it is applied and the catalog requirements are unchanged.

## Non-goals

- Inventory APIs, service methods (`reserve`, `release`, `deduct`, `adjust`), admin screens, or
  storefront availability checks.
- Carts, orders, payments, or checkout. Reservations are recorded here but created by a later API.
- Multi-location inventory, transfers between locations, or per-location availability.
- Automatic reservation expiry workers, cron jobs, or notification delivery for low stock.
- Backorders, pre-orders, serial numbers, lot/batch tracking, barcode scanning, or cycle counts.
- Inventory valuation, costing methods (FIFO/weighted average), or accounting integration.
- Seed stock or sample inventory.

## Impact

- Affected specs: `inventory` (new).
- Affected code: `packages/database` (Prisma models, one migration, `expected-version.ts`,
  integration tests); no API routes in this change.
- Dependencies: no new runtime packages; PostgreSQL 16 features already available.
- Operational impact: every client database must run `db:migrate` before deploying a build that
  expects the inventory schema.
