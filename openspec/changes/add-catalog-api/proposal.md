## Why

The platform has a catalog database schema and a canonical OpenAPI contract, but no runtime catalog routes. Implementing the contract will let storefronts browse localized, active products and let authorized administrators manage catalog content using the shared schema.

## What Changes

- Implement public, paginated storefront reads for active categories, brands, products, category products, and localized product/brand details, including the contract's search and filters.
- Implement protected administrative CRUD for brands, categories, category attribute definitions, products, and variants using the contract's declared permissions.
- Validate localized content, slugs, category/brand references, variant SKUs/prices/attributes, and lifecycle transitions; return consistent RFC 9457 errors. Storefront requests default to Bangla when `locale` is omitted; product search uses case-insensitive substring matching over the requested locale's name and description, category/brand filters use localized slugs, and detail lookups do not fall back when a translation is missing.
- Add a forward-only catalog migration for nullable category and brand translation descriptions so accepted OpenAPI content is persisted.
- Regenerate SDK types if the contract requires an additive correction; preserve the existing v1 contract unless a change is necessary and compatible.

## Capabilities

### New Capabilities
- `catalog-api`: Public storefront catalog reads and permission-protected administrative catalog management.

### Modified Capabilities
- None.

## Non-goals

- Media upload/storage integrations, inventory management, stock availability, pricing promotions, or client UI.
- Changes to the public contract that are not required to implement its existing catalog operations.

## Impact

- Affected code: NestJS API controllers, services, validation, module wiring, and tests; Prisma category/brand translation models, a forward migration, and database integration tests.
- Affected API: existing catalog operations and schemas in `apps/api/openapi/openapi.yaml`; generated API SDK only if the contract is amended.
- Depends on catalog, media, authentication, permission, and database behavior already defined by the schema and auth changes. The additive migration only stores optional descriptions already accepted by the existing contract.
- Scope assumption: implement every storefront and admin catalog operation currently declared in the OpenAPI contract, including category attribute definition listing/creation and product variant create/update/delete.
