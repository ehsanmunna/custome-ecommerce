# Design

## Context

Product routes currently live in `catalog.controller.ts` inside two controllers: `StorefrontCatalogController` (`/storefront`) and `AdminCatalogController` (`/admin`). Products share those controllers with brands, categories, and variants. Both delegate to `CatalogService`, which already implements `storefrontProducts`, `adminProducts`, `adminProduct`, `createProduct`, `updateProduct`, and `deleteProduct`. The API uses NestJS, Prisma, PostgreSQL, and is versioned at `/v1`. Authentication and permission guards already exist from prior changes.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Split product routes into dedicated storefront and admin product controllers.
- Enforce role-based access at the product-controller level: admin full CRUD, staff create-only, manager read/update/create but not delete.
- Keep all existing `CatalogService` methods unchanged; controllers delegate to the service.
- Preserve the current `/v1` API contract — no schema changes.

**Non-Goals:**
- Modifying `CatalogService` business logic or validation.
- Changing brand, category, or variant controllers.
- Adding new database tables, migrations, or API schemas.
- Implementing the storefront UI or admin dashboard UI.

## Decisions

### 1. Extract products into two dedicated controllers

Add `StorefrontProductController` (`@Controller('storefront/products')`) and `AdminProductController` (`@Controller('admin/products')`), each injecting `CatalogService`. Remove product routes from the existing combined catalog controllers.

**Rationale:** Makes access intent explicit per controller and lets role-based guards be applied at the product-controller level without affecting brands/categories/variants.

**Alternative:** Keep products in the combined controllers and add role conditions inline. That mixes concerns and makes authorization harder to review and test.

### 2. Role-based authorization via existing permission metadata

Admin routes use `@AuthAccess({ access: 'admin', permission: 'catalog.products.*', scope: 'store' })` with an additional role check derived from the authenticated admin's role:
- `admin`: all product operations
- `manager`: create, read, update — blocked on delete
- `staff`: create only — blocked on read, update, delete

**Rationale:** Reuses the existing authentication guard and permission infrastructure rather than introducing a second authorization path.

**Alternative:** Create new permission strings per role (`catalog.products.staff.create`, etc.). That changes the permission model broadly and is out of scope.

### 3. Controllers delegate to existing CatalogService

Both product controllers call the same `CatalogService` methods the combined controllers currently use (`storefrontProducts`, `adminProducts`, `adminProduct`, `createProduct`, `updateProduct`, `deleteProduct`).

**Rationale:** No service-layer changes means no new persistence behavior or validation to test.

**Alternative:** Create a dedicated `ProductService`. Unnecessary duplication since `CatalogService` already covers product operations.

## Risks / Trade-offs

- [Role check placement] → If the role-based check is applied in the controller rather than a guard, every route handler must repeat it. Mitigate with a single custom decorator or guard applied at the controller level.
- [Removing product routes from combined controllers] → Any external client already calling those routes under `/admin/products` or `/storefront/products` will break. Mitigate by confirming no external clients depend on the current combined-controller product routes before removal.
- [Staff create-only bypass] → Staff could still create products through other admin endpoints if they exist. Mitigate by scoping the restriction to the dedicated product controller only, as specified.

## Migration Plan

1. Add `StorefrontProductController` and `AdminProductController` files under `apps/api/src/catalog/`.
2. Move product route handlers out of `StorefrontCatalogController` and `AdminCatalogController` into the new controllers.
3. Add role-based authorization decorators/guards to `AdminProductController`.
4. Register both new controllers in `CatalogModule`.
5. Run build, typecheck, lint, and tests; verify admin/manager/staff access behavior.
6. Rollback: revert controller files and module registration; no database changes are involved.
