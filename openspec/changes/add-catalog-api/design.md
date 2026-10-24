## Context

See `proposal.md` for motivation and `specs/catalog-api/spec.md` for externally visible behavior.
The API is NestJS with Prisma and PostgreSQL. Catalog, localized content, variants, attribute
definitions, media metadata, and their constraints already exist in the database. The existing
category and brand translation tables do not have description columns even though the canonical
OpenAPI schema accepts descriptions. The contract describes catalog routes and response schemas, but
marks them unimplemented. Authentication, permission checks, and RFC 9457 error serialization are
already available.

## Goals / Non-Goals

**Goals:**

- Implement all currently declared catalog routes without changing their v1 wire contract, and store
  optional category/brand descriptions already allowed by that contract.
- Keep persistence constraints authoritative and enforce API-only invariants before writes.
- Share query and response mapping across storefront/admin code while maintaining distinct public
  visibility and administrative access rules.
- Keep list queries paginated and deterministically ordered.

**Non-Goals:**

- Change catalog behavior beyond the API contract, inventory, or business pricing.
- Add media uploads, CDN URL generation, search infrastructure, or client interfaces.
- Implement an uncontracted category attribute update/delete API.

## Decisions

### 1. Use one catalog module with separate storefront and admin controllers

Add a `CatalogModule` with route-specific controllers and a shared catalog service. Keep storefront
routes explicitly public and admin routes annotated with the exact permission metadata from the
contract. Reuse the existing authentication guard rather than introducing a second authorization
path. This avoids duplicating persistence behavior while keeping admin-only data out of public
responses.

**Alternative:** one controller with route conditionals. Separate controllers make access intent and
route contract coverage easier to review and test.

### 2. Use Prisma transactions for multi-record catalog writes

Create or update a product, its supplied translations, and media associations atomically. Apply the
same approach to category/brand translations and category parent updates. Database uniqueness and
foreign-key constraints remain the final concurrency-safe authority; translate known constraint
failures into stable conflict or not-found problems. Do not catch unexpected database errors as
successful or validation-shaped responses.

**Alternative:** sequential independent writes. They risk leaving partial localized content or media
associations after a failure.

### 3. Validate category trees and variant attributes at the service boundary

Before changing a category parent, walk its ancestor chain and reject self-reference or a cycle.
Before creating/updating a variant, load the product's current category definitions and validate
required keys, supported JSON value types, and select options. Validate current variant data before
allowing a product category change, so category reassignment cannot leave invalid attributes.
Database checks still protect invariants that are expressible in PostgreSQL.

**Alternative:** database-only enforcement. The schema intentionally keeps JSONB attributes flexible
and only has a self-parent constraint, so the API must enforce these cross-row rules.

### 4. Resolve locale explicitly and search with bounded database predicates

Use the requested `bn`/`en` locale, defaulting to `bn`; resolve detail slugs and filter slugs against
that locale only. Missing translations return not found rather than silently falling back. Use
parameterized Prisma filters for case-insensitive substring search in the selected locale's product
name and description, with the contract's maximum query length. Do not add raw SQL interpolation,
full-text infrastructure, or unbounded result sets.

**Alternative:** automatic language fallback or PostgreSQL full-text search. Fallback can return a
different language than requested; full-text search changes matching semantics and requires index
and ranking decisions outside this API scope.

### 5. Map database records to contract response types

Return only explicitly mapped fields. Public routes filter inactive entities and variants; admin
routes can retrieve archived catalog records. Include media metadata from existing records only;
never infer stock availability or emit private database fields. Use deterministic ordering and the
contract's one-based page/pageSize defaults and maximum. Keep product prices as integer poisha.

**Alternative:** returning Prisma records directly. This couples database shape to the public API
and can leak internal columns as the schema evolves.

### 6. Keep contract additions synchronized and additive

Mark implemented route operations in the canonical OpenAPI document after runtime behavior matches
its schemas and access metadata. Regenerate SDK declarations if and only if the contract changes.
Run route/contract coverage and compatibility checks to ensure no planned operation is omitted or
changed incompatibly.

**Alternative:** treat generated SDK types or decorators as the contract. The canonical OpenAPI
document is already the source of truth for clients and validation.

### 7. Add nullable description columns in a forward-only migration

Add nullable `description` columns to the category and brand translation tables and expose them in
the existing Prisma models. Keep the current OpenAPI schemas unchanged. The columns are nullable so
existing rows remain valid and API writes can preserve old records without a backfill.

**Why:** the API must not silently discard fields accepted by the canonical contract. Adding
storage is additive and avoids narrowing an existing v1 request/response shape.

**Alternative:** remove descriptions from the contract schemas. This would narrow the documented v1
surface and create compatibility risk.

## Risks / Trade-offs

- **Case-insensitive substring matching can scan many product translations** → Enforce the contract's
  query-length bound, paginate every result, and add only measured indexes in a separately reviewed
  database change.
- **Concurrent writes can race API-level prechecks** → Depend on unique indexes and foreign keys for
  final integrity, map known conflicts, and keep multi-row writes transactional.
- **Category moves can invalidate existing variant attributes** → Validate the destination category
  against every existing variant before committing the move.
- **Storefront filtering archived parents may require joins** → Use explicit relational predicates
  so hidden products cannot leak through category or brand filters.
- **Media endpoints remain outside this change** → Catalog operations accept and return only existing
  media metadata records; no upload or object cleanup is implied.
- **The migration must be applied before deploying code that persists descriptions** → Keep the
  migration forward-only, test it against a fresh database, and deploy it before the API.

## Migration Plan

1. Add nullable category/brand translation description fields to Prisma, create and apply a
   forward-only migration, and test it against a fresh database.
2. Implement the catalog module and its unit and HTTP integration tests against the updated Prisma
   models.
3. Verify catalog behavior with database-backed tests, including description persistence, category
   cycle, slug/SKU conflicts, attribute validation, media references, and deletion constraints.
4. Add all catalog routes to the implemented-operation declaration and run API build, lint,
   typecheck, OpenAPI lint, contract compatibility/tests, and SDK freshness checks.
5. Deploy the migration before the API. Roll back by reverting the API deployment; leave the
   additive columns in place and do not attempt a destructive rollback.
