# Design

## Context

See proposal.md - Why for motivation and specs/admin-reporting/spec.md for requirements. The admin dashboard shell and authentication are complete (from `add-admin-shell-and-auth`). The OpenAPI contract and SDK are generated from `define-openapi-contract`. The reporting API operations (`/admin/reports/sales`, `/admin/reports/low-stock`) exist in the contract but are not yet implemented. This change adds Angular reporting screens that read from those existing contract operations, plus the API implementation work needed to serve them.

## Goals / Non-Goals

**Goals:**
- Angular screens for sales metrics and low-stock indicators
- All screens use the shared API client (`packages/api-sdk`) generated from OpenAPI
- Permission-aware screens using the existing RBAC guard pattern, matching API `x-required-permission` values
- API implementation for reporting read operations following NestJS conventions

**Non-Goals:**
- Report export (PDF/CSV) or scheduled delivery
- Custom report builder or ad-hoc queries
- Storefront reporting
- New analytics storage or data models

## Decisions

### Reuse the shared api-sdk client

**Decision:** New screens use `createApiClient` with the admin's bearer token.

**Rationale:** `packages/api-sdk` already generates typed clients from OpenAPI. Keeps type safety and avoids manual contract maintenance.

**Alternative:** Raw `HttpClient` calls - rejected as it bypasses type safety.

### Permission guards on screens

**Decision:** Reporting screens require `reports.sales.read` and `reports.low-stock.read` permissions, matching the API contract's `x-required-permission` values.

**Rationale:** Prevents users from accessing screens they cannot use via the API. Server remains the final authority.

**Alternative:** No screen-level guards - rejected as it would expose screens to unauthorized users.

### NestJS modules, controllers, services for API reporting operations

**Decision:** Implement reporting read operations as a NestJS `ReportsModule` with a controller at `/v1/admin/reports/*` and a service querying PostgreSQL via Prisma.

**Rationale:** Follows project NestJS conventions and PostgreSQL/Prisma data access. Keeps API versioned at /v1.

**Alternative:** TypeORM - rejected as the project standardizes on Prisma.

## Risks / Trade-offs

- [Reporting API operations not yet implemented] → The screens depend on contract-described `/admin/reports/*` endpoints that must be implemented before the UI can load data. Implement and contract-test the API operations first.
- [Money stored as integer poisha] → Revenue totals must divide by 100 for BDT display; consistent with the project's money convention.
- [Different screens may expose inconsistent loading and API errors] → Reuse shared typed API client and common error/loading presentation while keeping server responses authoritative.

## Migration Plan

No database migration is needed. Reporting reads existing order and inventory tables. Deploy the admin build alongside the existing admin deployment after the reporting API operations are implemented and contract-tested.

## Open Questions

None.
