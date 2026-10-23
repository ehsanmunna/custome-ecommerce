# database

Owns the Prisma schema, the ordered migration stream, and the generated Prisma client. Every client
database follows this exact stream.

Key paths:

- `prisma/schema.prisma` — datasource and generator.
- `prisma/migrations/` — committed, immutable SQL migrations.
- `src/index.ts` — re-exports the generated client and `EXPECTED_SCHEMA_VERSION`.

The migration scripts read `MIGRATION_DATABASE_URL`. The API only ever reads `DATABASE_URL` (the
runtime identity, which cannot change schema).

## Catalog schema

The catalog migration adds these tables:

- `categories`, `category_translations`, `brands`, `brand_translations`
- `products`, `product_translations`, `product_variants`
- `attribute_definitions`
- `media_assets`, `media_alt_texts`, `product_media`

Rules to preserve in later changes:

- Money is stored as integer **poisha** (`price_poisha`, `compare_at_price_poisha`); never store taka
  or floating-point values.
- A product has exactly one primary `category_id`. Multi-category support needs a separate change.
- Category, brand, and product text lives in per-locale (`bn`, `en`) translation rows. Slugs are
  unique per entity type and locale.
- Variant attributes are JSONB and are validated against the product category's
  `attribute_definitions` by the API.
- Media rows store R2 provider keys and metadata, never binaries. A product has at most one primary
  image; category and brand image references are cleared when the media asset is deleted.
