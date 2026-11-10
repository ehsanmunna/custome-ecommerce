## 1. Seed command and defaults

- [x] 1.1 Add stable store-role and permission defaults with the approved least-privilege grants; exclude platform roles
- [x] 1.2 Add conservative settings and inactive zero-fee Dhaka/outside-Dhaka zone defaults without district mappings
- [x] 1.3 Implement a repeatable, non-destructive seed operation that detects incompatible baseline-key collisions
- [x] 1.4 Add an explicit `db:seed` package command using `DATABASE_URL` only and fail clearly when migrations are absent

## 2. Optional admin bootstrap

- [x] 2.1 Add environment validation for optional bootstrap email/password; reject partial configuration
- [x] 2.2 Create the first active owner administrator only when no admin exists, hashing the password with Argon2id
- [x] 2.3 Add the required vetted Argon2id runtime dependency if no shared compatible hasher is available

## 3. Verification and documentation

- [x] 3.1 Add unit and database integration tests for defaults, role grants, idempotence, preserved configuration, and conflict handling
- [x] 3.2 Test absent, partial, valid, and existing-admin bootstrap cases, including that plaintext passwords are never stored
- [x] 3.3 Document seed environment variables and the migrate-then-seed client onboarding sequence
- [x] 3.4 Run database-package lint, typecheck, tests, relevant integration tests, and strict OpenSpec validation
