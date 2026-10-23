## Why

Every later change—catalog, orders, payments, provisioning—depends on one repeatable way to build the workspace and evolve an identical schema across many client databases. Without that seam, client schemas drift and the "same schema and API for every client" rule cannot be enforced. This is change #1 in the plan and blocks all Phase 1 work.

## What Changes

- Create a pnpm workspace monorepo: `apps/api`, `apps/admin`, `apps/storefront-starter`, `packages/shared-types`, `packages/api-sdk`, `packages/database`, `docker`.
- Add Prisma as the schema and migration tool (previously an open decision—now locked).
- Keep migrations as version-controlled SQL under `packages/database/prisma/migrations`, applied with a single command; migrations are immutable once applied.
- Add a `schema_version` record (migration ledger) and make the API refuse to start when the database schema is ahead of, or behind, the running build.
- Validate required environment configuration at startup and fail fast with a clear error.
- Expose `/v1/health/live` and `/v1/health/ready`; readiness includes database connectivity.
- Add Docker Compose PostgreSQL for local development and a CI pipeline that installs, lints, typechecks, applies migrations to an empty database, and runs tests.

## Capabilities

### New Capabilities

- `platform-config`: startup configuration validation, health endpoints, and the schema-version compatibility check that protects every deployment.
- `database-migrations`: one ordered, version-controlled migration stream shared by every client database, with a recorded current schema version.

### Modified Capabilities

- None. No existing specs exist yet.

## Non-goals

- Domain tables (catalog, inventory, customers, orders, CMS)—covered by changes #2–#6.
- The seed script (#7) and client provisioning CLI (#26).
- Deployment templates, staging environments, and backups (#27).
- Down migrations. v1 uses forward-fix migrations and restore-from-snapshot rollback.
- Choosing money storage or the PostgreSQL hosting location.
- Admin or storefront UI.

## Impact

- Affected specs: `platform-config`, `database-migrations` (both new).
- Affected code: new workspace root, `apps/api` bootstrap, `packages/database`, `docker/`, CI configuration.
- Dependencies added: pnpm, Prisma, PostgreSQL 16, NestJS, Docker Compose.
- Operational impact: every client deployment must run the migration command before starting the API; staging rehearses every migration first.
