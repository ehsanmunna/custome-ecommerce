# Tasks

## 1. Controller scaffolding

- [x] 1.1 Create `apps/api/src/catalog/storefront-product.controller.ts` with public storefront product listing route and verify the file compiles
- [x] 1.2 Create `apps/api/src/catalog/admin-product.controller.ts` with admin product CRUD routes and verify the file compiles
- [x] 1.3 Register both new controllers in `CatalogModule` and verify the module compiles without duplicate route errors

## 2. Storefront product controller

- [x] 2.1 Move `storefrontProducts` (GET products) route handler from `StorefrontCatalogController` into `StorefrontProductController` and verify the route responds with paginated products
- [x] 2.2 Ensure storefront product controller exposes only read operations (no POST/PATCH/DELETE) and verify write attempts return method-not-allowed or forbidden

## 3. Admin product controller with role-based access

- [x] 3.1 Move `adminProducts`, `adminProduct`, `createProduct`, `updateProduct`, `deleteProduct` handlers from `AdminCatalogController` into `AdminProductController` and verify each route delegates to `CatalogService`
- [x] 3.2 Add role-based authorization: admin full CRUD, staff create-only, manager read/update/create but not delete, and verify each role's allowed and denied operations return the expected status
- [x] 3.3 Verify unauthenticated callers are rejected on all admin product routes

## 4. Cleanup combined controllers

- [x] 4.1 Remove product route handlers from `StorefrontCatalogController` and `AdminCatalogController` and verify no orphaned references remain
- [x] 4.2 Run API build, typecheck, and lint and verify all pass
- [x] 4.3 Run API unit and HTTP integration tests and verify all pass, including role-based access scenarios for product routes

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
