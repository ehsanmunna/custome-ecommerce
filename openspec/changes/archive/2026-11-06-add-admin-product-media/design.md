# Design

## Context

The admin product create page (`apps/admin/src/catalog/product-list.component.ts` and `product-list.component.html`) has no media/image selector. The backend already supports `media` on product creation through `productInputSchema.media` (`mediaId`, `primary`, `sortOrder`) and `CatalogService.createProduct` processes `replaceProductMedia` in the transaction. Media upload already exists at `POST /admin/media` and returns a `mediaId`. The gap is purely frontend: no UI to select and attach previously uploaded media assets when creating a product.

See `proposal.md` for motivation and `specs/product-controller/spec.md` for the requirements delta.

## Goals / Non-Goals

**Goals:**
- Add a media/image selector to the admin product create form
- Allow selecting one or more previously uploaded media assets
- Allow marking at most one media asset as primary
- Pass selected `mediaId` values through to `POST /v1/admin/products`

**Non-Goals:**
- New media upload flow (already exists at `POST /admin/media`)
- Media gallery management from product list/edit
- Variant-level media
- Storefront image display changes

## Decisions

### 1. Media selector as a multi-select dropdown in the create modal

Add a `mediaIds` array field to `createForm` backed by a multi-select `<select>` populated from `GET /admin/media`. The admin pre-uploads images via the existing media endpoint, then selects them when creating the product.

**Alternative:** A drag-and-drop upload directly in the product form. Rejected — media upload is already a separate concern with its own endpoint and permission (`media.create`). Keeping them separate avoids duplicating upload logic and permissions.

### 2. Primary media flag via a radio or checkbox on each selected item

Only one media item can be `primary` (enforced by `assertProductReferences` in `catalog.service.ts:839-843`). The UI will enforce this client-side by allowing only one primary selection, with the backend as the authoritative guard.

**Alternative:** A separate "primary image" dropdown after media selection. Rejected — adds complexity; a primary flag inline with each media item is simpler.

### 3. Reuse `productInputSchema.media` shape for the payload

The payload sent to `POST /v1/admin/products` includes `"media": [{ "mediaId": "...", "primary": true/false, "sortOrder": 0 }]`, matching the existing schema. No backend changes needed.

**Alternative:** A new `imageId` field like categories/brands use. Rejected — products use a gallery (many media items), not a single hero image. The `media` array already exists for this.

## Risks / Trade-offs

[Admin must upload media first] → Admins need to upload images via the media section before they can attach them to a product. This is a two-step workflow but reuses existing infrastructure.

[At most one primary] → The backend enforces this; the UI should disable the primary toggle on subsequent selections to avoid a 400 error.

[Media IDs must exist] → `assertProductReferences` validates that all `mediaId` values reference existing media assets. The UI should only offer media assets from `GET /admin/media` to avoid 404s.

## Migration Plan

No database or API changes needed — this is purely frontend. Deploy the updated admin bundle; no rollback required beyond reverting the component files.
