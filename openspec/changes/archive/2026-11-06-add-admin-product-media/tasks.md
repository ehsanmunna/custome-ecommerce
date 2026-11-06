# Tasks

## 1. Admin product create form — media selector

- [x] 1.1 Add `mediaIds` multi-select form control to `createForm` in `product-list.component.ts` and verify it compiles
- [x] 1.2 Add media dropdown to create modal in `product-list.component.html` populated from `GET /admin/media` and verify it renders
- [x] 1.3 Add primary-image toggle per selected media item with client-side "at most one primary" enforcement and verify no more than one can be selected
- [x] 1.4 Include `media` array (`mediaId`, `primary`, `sortOrder`) in the `POST /v1/admin/products` payload in `createProduct()` and verify it sends media IDs
- [x] 1.5 Verify admin can create a product with attached media and that `GET /admin/products` returns the media in the product detail

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
