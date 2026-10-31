# Proposal

## Why

The admin dashboard's `defaultAdminAuthConfig` sets `apiBaseUrl: ''`, so all API calls from the admin dashboard resolve to the admin app's own origin. When the admin is served from a different origin or port than the API (e.g., admin on Vercel/Cloudflare, API on a shared VPS), every admin API call fails because the browser sends requests to the wrong host.

## What Changes

- Update `defaultAdminAuthConfig` so `apiBaseUrl` defaults to the apps/api URL (`http://localhost:3000` in development).
- Make `apiBaseUrl` overridable via environment variable (`ADMIN_API_BASE_URL`) for per-client deployment.
- Wire the environment variable into `app.config.ts` so the admin build can target the correct API URL per client.
- Verify all existing admin screens (dashboard, catalog, inventory, orders, settings, CMS, reporting) work against the configured API base URL.

## Capabilities

### New Capabilities

- `admin-config`: Admin dashboard runtime configuration, specifically the API base URL.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/admin/src/auth/auth.config.ts`, `apps/admin/src/app.config.ts`
- Affected APIs: None (no API changes needed).
- Depends on: `add-admin-shell-and-auth` (admin shell + auth already built).
- Non-goals: Changing any API endpoint or contract, modifying the storefront, adding new admin screens.

## Non-goals

- Modifying the NestJS API code or OpenAPI contract.
- Changing storefront configuration.
- Adding new admin dashboard screens or features.
