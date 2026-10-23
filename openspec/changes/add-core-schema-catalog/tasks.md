## 1. Prisma schema

- [x] 1.1 Add the `content_locale`, category/brand/product/variant status, `attribute_value_type`, and `media_provider` enums to `packages/database/prisma/schema.prisma`
- [x] 1.2 Add `Category`, `CategoryTranslation`, `Brand`, and `BrandTranslation` models with snake_case table/column mappings
- [x] 1.3 Add `Product` and `ProductTranslation` models, with one required category, an optional brand, lifecycle status, and optional SEO fields in translations
- [x] 1.4 Add `AttributeDefinition` and `ProductVariant` models, including integer poisha prices, unique SKU, `attributes Json @db.JsonB`, status, and sort order
- [x] 1.5 Add `MediaAsset`, `MediaAltText`, and `ProductMedia` models, plus `imageMediaId` relations on categories and brands
- [x] 1.6 Add indexes, relation names, and delete behaviors described in `design.md`, then run `prisma format` and `prisma validate`
- [x] 1.7 Run `pnpm --filter database db:generate` and confirm the Prisma client builds with the new models

## 2. Forward migration

- [x] 2.1 Create `packages/database/prisma/migrations/20260102000000_catalog/migration.sql`
- [x] 2.2 Create the PostgreSQL enums, then the category, brand, product, attribute, variant, and media tables in dependency order
- [x] 2.3 Add foreign keys and `ON DELETE` behavior: `RESTRICT` for category/brand references, `CASCADE` for owned rows, `SET NULL` for category/brand images
- [x] 2.4 Add the self-parent check, non-negative money/size checks, image dimension check, and select-options check
- [x] 2.5 Add `UNIQUE (locale, slug)` indexes for each translation table, category-scoped attribute key uniqueness, and the partial unique index for one primary product image
- [x] 2.6 Add the listing indexes from `design.md` and confirm the SQL applies cleanly to an empty database with `pnpm --filter database db:migrate`
- [x] 2.7 Run `db:migrate` a second time and confirm it is a no-op, then confirm `db:status` and `schema_version` report the catalog migration
- [x] 2.8 Regenerate `src/expected-version.ts` and confirm it names the catalog migration

## 3. Integration tests

- [x] 3.1 Add `packages/database/test/integration/catalog-schema.spec.ts` using the existing migration reset helper
- [x] 3.2 Test category self-parent rejection, unknown parent rejection, and delete rejection when children or products exist
- [x] 3.3 Test `bn`/`en` content coexistence, duplicate-locale rejection, duplicate slug within a locale, and the same slug in another locale
- [x] 3.4 Test that a product requires a category, accepts an existing brand, rejects an unknown brand, and rejects an invalid status
- [x] 3.5 Test unique SKU, exact integer poisha storage, rejection of negative prices, and JSONB attribute round-tripping
- [x] 3.6 Test attribute-key uniqueness per category, the same key in different categories, select options, and unsupported value types
- [x] 3.7 Test media provider/key uniqueness, negative byte-size rejection, image dimensions, and duplicate alt-text locale rejection
- [x] 3.8 Test one primary image per product, cascade removal of variants/translations/media links when a product is deleted, and `SET NULL` when a category or brand image is deleted
- [x] 3.9 Update `migrations.spec.ts` ledger assertions to expect both the init and catalog migrations instead of only `EXPECTED_SCHEMA_VERSION`
- [x] 3.10 Run `pnpm --filter database test:integration` against a fresh local database and confirm every catalog constraint test passes

## 4. Documentation and verification

- [x] 4.1 Document the catalog tables, integer-poisha convention, primary-category rule, and media-key model in `packages/database/README.md`
- [x] 4.2 Run `pnpm --filter database lint`, `pnpm --filter database typecheck`, and `pnpm --filter database test`
- [x] 4.3 Run a full fresh-database migration and the database integration suite one final time
- [x] 4.4 Run `openspec validate add-core-schema-catalog --strict`
