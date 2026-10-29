## Why

The API already defines customer and admin authentication endpoints, and the database has customer/admin identities and OTP records, but no authentication flows or authorization guards are implemented. Implementing these flows will let storefront and admin clients authenticate consistently and protect API operations using the existing identity and permission model.

## What Changes

- Implement customer registration, email/password login, OTP login, refresh/logout, and current-customer identity.
- Implement admin login, refresh/logout, and current-admin identity.
- Add authentication guards for customer and admin identities and permission checks based on the admin user's current role assignments and scope.
- Persist revocable, rotating refresh sessions and enforce OTP expiry, attempt limits, purpose, and single-use behavior.
- Use a delivery interface for OTP; provider selection and production provider integration remain deferred. Requests must not appear successful when delivery is unavailable.
- Preserve guest checkout and the existing OpenAPI contract, updating its schemas or SDK only if implementation requires a contract correction.

## Capabilities

### New Capabilities
- `customer-auth-api`: Customer registration, authentication, session lifecycle, and current identity.
- `admin-auth-api`: Admin authentication, session lifecycle, current identity, and permission-guard behavior.

### Modified Capabilities
- None.

## Non-goals

- Admin user, role, or permission CRUD.
- Customer profile/address management beyond the current-identity endpoint.
- Selecting or integrating a production SMS/email delivery provider.
- Password reset, account recovery, multi-factor admin authentication, or guest-checkout changes.

## Impact

NestJS API modules, guards, configuration, and tests; PostgreSQL/Prisma session persistence and migrations; existing OpenAPI definitions and generated SDK if contract adjustments are needed. No client UI or admin-management API changes are included.
