## Why

Every client database needs a consistent, usable baseline after migrations, but manually creating roles, settings, and delivery zones is error-prone. A repeatable seed command will provision safe defaults and optionally bootstrap the first store admin without embedding credentials or overwriting an existing account.

## What Changes

- Add a database seed command for owner, manager, staff, and support roles, baseline permission grants, conservative store settings, and inactive Dhaka/outside-Dhaka zones with zero placeholder fees.
- Allow optional first-admin creation only when bootstrap email and password are provided through environment variables; hash the password with Argon2id and never replace an existing admin.
- Make repeated seed runs idempotent and report failures explicitly.
- Document bootstrap environment variables and the client onboarding seed workflow. Run seeding after migrations with the runtime `DATABASE_URL`; the seed command does not apply migrations or use `MIGRATION_DATABASE_URL`.

## Capabilities

### New Capabilities

- `database-seeding`: Repeatable installation of safe baseline data and optional secure first-admin bootstrap.

### Modified Capabilities

- None.

## Non-goals

- Seed platform tech-admin/super-admin roles, demo customers, products, orders, coupons, CMS pages, or media. The platform role is deferred to a separate future platform-administration change.
- Commit credentials, create a hard-coded default password, or automatically rotate/overwrite existing admins.
- Create databases, apply schema migrations, configure provider secret managers, or provision external infrastructure.
- Define API, admin UI, or client onboarding CLI behavior beyond invoking and documenting the seed command.

## Impact

- Expected scope: database package seed script/command, role and permission defaults, settings and zone rows, focused tests, and database/onboarding documentation.
- No schema migration is expected; the script uses the existing PostgreSQL schema and database tooling. The database package currently has no password-hashing dependency, so implementation must add a vetted Argon2id runtime dependency unless a shared compatible hasher is introduced first.
- The seed command uses the runtime database identity for DML only. Operators must apply migrations separately with the migration identity before seeding.
