# Custom e-commerce platform

Reusable e-commerce platform: one NestJS API, one Prisma schema and migration stream, one admin
dashboard, and a reference storefront starter. Each client gets their own database and storefront but
runs the same API and schema.

## Workspace layout

```
apps/api                 NestJS API (versioned at /v1)
apps/admin               Admin dashboard (placeholder until the admin phase)
apps/storefront-starter  SSR storefront starter (placeholder until the storefront phase)
packages/database        Prisma schema, migrations, generated client, migration scripts
packages/shared-types    Shared TypeScript contracts
packages/api-sdk         Typed TypeScript client generated from the OpenAPI contract
docker/                  Local PostgreSQL and CI database helpers
```

## Prerequisites

- Node.js 20.19 or newer (`.nvmrc` pins 20)
- pnpm 12 or newer (the repository pins `pnpm@12.15.0` through `packageManager`)
- Docker Desktop or another Docker engine for local PostgreSQL

Enable pnpm if it is not installed:

```bash
corepack enable pnpm
```

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm build
pnpm --filter api start:dev
```

Check both endpoints:

```bash
curl http://localhost:3000/v1/health/live
curl http://localhost:3000/v1/health/ready
```

Stop PostgreSQL with `pnpm db:down`. Remove its volume and start over with `pnpm db:reset`.

## Root scripts

| Script                                          | Purpose                                                         |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `pnpm build`                                    | Build every workspace package in dependency order               |
| `pnpm lint`                                     | Run ESLint in every package                                     |
| `pnpm typecheck`                                | Build the database package, then typecheck every package        |
| `pnpm test`                                     | Build the database package, then run unit and integration tests |
| `pnpm test:integration`                         | Run only the database integration tests                         |
| `pnpm format` / `pnpm format:check`             | Write / check Prettier formatting                               |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:reset` | Manage local PostgreSQL                                         |
| `pnpm db:migrate`                               | Validate applied checksums, then apply pending migrations       |
| `pnpm db:seed`                                  | Seed safe client defaults after migrations                      |
| `pnpm db:status`                                | Show applied, current, and pending migrations                   |
| `pnpm db:version`                               | Print the current `schema_version`                              |
| `pnpm db:generate`                              | Generate the Prisma client and `expected-version.ts`            |
| `pnpm version:generate`                         | Regenerate `expected-version.ts` only                           |
| `pnpm dev:api`                                  | Run the API in watch mode                                       |
| `pnpm contract:lint`                            | Validate the canonical OpenAPI document                         |
| `pnpm contract:check`                           | Check route coverage, contract invariants, and compatibility    |
| `pnpm contract:test`                            | Test contract compatibility checks                              |
| `pnpm --filter api-sdk generate`                | Regenerate the TypeScript SDK from OpenAPI                      |
| `pnpm --filter api-sdk generate:check`          | Fail if generated SDK types are stale                           |

## API contract

The v1 contract lives in [apps/api/openapi/openapi.yaml](apps/api/openapi/openapi.yaml). Health
liveness and readiness are currently implemented; other documented operations are planned and do
not become runtime routes until their feature changes are implemented. See
[apps/api/README.md](apps/api/README.md) for contract update, SDK generation, and compatibility
guidance.

## Environment variables

Copy `.env.example` to `.env`; `.env` is git-ignored. Optional seed-only bootstrap variables are
documented here and should be provided through the deployment environment only when needed.

| Variable                    | Required           | Meaning                                                          |
| --------------------------- | ------------------ | ---------------------------------------------------------------- |
| `DATABASE_URL`              | yes                | Runtime PostgreSQL identity used by the API. DML only, no DDL.   |
| `MIGRATION_DATABASE_URL`    | yes for migrations | Migration identity used only by migration and status commands.   |
| `SEED_ADMIN_EMAIL`          | optional           | Lowercase email for optional first store-admin bootstrap.        |
| `SEED_ADMIN_PASSWORD`       | optional           | Password for optional first store-admin bootstrap; never commit. |
| `SEED_ADMIN_DISPLAY_NAME`   | optional           | Initial admin display name (defaults to `Store Owner`).          |
| `NODE_ENV`                  | yes                | `development`, `test`, or `production`.                          |
| `PORT`                      | yes                | HTTP port (`3000` locally).                                      |
| `DATABASE_PROBE_TIMEOUT_MS` | yes                | Upper bound for health and schema probes.                        |
| `LOG_LEVEL`                 | yes                | `fatal`, `error`, `warn`, `info`, `debug`, or `trace`.           |

Required values have **no fallback**: the API refuses to start and names every missing or invalid key
before it binds a listener.

## Two database identities

| Identity       | Used by                                       | Privileges                                     |
| -------------- | --------------------------------------------- | ---------------------------------------------- |
| `app_runtime`  | API process (`DATABASE_URL`)                  | `SELECT`, `INSERT`, `UPDATE`, `DELETE`; no DDL |
| `app_migrator` | Migration commands (`MIGRATION_DATABASE_URL`) | Owns the schema and may run DDL                |

The API must never receive `MIGRATION_DATABASE_URL`. The local theme is created by
`docker/initdb/01-roles.sql`. Client provisioning must create the same split.

For a new client database, apply migrations first with `MIGRATION_DATABASE_URL`, then run
`pnpm db:seed` with the runtime `DATABASE_URL`. Provide both bootstrap credential variables together
only when creating the first store administrator. See
[database seeding](packages/database/README.md#client-database-seeding) for seeded defaults and
preservation behavior.

## Migrations

- Migrations live in `packages/database/prisma/migrations` and are committed SQL.
- An applied migration is immutable. `pnpm db:migrate` verifies the SHA-256 checksum of every
  applied migration before applying anything and fails on a modified or missing file.
- `schema_version` is a view over Prisma's ledger and always returns the newest applied migration.
- `packages/database/src/expected-version.ts` is generated from the newest migration directory. Never
  edit it by hand; CI regenerates it and fails if it differs.

Create a new migration with the migration identity:

```bash
# bash
DATABASE_URL="$MIGRATION_DATABASE_URL" pnpm --filter database exec prisma migrate dev --name add_example
pnpm version:generate
```

```powershell
# PowerShell
$env:DATABASE_URL=$env:MIGRATION_DATABASE_URL
pnpm --filter database exec prisma migrate dev --name add_example
pnpm version:generate
```

`prisma migrate dev` is for authoring migrations locally. Deployments use `pnpm db:migrate`, which
runs `prisma migrate deploy` after the checksum guard.

## Deployment and rollback

The API checks the database schema version before it binds a listener. A database that is behind,
ahead, or uninitialized stops startup with a distinct error. Readiness repeats the check on every
request and returns 503 when the database or schema is not usable.

Every deployment follows: snapshot, migrate with `MIGRATION_DATABASE_URL`, then start the API with
`DATABASE_URL`. See [docs/database-operations.md](docs/database-operations.md) for the rollback
procedure, the expand/contract rule, and the forward-fix policy.

## Continuous integration

`.github/workflows/ci.yml` installs with a frozen lockfile, lints, typechecks, runs unit and
migration integration tests against PostgreSQL 16, migrates an empty database, runs `db:status`,
fails on a stale `expected-version.ts`, and starts the built API to assert `/v1/health/ready`
returns 200.
