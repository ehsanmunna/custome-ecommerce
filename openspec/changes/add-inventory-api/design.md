# Design

## Context

The database already contains Prisma models and migrations for `inventory_items`, `stock_reservations`, and append-only `stock_movements`. Inventory is single-location and keyed by product variant. The NestJS API uses Prisma, Zod request schemas, permission metadata, and a versioned `/v1` route prefix. See `proposal.md` and the inventory requirements for scope.

## Goals / Non-Goals

**Goals:**
- Implement the existing OpenAPI inventory operations in the API.
- Preserve atomicity between balance changes, reservation changes, and movement-ledger entries.
- Derive available and low-stock values from persisted balances.

**Non-Goals:**
- Add or change database tables, warehouses, product-level inventory fields, or location-based pricing.
- Add availability caching, admin screens, storefront UI, or checkout endpoints.

## Decisions

**Use the existing Prisma inventory schema** → The API maps its domain operations onto the current `InventoryItem`, `StockReservation`, and `StockMovement` models. The Prisma schema and SQL migrations remain the source of truth; no TypeORM entities or parallel inventory tables are introduced.

**Keep inventory single-location and per variant** → Each balance belongs to a product variant. Product-level availability, warehouse selection, and location-specific prices are not introduced.

**Serialize each stock mutation in a database transaction** → Lock the affected inventory row with PostgreSQL row-level locking before validating and changing stock. A first positive adjustment may create a zero-balance row for a valid variant before applying the adjustment. Update the balance, reservation state where applicable, and append-only movement record in the same transaction. Database constraints remain the final guard against invalid balances.

**Use the existing API contract and authorization model** → Implement the inventory paths and schemas already defined in `apps/api/openapi/openapi.yaml`. Protect reads with `inventory.read` and mutations with `inventory.adjust`; do not invent another route hierarchy or authorization mechanism.

**Do not cache inventory availability** → Read current values from PostgreSQL. This follows the project's no-cache rule and keeps inventory decisions consistent with checkout's database recheck.

## Risks / Trade-offs

- **Concurrent mutations could oversell or corrupt reserved totals** → Lock the variant inventory row and perform validation plus all related writes within one transaction.
- **The append-only movement trigger rejects ledger edits** → Treat movements as immutable and represent corrections as new compensating movements.
- **Concurrent first-time adjustments could create duplicate inventory rows** → Use the variant primary key and transactional upsert/locking; database uniqueness ensures one balance per variant.

## Migration Plan

No database migration is needed. The inventory schema was added by the existing core-schema change. Implement and test the API against that schema, then mark the corresponding operations as implemented in the OpenAPI contract. Rollback consists of removing the API module and reverting the OpenAPI implementation markers; database data and migrations remain untouched.
