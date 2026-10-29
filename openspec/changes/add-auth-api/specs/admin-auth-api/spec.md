## Purpose

Defines administrator authentication, session lifecycle, current identity, and permission enforcement
so administrative API operations are available only to active, appropriately authorized staff.

## ADDED Requirements

### Requirement: Active administrators can authenticate with email and password

The system SHALL establish an admin session only when a lowercase email and password match an active
admin account. Disabled accounts and invalid credentials MUST NOT establish a session, and credential
errors MUST NOT disclose whether an account exists.

#### Scenario: Successful admin login
- **WHEN** an active administrator submits the correct password for their email
- **THEN** the system establishes an admin session

#### Scenario: Reject invalid admin credentials
- **WHEN** the email is unknown or the password does not match
- **THEN** authentication fails with an account-independent credential error

#### Scenario: Reject a disabled administrator
- **WHEN** a disabled administrator submits otherwise valid credentials
- **THEN** no session is established

### Requirement: Admin sessions are refreshable and revocable

The system SHALL issue a short-lived access token and a refresh token after successful admin
authentication. Refresh tokens MUST be opaque, stored only as hashes, and rotated on every successful
refresh. Reusing a rotated refresh token MUST revoke its session. Logout MUST revoke the current
session so its access and refresh tokens are no longer accepted.

#### Scenario: Refresh an admin session
- **WHEN** an administrator presents the current valid refresh token
- **THEN** the system returns a new access token and a new refresh token and invalidates the old refresh token

#### Scenario: Reject admin refresh-token reuse
- **WHEN** an administrator presents a refresh token that has already been rotated
- **THEN** the session is revoked and no new tokens are issued

#### Scenario: Logout an administrator
- **WHEN** an authenticated administrator logs out
- **THEN** the session is revoked and its access and refresh tokens are rejected

### Requirement: Admin identity exposes current role and effective permissions

The system SHALL provide the authenticated administrator's current identity, assigned role, scope,
and effective permissions. Effective permissions MUST reflect the role's current permission grants,
not stale permission data embedded in a previously issued token. Identity responses MUST exclude
password and token secrets.

#### Scenario: Get current admin identity
- **WHEN** an authorized active administrator requests their current identity
- **THEN** the response contains their identity, role, scope, and effective permissions

#### Scenario: Reflect changed role permissions
- **WHEN** an administrator's role permissions change while an access token remains unexpired
- **THEN** subsequent authorized requests use the updated permission grants

### Requirement: Admin operations enforce authentication, permissions, and role scope

The system SHALL reject unauthenticated, expired, revoked, disabled-user, or wrong-audience credentials
on protected admin operations. Each operation MUST enforce its declared permission against the
administrator's current role grants. Store and platform role scopes MUST remain distinct; a role in
one scope MUST NOT gain authority solely by having a role in the other scope.

#### Scenario: Reject an unauthenticated admin operation
- **WHEN** a request to a protected admin operation has no valid admin session
- **THEN** the request is rejected

#### Scenario: Reject an administrator without the required permission
- **WHEN** an authenticated administrator lacks the permission declared for an operation
- **THEN** the operation is denied without disclosing protected data

#### Scenario: Enforce the assigned role scope
- **WHEN** an administrator attempts an operation outside the authority of their assigned role scope
- **THEN** the operation is denied

#### Scenario: Keep public operations accessible without admin credentials
- **WHEN** a request targets an operation declared public
- **THEN** it remains accessible without an admin session and does not receive admin authority
