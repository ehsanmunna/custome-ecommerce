## Why

Customers and staff cannot exist without shared identity tables, and every later auth, order, and
admin feature depends on them. This is change #4 in the Phase 1 plan: it adds the customer, address,
OTP, admin user, role, and permission schema before any API code is written.

## What Changes

- Add Prisma models and one forward migration for customers, customer addresses, OTP records, admin
  users, admin roles, permissions, and role-permission grants.
- Give customer accounts a phone identity, an email identity, or both. Phone login stays OTP-based;
  email login uses a stored password hash. An account without either identity is rejected.
- Keep guest checkout possible without a customer account. Guest contact data belongs to the later
  order schema, not to this change.
- Store customer addresses with structured Bangladesh delivery fields (recipient, phone, address
  lines, area, district, division, postal code, country), with at most one default shipping and one
  default billing address per customer.
- Store OTP records with a hashed code, channel (`sms` or `email`), purpose, normalized destination,
  mandatory expiry, consumption time, attempt count, and maximum attempts. Raw codes are never
  stored.
- Give admin users a unique lowercase email, a password hash, a display name, a status, and exactly
  one role.
- Model roles with a stable key and a `store` or `platform` scope. Model permissions as a catalog and
  grant them to roles through role-permission links. Seeded default roles, including super-admin,
  arrive with the seed change, but system roles cannot be deleted.
- Enforce integrity with checks, unique and partial unique indexes, foreign keys, one deletion
  trigger, and integration tests against real PostgreSQL.

## Capabilities

### New Capabilities

- `auth-customers`: customer identities, password hashes, addresses, OTP records, and default-address
  rules for the shared schema.
- `auth-admin`: admin users, roles, permission catalog, role grants, and platform/store role
  separation for the shared schema.

### Modified Capabilities

- None. The existing `database-migrations` requirements already cover how the new migration is
  applied.

## Non-goals

- Auth APIs, guards, controllers, sessions, refresh tokens, JWTs, login screens, or admin UI.
- OTP delivery, SMS/email provider integration, rate-limit middleware, or background expiry jobs.
- Carts, orders, guest checkout tables, or address snapshots for guest orders.
- Seed data, default role/permission rows, or the first admin user.
- Audit log (change #6), password-reset flows, MFA, customer social login, or admin SSO.
- Customer metadata, segmentation, loyalty, marketing fields, or per-user permission overrides.
- Multi-role admins, multi-tenant/client columns, or per-client schema branches.

## Impact

- Affected specs: `auth-customers`, `auth-admin` (both new).
- Affected code: `packages/database` (Prisma models, one migration, `expected-version.ts`, and
  integration tests); no API routes in this change.
- Dependencies: no new runtime packages; PostgreSQL 16 features already available.
- Operational impact: every client database must run `db:migrate` before deploying a build that
  expects the customer and admin-auth schema.
