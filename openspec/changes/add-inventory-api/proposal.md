# Proposal

## Why

The platform already stores stock per product variant, including reservations and an append-only movement ledger, but the API does not expose inventory operations. Administrators need a safe, auditable way to inspect stock, adjust balances, and manage reservations.

## What Changes

- Add NestJS API operations for inventory listing, stock adjustments, and reservation management.
- Derive available quantity and low-stock state from the existing inventory records.
- Protect stock changes with transactional row locking and movement-ledger writes.
- Add API tests and update the OpenAPI implementation status.

## Non-goals

- Multi-warehouse stock, location-based pricing, or product-level inventory JSON fields.
- New database tables or migrations; the existing inventory schema is reused.
- Checkout implementation, which will consume inventory operations in the checkout change.
- Availability caching, admin UI, or storefront UI.

## Capabilities

### New Capabilities
- `inventory`: Admin API operations for single-location, per-variant inventory, adjustments, and reservations.

### Modified Capabilities

## Impact

- `apps/api`: inventory module, input validation, authorization, and tests.
- `apps/api/openapi/openapi.yaml`: mark implemented inventory operations.
- `packages/database`: existing Prisma inventory models and migration are consumed without schema changes.
