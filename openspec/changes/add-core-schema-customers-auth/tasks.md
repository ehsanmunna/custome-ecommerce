## 1. Prisma schema

- [x] 1.1 Add the `CustomerStatus`, `OtpChannel`, `OtpPurpose`, `AdminUserStatus`, and `AdminRoleScope` enums to `packages/database/prisma/schema.prisma`
- [x] 1.2 Add the `Customer` model with nullable `phone` and `email`, optional `passwordHash`, verification/login timestamps, `active`/`blocked` status, unique identities, and snake_case mappings
- [x] 1.3 Add the `CustomerAddress` model with the required recipient and Bangladesh address fields, default shipping/billing flags, and the cascade relation to `Customer`
- [x] 1.4 Add the `OtpCode` model with channel, purpose, destination, code hash, expiry, consumption/invalidation timestamps, attempt counters, and lookup indexes
- [x] 1.5 Add the `AdminRole`, `AdminPermission`, and `AdminRolePermission` models with unique keys, role scope, system flag, group key, and snake_case mappings
- [x] 1.6 Add the `AdminUser` model with unique lowercase email, password hash, display name, `active`/`disabled` status, one required role, and lookup indexes
- [x] 1.7 Add the reverse relations from `Customer` and `AdminRole`, confirm the relation names and delete behaviors match `design.md`, then run `prisma format` and `prisma validate`
- [x] 1.8 Run `pnpm --filter database db:generate` and confirm the Prisma client builds with the new models

## 2. Forward migration

- [x] 2.1 Create `packages/database/prisma/migrations/20260104000000_customers_auth/migration.sql`
- [x] 2.2 Create the PostgreSQL enums, then the `customers`, `customer_addresses`, `otp_codes`, `admin_roles`, `admin_permissions`, `admin_role_permissions`, and `admin_users` tables in dependency order
- [x] 2.3 Add foreign keys: cascade addresses from customers, cascade role grants from roles, restrict permission deletion while granted, and restrict deleting a role in use by an admin
- [x] 2.4 Add customer checks for at-least-one identity, E.164 phone, lowercase email, password hash only with email, and minimum hash length
- [x] 2.5 Add address checks for uppercase two-letter country code and E.164 recipient phone
- [x] 2.6 Add OTP checks for non-empty minimum-length hash, expiry after creation, channel/destination agreement, purpose/channel agreement, attempt bounds, and at most one of consumed/invalidated
- [x] 2.7 Add admin checks for lowercase unique email, minimum-length password hash, and lowercase role/permission keys
- [x] 2.8 Add unique indexes for customer phone/email, admin email, role key, and permission key, plus the partial unique indexes for one default shipping and one default billing address per customer
- [x] 2.9 Add the lookup indexes from `design.md` for customer status, address customer, OTP destination/purpose/created time, OTP expiry, admin role/status, and role scope
- [x] 2.10 Add the `BEFORE DELETE` trigger that rejects deleting a role with `is_system = true`
- [x] 2.11 Confirm the SQL applies cleanly to an empty database with `pnpm --filter database db:migrate`
- [x] 2.12 Run `db:migrate` a second time and confirm it is a no-op, then confirm `db:status` and `schema_version` report the customers/auth migration
- [x] 2.13 Regenerate `src/expected-version.ts` and confirm it names the customers/auth migration

## 3. Integration tests

- [x] 3.1 Add `packages/database/test/integration/customers-auth-schema.spec.ts` using the existing migration reset helper
- [x] 3.2 Test customer identity rules: phone-only, email-plus-phone, neither identity, non-E.164 phone, and mixed-case email
- [x] 3.3 Test duplicate phone and email rejection, plus multiple accounts with null phone or null email
- [x] 3.4 Test customer password rules: hash with email, hash without email, short or empty hash, and phone-only customer without a password
- [x] 3.5 Test customer status default, blocked status, unsupported status, and address cascade when a customer is deleted
- [x] 3.6 Test address required fields, invalid recipient phone, country code default, one default shipping, one default billing, one address as both defaults, and defaults scoped per customer
- [x] 3.7 Test OTP hash length, expiry ordering, channel/destination agreement, purpose/channel agreement, negative attempts, zero maximum, attempts above maximum, consumed/invalidated exclusivity, and multiple history rows per destination
- [x] 3.8 Test admin user creation, duplicate email, mixed-case email, short hash, active/disabled status, required role, unknown role, and role-delete restriction
- [x] 3.9 Test role key uniqueness/format, store and platform scope, unsupported scope, system-role delete rejection, permission key uniqueness/format, grant uniqueness, role without grants, cascade on custom-role delete, restricted granted-permission delete, and effective permissions through the role
- [x] 3.10 Update `migrations.spec.ts` ledger assertions to expect the init, catalog, inventory, and customers/auth migrations
- [x] 3.11 Run `pnpm --filter database test:integration` against a fresh local database and confirm every new constraint test passes

## 4. Documentation and verification

- [x] 4.1 Document the customer identity rules, password/OTP hashing boundary, structured address and default rules, admin single-role model, role scopes, and system-role protection in `packages/database/README.md`
- [x] 4.2 Run `pnpm --filter database lint`, `pnpm --filter database typecheck`, and `pnpm --filter database test`
- [x] 4.3 Run a full fresh-database migration and the database integration suite one final time
- [x] 4.4 Confirm no API, admin, seed, or provider code changed in this change
- [x] 4.5 Run `openspec validate add-core-schema-customers-auth --strict`
