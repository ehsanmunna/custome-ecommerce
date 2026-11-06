# Tasks

## 1. Persist sessions in the auth service

- [x] 1.1 Add an expiry-validation helper that accepts only finite numbers greater than zero, and use it in `restoreFromStorage()` and `isAuthenticated` so missing, malformed, and non-positive stored values produce an unauthenticated session; verify with unit tests for `''`, `'not-a-number'`, and `'0'`.
- [x] 1.2 In `applySession()`, store `null` for `expiresAt` when `expiresIn` is not a finite positive number; verify no misleading past timestamp is persisted.
- [x] 1.3 Pipe the `login()` response through `tap` so a successful login calls `applySession(session)`; verify `isAuthenticated`, the access token, expiry, user, and storage keys are updated in `auth.service.spec.ts`.
- [x] 1.4 Pipe the `refresh()` response through `tap` so a successful refresh calls `applySession(session, currentRefreshToken)`, capturing the existing refresh token before the call; verify the new access token and expiry persist and the old refresh token is retained when the response omits one.
- [x] 1.5 Pipe the `me()` response through `tap` so `currentUser` is replaced and persisted; verify the stored user and permissions reflect the endpoint response.

## 2. Clean up the sign-in flow

- [x] 2.1 Remove the diagnostic `console.log` block from `isAuthenticated` and restore the original boolean expression; verify no console output remains in `apps/admin/src/auth/auth.service.ts`.
- [x] 2.2 Remove the diagnostic logging and `async` handler from the login success path and navigate with `void router.navigateByUrl(url)`; verify no console output remains in `apps/admin/src/auth/login.component.ts` and the typecheck passes.

## 3. Repair and extend auth tests

- [x] 3.1 Replace the hand-written `{ toPromise, pipe }` HTTP double in `auth.service.spec.ts` with RxJS `of(...)` for success and `throwError(() => error)` for failure, and await Observables with `firstValueFrom(...)`; verify all auth service tests execute instead of failing with "Unable to lift unknown Observable type".
- [x] 3.2 Add coverage for the expired-session flow: a stored past expiry restores as unauthenticated while the refresh token remains available; verify via the restore test.
- [x] 3.3 Add coverage for the invalid-expiry cases and the refresh-token fallback; verify the new assertions fail before the service fix and pass after it.

## 4. Verification

- [x] 4.1 Run `npx vitest run src/auth/auth.service.spec.ts` from `apps/admin` and verify every test passes.
- [x] 4.2 Run `npm run typecheck` from `apps/admin` and verify it completes without errors.
- [x] 4.3 Run `npm run lint -- --quiet` from `apps/admin` and verify no new lint errors are reported in the auth files.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
