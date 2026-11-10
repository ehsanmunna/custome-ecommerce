## 1. Prisma schema

- [x] 1.1 Add Prisma models for unique store settings and provider secret references, with no credential-value fields
- [x] 1.2 Add CMS page, page-translation, banner, and banner-translation models with locale, publication, SEO, placement, ordering, and optional media relations
- [x] 1.3 Add reverse media relations and format, validate, and generate Prisma Client; confirm existing models remain available

## 2. Forward migration and integration tests

- [x] 2.1 Create the forward migration after `20260105000000_orders_payments_shipping` for settings, secret references, CMS tables, enums, checks, indexes, and foreign keys
- [x] 2.2 Test setting-key uniqueness, non-empty values, secret-reference persistence, and absence of credential-value storage
- [x] 2.3 Test localized page content, per-locale slug uniqueness, publication defaults/states, and invalid locale/state rejection
- [x] 2.4 Test localized banners, optional media references, media deletion behavior, translation cascades, and preservation of unrelated content
- [x] 2.5 Apply the migration to an empty PostgreSQL database, confirm a second migration run is a no-op, and verify the schema version

## 3. Documentation and verification

- [x] 3.1 Document settings, external secret references, CMS localization, publication, media, and deletion rules in `packages/database/README.md`
- [x] 3.2 Regenerate the expected schema version and Prisma Client, then run database lint, typecheck, and tests
- [x] 3.3 Run a final fresh-database migration and database integration suite
- [x] 3.4 Run `openspec validate add-core-schema-settings-cms --strict`
- [x] 3.5 Confirm no API, admin, storefront, provider, seed, or notification implementation code changed
