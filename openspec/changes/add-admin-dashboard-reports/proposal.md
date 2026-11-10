# Proposal

## Why

Store operators can manage catalog, inventory, orders, settings, and CMS content through the admin dashboard, but they have no reporting capability. Sales, order, and low-stock metrics are contract-described but unreachable from the UI. This adds reporting screens so owners and managers can monitor business health without querying the database directly.

## What Changes

- Add sales/order metrics screens showing revenue, order counts, and averages by date range.
- Add low-stock indicator screens listing variants at or below their per-item threshold.
- Wire all reporting screens through Angular `HttpClient` with `AuthService` and `ADMIN_AUTH_CONFIG`, with permission guards matching API `x-required-permission` values.
- Add UI tests covering successful loads, permission denial, empty results, and API errors.

## Capabilities

### New Capabilities

- `admin-reporting`: Sales, order, and low-stock metrics screens for the admin dashboard.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin` (new Angular reporting screens).
- Affected APIs: existing analytics (`GET /admin/analytics/overview`, `GET /admin/analytics/sales`) and inventory (`GET /admin/inventory?lowStock=true`) operations; contract-described but already implemented.
- Depends on: `define-openapi-contract` (OpenAPI contract + SDK already generated), `add-admin-shell-and-auth` (admin shell + auth already built).
- Non-goals: Storefront reporting, exporting reports, scheduled report delivery, custom report builder.

## Non-goals

- Storefront report rendering or dashboards.
- Report export to PDF/CSV or scheduled email delivery.
- Custom report builder or ad-hoc query interface.
- New analytics storage or additional data models.
