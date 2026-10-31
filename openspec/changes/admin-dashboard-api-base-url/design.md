# Design

## Context

See `proposal.md` - Why for motivation and `specs/admin-config/spec.md` for requirements. The admin dashboard shell and authentication are complete (from `add-admin-shell-and-auth`). The `defaultAdminAuthConfig` currently sets `apiBaseUrl: ''`, which only works when the admin is served from the same origin as the API. Per the project architecture, the admin is deployed separately from the API (admin on client's Vercel/Cloudflare, API on shared VPS), so the API base URL must be configurable.

## Goals / Non-Goals

**Goals:**
- Configure `apiBaseUrl` to default to the apps/api URL (`http://localhost:3000`)
- Allow `apiBaseUrl` to be overridden via `ADMIN_API_BASE_URL` environment variable
- Wire the environment variable into `app.config.ts` so builds target the correct API URL
- Ensure all existing admin screens work against the configured API base URL

**Non-Goals:**
- Modifying the NestJS API code or OpenAPI contract
- Changing storefront configuration
- Adding new admin dashboard screens or features

## Decisions

### Environment variable injection via app.config.ts

**Decision:** Read `ADMIN_API_BASE_URL` from `process.env` in `app.config.ts` and pass it as the `ADMIN_AUTH_CONFIG` value, falling back to `http://localhost:3000` when unset.

**Rationale:** Angular applications built with `ng serve` or `ng build` can inline environment variables at build time. `app.config.ts` is already the central provider location for `ADMIN_AUTH_CONFIG`. A browser polyfill in `src/polyfills.ts` defines `window.process = { env: {} }` when `process` is not defined (browser environments), imported first in `src/main.ts` so `process.env` is available when `app.config.ts` is evaluated.

**Alternative:** Use Angular `environment.ts` files - rejected as it requires maintaining multiple environment files per client.

### API Versioning

**Decision:** All admin API calls include `/v1` after the base URL (e.g., `http://localhost:3000/v1/admin/analytics/overview`).

**Rationale:** The NestJS API uses URI versioning (`VersioningType.URI` with default version '1'), so all routes require the `/v1/` prefix.

**Alternative:** Omit `/v1` and rely on API default versioning - rejected as it would cause all API calls to fail.

### Default API base URL

**Decision:** Default to `http://localhost:3000` in development, matching the API's default dev port (`PORT=3000`).

**Rationale:** Keeps local development working out of the box without requiring developers to set an environment variable.

**Alternative:** Default to empty string (current behavior) - rejected as it breaks cross-origin deployment.

### No API contract changes

**Decision:** No changes to the NestJS API, OpenAPI contract, or SDK are needed.

**Rationale:** The API already accepts requests at its base URL; only the admin client needs to know where to send requests.

## Risks / Trade-offs

- [Environment variable not set in production] → Admin dashboard would fall back to `http://localhost:4000`, which would fail in production. Deployment documentation must note that `ADMIN_API_BASE_URL` is required for production builds.
- [CORS preflight] → The API must allow requests from the admin's origin (`http://localhost:4200`). Fixed by enabling CORS in `apps/api/src/main.ts` with `origin: 'http://localhost:4200'` and `credentials: true`.

## Migration Plan

No database or API migration needed. Deploy the updated admin build with `ADMIN_API_BASE_URL` set to the production API URL.

## Open Questions

None.
