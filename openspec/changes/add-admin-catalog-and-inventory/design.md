# Design

## Context

The admin dashboard shell and authentication are complete (from `add-admin-shell-and-auth`). The OpenAPI contract and SDK are generated from `define-openapi-contract`. Catalog and inventory API endpoints already exist on the NestJS backend (products, categories, brands, attributes, variants, media, inventory adjustments, reservations). This change builds Angular screens on top of those existing APIs using the shared `api-sdk` client.

See `proposal.md` - Why for motivation and `specs/admin-catalog/spec.md` + `specs/admin-inventory/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Angular screens for product, category, brand, attribute, variant, and media management
- Angular screens for inventory listing, stock adjustments, reservations, and low-stock alerts
- All screens use the shared API client (`packages/api-sdk`) generated from OpenAPI
- Permission-aware screens using the existing RBAC guard pattern
- UI tests for successful saves, API validation failures, and upload failures

**Non-Goals:**
- Storefront implementation
- Payment, courier, or notification provider integrations
- Cross-client platform administration
- API changes (all screens use existing contract operations)

## Decisions

**Angular standalone components with the existing app shell**
- Rationale: The admin shell (`apps/admin`) already uses standalone components and `provideRouter`. Adding new screens as standalone components keeps consistency.
- Alternative: NgModules - rejected as it diverges from the existing shell architecture.

**Reuse the shared api-sdk client**
- Rationale: `packages/api-sdk` already generates typed clients from OpenAPI. New screens use `createApiClient` with the admin's bearer token.
- Alternative: Raw `HttpClient` calls - rejected as it bypasses type safety and requires manual contract maintenance.

**Form-driven UI from attribute definitions**
- Rationale: Category attribute definitions drive which fields render on the product form, keeping the admin flexible per category without code changes.
- Alternative: Hardcoded product form fields - rejected as it cannot support per-category attribute variation.

**Permission guards on screens**
- Rationale: Catalog screens require `catalog.*` permissions, inventory screens require `inventory.*` permissions, matching the API contract's `x-required-permission` values.
- Alternative: No screen-level guards - rejected as it would allow users to access screens they cannot use via the API.

## Risks / Trade-offs

- [Media upload via presigned URLs requires R2 credentials per client] → Credentials are configured per client via env, never committed; the admin screen only handles the upload flow, not credential management.
- [Attribute definitions must be defined before product creation] → The UI guides admins to define category attributes first; the product form gracefully degrades when no attributes are defined.
- [Stock adjustments that would drive stock below zero must be rejected] → Client-side validation plus server-side rejection; the UI shows the rejection reason from the API `Problem` response.

## Migration Plan

No database or API migration is needed. All screens use existing contract operations. Deploy the admin build to the client's Vercel/Cloudflare account alongside the existing admin deployment.

## Open Questions

None.
