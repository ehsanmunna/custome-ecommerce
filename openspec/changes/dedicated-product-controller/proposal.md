# Proposal

## Why

Product routes currently live inside the combined catalog controllers alongside brands, categories, and variants. Splitting products into dedicated admin and storefront controllers makes access intent explicit and lets each role's permissions be enforced at the route level: admin does everything, staff can create only, and manager can do anything except delete. The storefront needs a dedicated product list route as well.

## What Changes

- Add a dedicated `ProductController` for storefront public product listing.
- Add a dedicated `ProductController` for admin product CRUD.
- Route storefront product reads through the public storefront controller.
- Enforce role-based authorization: admin full access, staff create-only, manager read/update/create but not delete.
- Wire the new controllers into the catalog module.
- Keep all existing catalog service methods and schemas unchanged; controllers delegate to `CatalogService`.

## Capabilities

### New Capabilities

- `product-controller`: Dedicated product controllers for admin and storefront with role-based access control (admin, manager, staff).

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/api/src/catalog/catalog.controller.ts`, `apps/api/src/catalog/catalog.module.ts`, and any new controller files; role/permission middleware or guards if product-specific permission checks are introduced.
- Affected API: storefront product listing route and admin product CRUD routes; no changes to request/response schemas.
- Depends on: existing catalog service, catalog schemas, authentication, and permission infrastructure from `add-auth-api` and `add-catalog-api`.

## Non-goals

- Changing product business logic, validation, or persistence behavior.
- Adding media uploads, inventory, or pricing features.
- Modifying brand, category, or variant controllers.
- Creating new database tables or migrations.
