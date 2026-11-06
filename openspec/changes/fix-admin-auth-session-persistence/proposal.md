# Proposal

## Why

A refactor converted the admin `AuthService.login()` and `refresh()` methods from Promises to Observables but dropped the call that persisted the returned session. A successful login therefore never updates the stored access token, expiry, or user. `isAuthenticated` keeps evaluating an old expiry restored from `localStorage`, reports the session as expired, and the route guard sends the administrator back to the login page. Token refresh has the same defect, so repeated requests continue using stale credentials.

## What Changes

- Persist the session returned by a successful login: access token, refresh token, absolute expiry (current time + `expiresIn`), and user.
- Persist the replacement session returned by a successful token refresh, preserving the existing refresh token when the response omits one.
- Persist the current user returned by the `/me` endpoint so restored sessions and permission checks use fresh data.
- Treat a missing, malformed, or non-positive stored expiry as an invalid session instead of treating it as a valid timestamp.
- Remove the temporary debug logging from the auth service and login component, and restore the normal post-login navigation.
- Update the admin auth unit tests to exercise the Observable API and cover login, refresh, user refresh, and expiry restoration.

## Capabilities

### New Capabilities

- `admin-auth`: session lifecycle for the admin console, including credential login, token and expiry persistence, session restoration, token refresh, current-user loading, logout, and authenticated route access.

### Modified Capabilities

None. The existing admin-console requirements cover the workspace shell and navigation, not session management.

## Impact

- `apps/admin/src/auth/auth.service.ts` — session persistence on login, refresh, and current-user load; expiry validation.
- `apps/admin/src/auth/login.component.ts` — remove diagnostic logging and restore straightforward navigation.
- `apps/admin/src/auth/auth.service.spec.ts` — update the HTTP test double for RxJS operators and verify persistence behavior.
- No API, database schema, or public contract changes. The admin app continues to consume the existing `/v1/admin/auth/*` endpoints.

## Non-goals

- Changing backend token issuance, TTLs, or refresh-token rotation.
- Adding proactive refresh before expiry, cross-tab synchronization, or "remember me" behavior.
- Redesigning the login page or route-guard behavior.
