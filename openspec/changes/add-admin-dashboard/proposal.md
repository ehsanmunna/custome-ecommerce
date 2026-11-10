# Proposal

## Why

The admin app is only a TypeScript placeholder, so store operators cannot run their business through the planned dashboard. Phase 3 needs to turn the existing admin API contract and authentication flow into a usable, permission-aware Angular application, completing contract-defined API gaps where needed.

## What Changes

- Build the Angular admin shell with login, session refresh/logout, protected routes, permission-aware menus, and per-client white-label configuration.
- Add role and permission management screens using the implemented role API; do not add admin self-registration.
- Deliver product, category, attribute, media, inventory, order, return, customer lookup, settings, shipping-zone, coupon, banner, and page workflows.
- Add sales, order, and low-stock reporting.
- Implement the contract-defined admin API operations required for these workflows that are not yet available, and define contract additions for customer lookup and any unsupported dashboard needs.
- Verify the dashboard against the API with focused UI, integration, and end-to-end coverage.

## Non-goals

- Storefront implementation or redesign.
- Payment-provider, courier, or notification-provider integrations beyond using existing API capabilities.
- Platform-wide or cross-client administration; the dashboard is scoped to one client deployment.
- Creating admin accounts in the dashboard; initial owner provisioning remains operational/seeding work.

## Capabilities

### New Capabilities
- `admin-console`: Dashboard shell, authentication lifecycle, permissions, role management, and white-label configuration.
- `admin-catalog-inventory`: Product, category, attribute, media, and stock workflows.
- `admin-orders`: Order processing, status changes, and returns.
- `admin-customers`: Customer lookup and customer/order context for support.
- `admin-settings-cms`: Store settings, shipping zones, coupons, banners, and pages.
- `admin-reporting`: Sales, order, and low-stock metrics.

### Modified Capabilities

None.

## Impact

Affected systems include `apps/admin` (currently a placeholder), the NestJS API and OpenAPI contract, and existing auth, roles, catalog, media, inventory, order, shipping, settings, promotions, CMS, and customer data. Current implemented operations cover admin auth, roles/permissions, catalog, media, and inventory; order, return, settings, shipping-zone, coupon, CMS, and analytics operations are contract-described but not marked implemented. Customer administration needs API contract work. The project has no existing capability specs, so this change introduces the six capabilities listed above.
