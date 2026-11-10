## 1. Catalog API foundation

- [x] 1.1 Add the catalog module, controllers, and dependency wiring following existing NestJS patterns; keep storefront and admin controllers separate.
- [x] 1.2 Add catalog request validation, pagination parsing, response mappers, and consistent handling for known Prisma not-found/conflict constraints.
- [x] 1.3 Add deterministic paginated query helpers using the contract's one-based pages, default page size 20, and maximum page size 100.
- [x] 1.4 Add nullable description fields to category/brand translations in Prisma, create a forward-only migration, regenerate the database client, and verify the migration against a fresh database.

## 2. Public storefront catalog

- [x] 2.1 Implement public category and brand listings with active-only filtering, localized content, and stable ordering.
- [x] 2.2 Implement public product listing and search with active product/category/brand filtering, locale default `bn`, case-insensitive localized name/description substring search, and localized category/brand slug filters.
- [x] 2.3 Implement active products by category slug and product/brand detail by localized slug; return not found when the requested translation is missing.
- [x] 2.4 Map storefront product details to the contract, including only active variants and ordered media metadata, without exposing internal fields or implying stock availability.

## 3. Administrative catalog operations

- [x] 3.1 Implement permission-protected brand list/create/update/delete operations with locale-preserving writes and slug conflict handling.
- [x] 3.2 Implement permission-protected category list/create/update/delete operations with locale-preserving writes, reference-safe deletion, and ancestor-cycle detection.
- [x] 3.3 Implement permission-protected category attribute definition listing and creation with key, value-type, uniqueness, and select-option validation.
- [x] 3.4 Implement permission-protected product list/detail/create/update/delete operations, including status filtering, reference validation, localized content, and transactional media association writes.
- [x] 3.5 Implement product variant create/update/delete operations with unique SKU handling, integer poisha validation, and category-definition validation for required/type/select attributes.
- [x] 3.6 Ensure category changes cannot leave existing product variants with attributes invalid for the destination category.
- [x] 3.7 Map known missing-reference, uniqueness, and deletion-restriction errors to stable problem responses; allow unexpected failures to remain explicit and generic.

## 4. Contract coverage and verification

- [x] 4.1 Add unit and HTTP integration tests for public visibility, locale defaults, search/filter semantics, pagination, detail lookup, authorization, and response mapping.
- [x] 4.2 Add database-backed tests for localized description persistence/updates, slug/SKU conflicts, category cycles, variant attribute validation, media references, and deletion restrictions.
- [x] 4.3 Mark all implemented catalog operations in the OpenAPI contract and update SDK types only if an additive contract change is required.
- [x] 4.4 Run the migration and API build, typecheck, lint, and tests; database tests; OpenAPI lint; contract compatibility/tests; SDK freshness/build; formatting; and strict OpenSpec validation.
