# Proposal

## Why

The admin product create page lacks a media/image option. Products can already accept `media` via the API (`productInputSchema.media` with `mediaId`, `primary`, `sortOrder`), and media upload exists as a separate endpoint (`POST /admin/media`), but the admin UI never exposes a way to select or attach images when creating a product. Admins must create products without images, then have no in-UI path to add them.

## What Changes

- Add a media/image selector to the admin product create form in `product-list.component.ts` and `product-list.component.html`
- Allow admins to choose one or more previously uploaded media assets and mark one as primary when creating a product
- Pass the selected `mediaId` values through to `POST /v1/admin/products` via the existing `media` field

## Capabilities

### Modified Capabilities

- `product-controller`: Product create/update now supports attaching media assets (image gallery with optional primary image) — adds media attachment behavior to existing product CRUD

## Impact

- Affected code: `apps/admin/src/catalog/product-list.component.ts`, `apps/admin/src/catalog/product-list.component.html`
- Depends on: existing `media` module (`POST /admin/media` upload), existing `productInputSchema.media` schema field, existing `CatalogService.createProduct` media handling
- No API changes — the backend already accepts `media` on product creation

## Non-goals

- New media upload flow (already exists at `POST /admin/media`)
- Media editing or deletion from product pages
- Storefront product image display changes
- Variant-level media
