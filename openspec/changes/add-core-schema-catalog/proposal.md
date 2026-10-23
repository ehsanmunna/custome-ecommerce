## Why

Catalog is the backbone of the platform: inventory, carts, orders, storefront pages, and search all
reference products and variants. Without one shared catalog schema, every later change would invent
its own tables and client databases could drift before the first product exists. This is change #2 in
the plan and unblocks the remaining Phase 1 database work.

## What Changes

- Add Prisma models and one forward migration for categories, brands, products, variants, category
  attribute definitions, catalog translations, and media asset metadata.
- Store money as integer poisha. No floating-point or per-client currency variance; all clients use
  BDT.
- Give products one primary category and an optional brand. Categories support a parent/child tree.
- Keep user-facing text translatable: catalog entities store `bn` and `en` rows separately, with
  localized slugs and SEO fields.
- Store variant attributes as JSONB, with typed attribute definitions scoped to the product's
  category so admin forms and filters stay consistent.
- Add media asset metadata plus product/category/brand associations. Binary files stay in the
  client's R2 bucket; the database stores only keys and metadata.
- Enforce integrity with unique localized slugs, unique SKUs, category-scoped attribute keys,
  foreign keys, and archive-friendly status columns.
- Add migration integration tests for the new constraints and data shapes.

## Capabilities

### New Capabilities

- `catalog`: categories, brands, products, variants, attribute definitions, localized content, SEO
  fields, and product media associations.
- `media`: media asset metadata and association rules that later upload and delivery features build
  on.

### Modified Capabilities

- None. This change adds new schema only; the existing `database-migrations` requirements already
  cover how it is applied.

## Non-goals

- Catalog APIs, admin screens, or storefront rendering.
- Seed data, sample products, or default categories.
- R2 upload, resizing, signing, or deletion flows.
- Inventory quantities, reservations, or stock movements.
- Orders, carts, payments, pricing rules, coupons, tax, or shipping.
- Search implementation and Its indexes; those arrive with the catalog API.
- Multiple categories per product, multi-currency, product reviews, and per-client schema branches.

## Impact

- Affected specs: `catalog`, `media` (both new).
- Affected code: `packages/database` (Prisma models, one migration, `expected-version.ts`,
  integration tests); no API routes in this change.
- Dependencies: no new runtime packages; PostgreSQL 16 features already available.
- Operational impact: every client database must run `db:migrate` before deploying a build that
  expects the catalog schema.
