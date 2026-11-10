# Design

## Context

See proposal.md - Why for motivation and specs/admin-reporting/spec.md for requirements. The admin dashboard shell and authentication are complete (from `add-admin-shell-and-auth`). The OpenAPI contract and SDK are generated from `define-openapi-contract`. The reporting screens read from existing analytics (`GET /admin/analytics/overview`, `GET /admin/analytics/sales`) and inventory (`GET /admin/inventory?lowStock=true`) endpoints which are already implemented on the NestJS backend. No new API endpoints were created.

## Goals / Non-Goals

**Goals:**
- Angular screens for sales metrics and low-stock indicators
- All screens use the shared `HttpClient` with the admin's bearer token, following existing admin conventions
- Permission-aware screens using the existing RBAC guard pattern, matching API `x-required-permission` values

**Non-Goals:**
- Report export (PDF/CSV) or scheduled delivery
- Custom report builder or ad-hoc queries
- Storefront reporting
- New analytics storage or data models

## Decisions

### Reuse the shared HttpClient pattern

**Decision:** New screens use Angular `HttpClient` with the admin's bearer token, following the existing admin shell convention.

**Rationale:** All existing admin screens use raw `HttpClient` with `AuthService` and `ADMIN_AUTH_CONFIG`. Keeps consistency with the codebase.

**Alternative:** `packages/api-sdk` generated client - rejected as it was not yet integrated into the admin app and would require additional build configuration.

### Permission guards on screens

**Decision:** Reporting screens require `analytics.read` and `inventory.read` permissions, matching the API contract's `x-required-permission` values for the underlying endpoints.

**Rationale:** Prevents users from accessing screens they cannot use via the API. Server remains the final authority.

**Alternative:** No screen-level guards - rejected as it would expose screens to unauthorized users.

## Risks / Trade-offs

- [Money stored as integer poisha] → Revenue totals must divide by 100 for BDT display; consistent with the project's money convention.
- [Different screens may expose inconsistent loading and API errors] → Reuse shared HttpClient pattern and common error/loading presentation while keeping server responses authoritative.

## Migration Plan

No database migration is needed. Reporting reads existing order and inventory tables. Deploy the admin build alongside the existing admin deployment after the reporting API operations are implemented and contract-tested.

## Open Questions

None.
