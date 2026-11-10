## Context

See `proposal.md` for motivation and scope. The database package uses Prisma 6.19.3 and PostgreSQL,
with a separate `DATABASE_URL` runtime identity restricted to DML and a `MIGRATION_DATABASE_URL`
identity reserved for schema migrations. Existing tables provide unique keys for store settings,
admin roles, permissions, and shipping zones. Password-bearing admin records require a non-reversible
hash; the auth design specifies Argon2id, and no password-hashing package currently exists in the
database or API package manifests.

## Goals / Non-Goals

**Goals:**
- Make one explicit database-package command provision safe, non-destructive client defaults after
  migrations.
- Keep the baseline role grants least-privileged and prevent accidental platform-role creation.
- Allow secure first-admin bootstrap without exposing migration credentials or replacing existing
  administrators.

**Non-Goals:**
- Apply migrations, create client databases, or configure external provider secrets.
- Assign shipping-zone districts or activate the placeholder zones; client operators must review
  and configure those before checkout can use them.
- Create a platform administrator; a separate future platform-administration change owns that flow.

## Decisions

### Use one DML-only database seed command

Add a `db:seed` script to the database package and implement it using the generated Prisma client.
It uses `DATABASE_URL` only, runs after the migration command, and never invokes Prisma migration
commands or reads `MIGRATION_DATABASE_URL`. This preserves the repository's runtime/migrator
privilege separation while fitting the existing database-package command pattern.

### Use additive baseline records and protect client configuration

Use stable, unique keys for each default role, permission, setting, and zone. Create missing rows and
grants without deleting data; preserve existing setting values and shipping-zone fees/active states.
Validate that colliding role keys still identify system store roles and fail clearly when an
incompatible record occupies a baseline key. Baseline grants are additive, while custom roles,
permissions, and unrelated configuration remain untouched.

Represent settings as JSON objects under stable keys: `tax` (`enabled: false`,
`rateBasisPoints: 0`), `payments` (`cod.enabled: true`, `online.enabled: false`), `courier`
(`enabled: false`), and `notifications` (`email.enabled: false`, `sms.enabled: false`). Use the
existing settings table and do not write provider secrets or secret references. Create `dhaka` and
`outside_dhaka` zones as inactive, zero-fee placeholders with no district mappings, since no
authoritative district assignment was chosen and the zones are not ready for checkout.

### Seed store-only role permissions

Use the exact underscore-separated permission keys specified in the capability delta to satisfy the
existing key-format constraint. Grant all catalog, inventory, order, and customer permissions plus
read-only settings and roles access to manager; grant catalog, inventory, and orders read access to
staff; and grant order and customer read access to support. Owner receives all permissions. Only
owner and manager receive order-status changes; only owner receives settings and role management.
Store roles are marked system roles and use store scope. Do not create platform-scoped permissions or
roles in this change.

### Bootstrap only the first administrator

If both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are absent, skip admin creation. If only one is
set, fail with a clear configuration error. Validate the email as lowercase and non-empty and reject
an empty password. If the admin table is empty, hash the configured password with Argon2id and
create an active user assigned to the owner role. Use optional `SEED_ADMIN_DISPLAY_NAME`, defaulting
to `Store Owner`. If any admin already exists, skip bootstrap without modifying any account. Add a
vetted Argon2id runtime dependency to the database package unless a shared compatible implementation
exists when the task is implemented; never store or log the plaintext password.

### Make a failed run explicit and atomic

Run baseline database writes in a transaction so a failed write does not leave a partial baseline.
Validate required environment configuration before starting writes, write actionable errors to
stderr, and return a non-zero process exit code on validation, compatibility, or database failures.
Report when optional admin creation is skipped because credentials are absent or an administrator
already exists.

## Risks / Trade-offs

- **The seed identity may not have table access before migrations** → document the required order:
  migrate with the migrator identity, then seed with the runtime identity.
- **Client operators may alter a baseline role's grants** → grants are additive and rerunning seed
  does not delete custom grants; baseline permission additions remain explicit and testable.
- **Argon2id adds a runtime dependency to a package that currently has none** → choose a maintained,
  platform-compatible implementation and verify install/build behavior as part of the change.
- **Inactive zones have no district mappings** → keep checkout from relying on unreviewed geography
  and require operators to configure districts and fees before activation.
- **Credentials can be present in process environments** → document secure environment injection,
  never provide defaults, and do not log credential values.

## Migration Plan

No schema migration is required. Operators first apply the existing schema migrations with
`MIGRATION_DATABASE_URL`, then run `pnpm --filter database db:seed` with the client runtime
`DATABASE_URL`. Rollback consists of removing only seed-created records through a reviewed,
client-specific data operation; the command itself does not delete or reverse data.
