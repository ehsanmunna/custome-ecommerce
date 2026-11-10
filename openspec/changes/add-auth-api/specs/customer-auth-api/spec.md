## Purpose

Defines the customer-facing authentication and session behavior used by storefront clients while
preserving guest access to shopping and checkout flows.

## ADDED Requirements

### Requirement: Customers can register with an available login identity

The system SHALL allow a customer to register with a valid phone number, a lowercase email, or both.
A password MUST be accepted only with an email and stored only as a non-reversible hash. Login
identities MUST remain unique. Registration MUST NOT require an account for guest checkout.

#### Scenario: Register an email customer with a password
- **WHEN** a customer submits a valid lowercase email and password
- **THEN** the account is created with a password hash and the raw password is not retained

#### Scenario: Register a phone-only customer
- **WHEN** a customer submits a valid phone number without an email or password
- **THEN** the account is created for OTP authentication

#### Scenario: Reject password without email
- **WHEN** a customer submits a password without an email
- **THEN** registration is rejected without creating an account

#### Scenario: Reject a duplicate login identity
- **WHEN** a customer submits an email or phone already assigned to another account
- **THEN** registration is rejected without disclosing another account's details

### Requirement: Customers can authenticate with email and password

The system SHALL authenticate an active customer only when the normalized email identifies an account
with a password hash that matches the submitted password. Invalid credentials and blocked accounts
MUST NOT establish a session, and credential errors MUST NOT disclose whether an account exists.

#### Scenario: Successful email login
- **WHEN** an active customer submits the correct password for their email
- **THEN** the system establishes a customer session

#### Scenario: Reject invalid credentials
- **WHEN** the email is unknown or the password does not match
- **THEN** the system rejects authentication with an account-independent credential error

#### Scenario: Reject a blocked customer
- **WHEN** a blocked customer submits otherwise valid credentials
- **THEN** no session is established

### Requirement: Customers can request and verify purpose-bound one-time codes

The system SHALL support SMS and email codes for login and registration verification. Codes MUST be
delivered only through the selected channel, MUST never be returned by the API, and MUST be bound to
the normalized destination and purpose. Issuance MUST be rate-limited; verification MUST enforce
expiry, single use, supersession, and the configured attempt limit. An unavailable delivery service
MUST produce an explicit temporary failure rather than a success response.

#### Scenario: Request a login code
- **WHEN** a customer requests an OTP for an eligible registered destination and channel
- **THEN** the code is sent through that channel and the response does not contain the code

#### Scenario: Request registration verification
- **WHEN** a customer requests an OTP for registration verification
- **THEN** the code is bound to that destination and registration purpose

#### Scenario: Verify a valid login code
- **WHEN** a customer submits an unexpired, unused code matching the destination, channel, and login purpose
- **THEN** the code is consumed and a customer session is established

#### Scenario: Verify a registration code
- **WHEN** a customer submits a valid registration-purpose code for an existing unverified identity
- **THEN** the code is consumed, the matching contact method is marked verified, and a customer session is established

#### Scenario: Reject an expired, consumed, mismatched, or exhausted code
- **WHEN** a code is expired, already consumed or invalidated, bound to another destination or purpose, or has exhausted its attempts
- **THEN** verification fails and no session is established

#### Scenario: Report delivery unavailability
- **WHEN** the configured OTP delivery adapter cannot deliver a requested code
- **THEN** the request returns a temporary failure and does not claim that delivery was accepted

#### Scenario: Limit OTP issuance
- **WHEN** a destination exceeds the configured issuance limit within its rate window
- **THEN** another code is not issued and the response does not reveal account existence

### Requirement: Customer sessions are refreshable and revocable

The system SHALL issue a short-lived access token and a refresh token after successful authentication.
Refresh tokens MUST be opaque, stored only as hashes, and rotated on every successful refresh.
Reusing a rotated refresh token MUST revoke its session. Logout MUST revoke the current session so its
access and refresh tokens are no longer accepted.

#### Scenario: Refresh a customer session
- **WHEN** a customer presents the current valid refresh token
- **THEN** the system returns a new access token and a new refresh token and invalidates the old refresh token

#### Scenario: Reject refresh-token reuse
- **WHEN** a customer presents a refresh token that has already been rotated
- **THEN** the session is revoked and no new tokens are issued

#### Scenario: Logout a customer
- **WHEN** an authenticated customer logs out
- **THEN** the session is revoked and its access and refresh tokens are rejected

### Requirement: Customer identity is authenticated and guest access is preserved

The system SHALL provide the authenticated customer's current identity only to a valid customer
session. Protected customer operations MUST reject missing, invalid, expired, revoked, blocked-user,
or wrong-audience credentials. Public and guest checkout operations MUST remain usable without a
customer session.

#### Scenario: Get current customer identity
- **WHEN** a valid customer requests their current identity
- **THEN** the response contains that customer's public identity and excludes password and token secrets

#### Scenario: Reject invalid customer credentials on a protected operation
- **WHEN** a request to a customer-protected operation has no valid customer session
- **THEN** the request is rejected without returning protected customer data

#### Scenario: Continue guest checkout
- **WHEN** a guest uses a public cart or checkout operation without authenticating
- **THEN** the operation remains available under its existing public contract
