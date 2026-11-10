# Spec Delta

## Purpose

Defines the admin console's authentication session lifecycle so administrators who sign in successfully remain signed in across navigation and page reloads until their access token expires or they sign out.

## ADDED Requirements

### Requirement: Successful sign-in establishes an authenticated session

When an administrator submits valid credentials, the admin console SHALL create an authenticated session containing the access token, refresh token, signed-in user, and an absolute expiry derived from the session's lifetime. The session SHALL be persisted so it survives a page reload.

#### Scenario: Valid credentials create a usable session

- **WHEN** an administrator signs in with valid credentials and the authentication endpoint returns a session
- **THEN** the access token, refresh token, user, and future expiry are stored, and the administrator is treated as authenticated for protected routes

#### Scenario: Invalid credentials do not create a session

- **WHEN** an administrator signs in with invalid credentials
- **THEN** no session state is stored, the administrator remains unauthenticated, and the sign-in error is shown

### Requirement: Session expiry is stored as an absolute timestamp and validated

The admin console SHALL store the session expiry as an absolute point in time. It SHALL treat the session as unauthenticated when the stored expiry is absent, malformed, non-positive, or earlier than the current time.

#### Scenario: Expiry is derived from the session lifetime

- **WHEN** the authentication endpoint returns a session lifetime in seconds
- **THEN** the stored expiry equals the current time plus that lifetime, and the session is authenticated before that time

#### Scenario: Expired session is rejected

- **WHEN** the stored expiry is earlier than the current time
- **THEN** the administrator is treated as unauthenticated

#### Scenario: Invalid stored expiry is rejected

- **WHEN** the stored expiry is missing, not a number, or not greater than zero
- **THEN** the administrator is treated as unauthenticated

### Requirement: Stored session is restored on startup

On application startup, the admin console SHALL restore a persisted session only when an access token and a valid future expiry are present, and SHALL preserve the stored signed-in user and role information for permission checks.

#### Scenario: Restoring a valid session

- **WHEN** the application starts with a stored access token and a future expiry
- **THEN** the administrator is authenticated without signing in again and retains the stored user, role, and permissions

#### Scenario: Restoring an expired session

- **WHEN** the application starts with a stored access token whose expiry has passed
- **THEN** the administrator is unauthenticated while the stored refresh token remains available for a refresh attempt

### Requirement: Token refresh replaces and persists the session

When the access token is refreshed successfully, the admin console SHALL replace the access token and expiry, preserve the existing refresh token when the response omits a new one, and persist the updated session so later requests use the new credentials.

#### Scenario: Successful refresh updates stored credentials

- **WHEN** a token refresh succeeds with a new access token and lifetime
- **THEN** the new access token and a new future expiry are stored, and subsequent authenticated requests use the new access token

#### Scenario: Refresh response omits a refresh token

- **WHEN** a successful refresh response contains no refresh token
- **THEN** the previously stored refresh token is retained

#### Scenario: Failed refresh does not create a session

- **WHEN** a token refresh fails
- **THEN** no replacement session is stored and the failure is reported to the caller

### Requirement: Current user is refreshed and persisted

The admin console SHALL update and persist the signed-in user and permissions when the current-user endpoint returns updated details, so permission-based checks reflect the latest server state.

#### Scenario: Current-user response updates stored user

- **WHEN** the current-user endpoint returns updated user details and permissions
- **THEN** the stored user and permissions are replaced with the returned values

### Requirement: Sign-out clears the session

When an administrator signs out, the admin console SHALL remove the access token, refresh token, expiry, and stored user, and SHALL treat the administrator as unauthenticated even if the sign-out request fails.

#### Scenario: Sign-out clears stored session

- **WHEN** an administrator signs out
- **THEN** all stored session data is removed and protected routes no longer grant access

#### Scenario: Sign-out endpoint fails

- **WHEN** the sign-out request fails
- **THEN** the local session is still cleared and the administrator is treated as unauthenticated

### Requirement: Protected routes require an unexpired session

Protected admin routes SHALL be accessible only while the restored or newly created session is authenticated. An unauthenticated or expired session SHALL redirect the administrator to the sign-in page and preserve the attempted route for post-sign-in navigation.

#### Scenario: Unauthenticated access is redirected

- **WHEN** an administrator opens a protected route without a valid session
- **THEN** the administrator is redirected to the sign-in page with the attempted route recorded

#### Scenario: Sign-in returns to the attempted route

- **WHEN** an administrator signs in successfully after being redirected from a protected route
- **THEN** the administrator is taken to that route instead of the default landing page
