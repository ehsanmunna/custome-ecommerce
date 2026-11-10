## 1. Persistence and configuration

- [x] 1.1 Add Prisma session and refresh-token history models, forward-only migration, and expected schema version.
- [x] 1.2 Add validated auth settings for token signing/hash secrets, access/refresh lifetimes, OTP expiry, attempt limits, and rate limits; require production secrets with no insecure defaults.
- [x] 1.3 Add and test shared token, session, and password-hashing services using cryptographically secure primitives.

## 2. Customer authentication

- [x] 2.1 Implement customer registration with identity normalization, uniqueness handling, password hashing, and public-safe responses.
- [x] 2.2 Implement customer email/password login and account-independent credential failures.
- [x] 2.3 Implement OTP issuance, rate limiting, purpose binding, hashed storage, delivery-adapter handling, and failure invalidation.
- [x] 2.4 Implement OTP verification, attempt accounting, single-use consumption, contact verification, and session establishment.
- [x] 2.5 Implement customer refresh rotation, replay revocation, logout, and current-identity behavior.

## 3. Admin authentication and authorization

- [x] 3.1 Implement admin email/password login and reject disabled accounts without disclosing account existence.
- [x] 3.2 Implement admin refresh rotation, replay revocation, logout, and current-identity responses.
- [x] 3.3 Implement customer/admin authentication guards that validate token audience, active session, and current account status.
- [x] 3.4 Implement permission and role-scope guards using current role grants and each operation's declared access metadata.

## 4. API contract and verification

- [x] 4.1 Add customer refresh/logout operations and align auth request/response/error schemas, including RFC 9457 errors, in the OpenAPI contract.
- [x] 4.2 Regenerate the SDK and preserve generated-file freshness and contract compatibility.
- [x] 4.3 Add unit and API integration tests for credential errors, OTP delivery/limits/expiry/reuse, session rotation/revocation, identity responses, permissions, scope, and guest access.
- [x] 4.4 Run API, database, OpenAPI, SDK, and contract checks; document required production OTP-provider setup and auth environment variables.
