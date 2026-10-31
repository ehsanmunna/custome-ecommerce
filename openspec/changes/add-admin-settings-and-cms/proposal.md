# Proposal

## Why

The admin dashboard shell, authentication, catalog, inventory, orders, and returns screens are complete, but no settings or CMS management screens exist yet. Store operators cannot configure shipping zones, coupons, pages, or banners through the admin panel, which blocks Milestone 2: "A client can run the business from the admin panel." This change builds those admin workflows on top of the existing settings and CMS API contract.

## What Changes

- Build settings screens: shipping zone list/create/edit/delete, coupon list/create/edit/delete
- Build CMS screens: page list/create/edit/delete, banner list/create/edit/delete
- Wire all screens through the shared API client (`packages/api-sdk`) generated from OpenAPI
- Add permission-aware UI using the existing RBAC guard pattern, matching API `x-required-permission` values
- Add UI tests for settings and CMS workflows covering successful saves, API validation failures, and permission-denied scenarios

## Capabilities

### New Capabilities

- `admin-settings`: Shipping zone and coupon management screens for the admin dashboard
- `admin-cms`: Page and banner management screens for the admin dashboard

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin` (new Angular components and screens for settings and CMS)
- Affected APIs: existing settings API (`GET/PATCH /admin/settings`), coupon API (`GET/POST/PATCH/DELETE /admin/coupons`), page API (`GET/POST/PATCH/DELETE /admin/pages`), banner API (`GET/POST/PATCH/DELETE /admin/banners`)
- Depends on: `define-openapi-contract` (OpenAPI contract + SDK already generated), `add-admin-shell-and-auth` (admin shell + auth already built)
- Non-goals: Storefront settings rendering, payment/courier provider integrations beyond existing API capabilities, storefront page/banner rendering

## Non-goals

- Storefront page or banner display (handled by separate storefront change)
- Payment or courier provider integrations (handled by existing API capabilities)
- Creating new API endpoints (all screens use existing contract operations)
