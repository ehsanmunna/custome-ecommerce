# Proposal

## Why

The admin dashboard has a working shell and authentication (from `add-admin-shell-and-auth`), but no catalog or inventory screens exist yet. Store operators cannot manage products, variants, categories, media, or stock through the admin panel, which blocks Milestone 2: "A client can run the business from the admin panel." This change builds those admin workflows on top of the existing catalog and inventory API contract.

## What Changes

- Build product management screens: create, edit, view, list products with category, brand, attributes, variants, SEO fields, and media association
- Build category management screens: create, edit, view, list categories with parent/child hierarchy and bn/en translations
- Build brand management screens: create, edit, view, list brands
- Build attribute definition screens: define per-category attribute definitions that drive the product form
- Build variant management screens: create product variants from attribute combinations with stock and pricing
- Build media management screens: upload product images to Cloudflare R2, associate with products/variants
- Build inventory screens: view stock per variant, record stock adjustments, view stock movements ledger, configure low-stock alerts
- Wire all screens through the shared API client (`packages/api-sdk`) generated from the OpenAPI contract
- Add UI tests for each workflow covering successful saves, API validation failures, and upload failures

## Capabilities

### New Capabilities

- `admin-catalog`: Product, category, brand, attribute definition, variant, and media management screens for the admin dashboard
- `admin-inventory`: Stock per variant, reservations, stock movements ledger, adjustments, and low-stock alert screens

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin` (new Angular components and screens), `packages/api-sdk` (regenerated types already available from `define-openapi-contract`)
- Affected APIs: existing catalog API (`GET/POST/PATCH/DELETE /admin/catalog/*`), inventory API (`GET/POST/PATCH /admin/inventory/*`), media API (presigned uploads)
- Depends on: `define-openapi-contract` (OpenAPI contract + SDK), `add-core-schema-catalog`, `add-core-schema-inventory`, `add-media-api`
- Non-goals: Storefront implementation, payment integrations, courier integrations beyond existing API capabilities, cross-client platform administration
