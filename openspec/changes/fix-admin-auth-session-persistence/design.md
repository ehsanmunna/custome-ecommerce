# Design

## Context

See `proposal.md` for motivation. The admin authentication service currently exposes `login()` and `refresh()` as Observables, but neither persists the returned session. `applySession()` exists only as dead private code, and `me()` returns the server response without updating the local user. The service restores `accessToken`, `refreshToken`, `expiresAt`, and `currentUser` from browser storage on construction, so the stale persisted expiry is what `isAuthenticated` observes after a successful sign-in.

The admin app is Angular 21 with standalone components and RxJS. Unit tests use Vitest with a hand-written `HttpClient` double whose `pipe()` implementation only supports a single operator call and does not support real RxJS operators such as `tap` and `catchError`.

## Goals / Non-Goals

**Goals:**

- Make login and refresh persist the full session as part of the same operation that returns it.
- Keep `isAuthenticated` a pure read of token plus a defensible expiry.
- Make the existing auth unit tests exercise the real Observable API.

**Non-Goals:**

- Changing the HTTP auth endpoints, token format, or TTLs.
- Adding automatic refresh inside the route guard or before expiry.
- Changing the login page layout or translations.

## Decisions

### Persist inside the service with `tap`

`login()` and `refresh()` will pipe the HTTP response through `tap(session => this.applySession(...))` before returning it to the caller. `applySession` remains the single place that maps a session response to in-memory and persisted state.

**Alternative considered:** have `LoginComponent` and the interceptor call a public `setSession()`. Rejected because the original defect was introduced precisely by leaving persistence to callers; keeping it inside the service makes it impossible to consume a session without storing it.

For refresh, pass the current refresh token as the fallback so a response without a rotated refresh token does not erase the existing one. Capture it before `applySession` mutates it.

### Validate expiry once, in a small helper

Add a helper that accepts an unknown value and returns whether it is a finite number greater than zero. Use it in three places:

- `restoreFromStorage()`: invalid stored values become `expiresAt = null` instead of a coerced timestamp such as `0`.
- `isAuthenticated`: require a non-null, valid, future expiry.
- `applySession`: if `expiresIn` is not a finite positive number, store `null` rather than a misleading timestamp.

This addresses the reported "expiry older than today" symptom defensively: any malformed or epoch-zero value is treated as no session instead of a valid-but-past timestamp. The access token and refresh token may still be retained so a refresh attempt or explicit sign-in remains possible.

**Alternative considered:** derive expiry by decoding the JWT `exp` claim. Rejected because the API already returns `expiresIn`, and decoding would couple the client to token internals.

### Persist the refreshed current user

`me()` will pipe its response through `tap(user => { this.currentUser = user; this.persistToStorage(); })`. The existing unit test already expects this behavior, and permission checks read `currentUser` directly, so returning the response without storing it leaves role and permission state stale.

### Update the test double to return real Observables

Replace the custom `{ toPromise, pipe }` object in `auth.service.spec.ts` with `of(response)` for success and `throwError(() => error)` for failures. Await results with `firstValueFrom(...)`. Without this, adding `tap`/`catchError` to the service produces "Unable to lift unknown Observable type" failures that mask the persistence assertions.

### Remove diagnostic logging and restore navigation

Delete the `console.log` blocks in `isAuthenticated` and the login success handler, and return the success handler to a simple `void router.navigateByUrl(...)`. These were local debugging aids, not part of the intended behavior.

## Risks / Trade-offs

- **Clock skew between client and server** → `expiresIn` is relative, so client clock skew only affects the absolute timestamp locally; expiry remains consistent with the client's own clock.
- **A refresh token is retained after a bad expiry** → the guard redirects to sign-in, and the stale access token is not treated as valid; keeping the refresh token allows the existing 401 interceptor flow to recover instead of forcing a full credential entry.
- **Tests depend on a hand-written HTTP double** → the double is now simplified to RxJS factories, reducing the chance of divergence from `HttpClient` behavior.
- **Session persistence remains in `localStorage`** → unchanged from current behavior; moving to memory or cookies is a separate security decision.

## Migration Plan

No data migration. Existing stored sessions with a past or malformed expiry will be treated as unauthenticated on the next page load, then replaced by a valid session on the next successful sign-in. Rollback is a revert of the client changes.
