## Context

See proposal.md and the customer/admin auth API specs. The API is NestJS with PostgreSQL/Prisma. The
database already contains customer/admin identity, role/permission, and OTP records, but no auth
session records or auth modules exist. The canonical OpenAPI contract defines most login, OTP,
identity, and admin session operations; customer refresh/logout operations will need to be added.
Production SMS/email providers have not been selected.

## Goals / Non-Goals

**Goals:**
- Keep customer and admin credentials, audiences, and authorization paths distinct.
- Make refresh rotation and logout revocable across API instances.
- Enforce current account status and current admin role grants on protected requests.
- Keep OTP delivery replaceable and make provider failure explicit.

**Non-Goals:**
- Implement SMS/email vendor integrations or decide their credentials.
- Add admin user, role, or permission management endpoints.
- Add password recovery or changes to guest checkout.

## Decisions

1. **Use short-lived signed access tokens and persisted rotating refresh sessions.** Access tokens carry
   the identity type, subject, and session identifier; they do not carry authoritative admin
   permissions. Persist sessions and one-way refresh-token hashes in PostgreSQL, retaining consumed
   token hashes until session expiry. Rotate the refresh token atomically. Reuse of a consumed token
   revokes its session. Each protected request validates the session and current account status, so
   logout and account disable/block take effect immediately. This adds a database lookup to protected
   requests but avoids stale authorization and unrevocable access tokens. Stateless refresh tokens
   were rejected because logout and replay detection require server-side state.
2. **Derive admin permissions from the current role assignment.** Resolve role scope and permission
   grants during authorization, using the contract's access and required-permission metadata. Do not
   trust permissions copied into a token. This makes role/permission edits effective without waiting
   for token expiry. A platform role does not implicitly satisfy store-scope permissions, or vice
   versa.
3. **Use an OTP delivery port with no implicit success fallback.** Generate codes with a
   cryptographically secure source, persist only a one-way keyed hash, and deliver through an
   injectable SMS/email adapter. If no adapter is configured or delivery fails, invalidate the
   pending code and return a temporary failure; never expose codes in responses or logs. Use a fake
   adapter only in tests. A production provider can be selected and added independently without
   changing the API behavior.
4. **Extend the canonical OpenAPI contract additively.** Add customer refresh/logout operations and
   align any schema details required by the implemented auth flows; regenerate the SDK and verify
   contract compatibility. Serialize API exceptions using the contract's RFC 9457 problem format.
   Keep the existing admin auth routes and the public/guest operation declarations intact.
5. **Keep credential processing at the API boundary.** Normalize email and phone before lookup,
   use a modern password-hashing function with deployment-configured work factors, and return
   account-independent credential errors. Rate-limit OTP issuance and verification using retained
   issuance history and bounded attempt counts.

## Risks / Trade-offs

- [Session validation adds a database dependency to every protected request] → Use the shared
  Prisma connection and fail closed if session or status validation is unavailable.
- [Refresh replay may be caused by clients retrying an already-processed request] → Treat reuse as
  compromise and revoke the session; clients must serialize refresh attempts and discard replaced
  tokens.
- [OTP flows cannot deliver messages until a provider is configured] → Fail explicitly and document
  the required provider setup; do not ship a success-shaped stub.
- [OpenAPI changes may cause generated SDK drift] → Regenerate SDK artifacts and run contract,
  compatibility, and freshness checks in CI.

## Migration Plan

1. Add Prisma models and a forward-only migration for auth sessions and refresh-token history; keep
   existing customer, admin, and OTP rows unchanged.
2. Deploy the migration before the API version that reads the new tables. No existing tokens need to
   be migrated because no auth sessions currently exist.
3. Configure signing/hash secrets and token lifetimes through validated environment settings. Require
   a real OTP adapter before enabling OTP delivery in a production environment.
4. Deploy API modules, guards, contract, and SDK together. Roll back by reverting the API deployment;
   retain the additive tables during rollback and remove them only in a separately reviewed migration.

## Open Questions

- Which production SMS and email provider(s) should implement the delivery port before enabling OTP
  authentication in a production deployment?
