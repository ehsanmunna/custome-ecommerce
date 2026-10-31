# Design

## Context

The admin dashboard shell and authentication are complete (from `add-admin-shell-and-auth`). The OpenAPI contract and SDK are generated from `define-openapi-contract`. Settings and CMS API endpoints already exist on the NestJS backend (`GET/PATCH /admin/settings`, `GET/POST/PATCH/DELETE /admin/coupons`, `GET/POST/PATCH/DELETE /admin/pages`, `GET/POST/PATCH/DELETE /admin/banners`) with permission checks. This change builds Angular screens on top of those existing APIs using the shared `api-sdk` client.

See `proposal.md` - Why for motivation and `specs/admin-settings/spec.md` + `specs/admin-cms/spec.md` for requirements.

## Goals / Non-Goals

**Goals:**
- Angular screens for shipping zone, coupon, page, and banner management
- All screens use the shared API client (`packages/api-sdk`) generated from OpenAPI
- Permission-aware screens using the existing RBAC guard pattern
- UI tests for successful saves, API validation failures, and permission-denied scenarios

**Non-Goals:**
- Storefront page or banner rendering
- Payment or courier provider integrations
- Creating new API endpoints (all screens use existing contract operations)

## Decisions

**Angular standalone components with the existing app shell**
- Rationale: The admin shell already uses standalone components and `provideRouter`. Adding new screens as standalone components keeps consistency.
- Alternative: NgModules - rejected as it diverges from the existing shell architecture.

**Reuse the shared api-sdk client**
- Rationale: `packages/api-sdk` already generates typed clients from OpenAPI. New screens use `createApiClient` with the admin's bearer token.
- Alternative: Raw `HttpClient` calls - rejected as it bypasses type safety and requires manual contract maintenance.

**Permission guards on screens**
- Rationale: Settings screens require `settings.*`/`shipping.zones.*`/`promotions.coupons.*` permissions, CMS screens require `cms.*` permissions, matching the API contract's `x-required-permission` values.
- Alternative: No screen-level guards - rejected as it would allow users to access screens they cannot use via the API.

**Bangla/English translations for CMS content**
- Rationale: The project supports bn/en locales; CMS page and banner content must be translatable per locale.
- Alternative: Single-language content - rejected as it cannot support the project's bilingual requirement.

## Risks / Trade-offs

- [Coupon date validation must be enforced both client and server side] → Client pre-validates date ranges; server returns `Problem` responses for invalid dates which the UI must display.
- [Page/banner translations must include at least one locale] → Client validates that content is not empty before submission; server enforces the same.
- [Shipping zone codes must be unique] → Server rejects duplicates with a `Problem` response; the UI shows the error.

## Migration Plan

No database or API migration is needed. All screens use existing contract operations. Deploy the admin build alongside the existing admin deployment.

## Open Questions

None.
