## Context

See `proposal.md` for motivation and `specs/platform-config/spec.md` and `specs/database-migrations/spec.md` for the behavior this design must deliver.

The repository currently contains only planning documents. There is no workspace, no application code, no database, and no CI. Every later change assumes a monorepo, an API that speaks `/v1`, and a migration stream that produces an identical schema in every client database. This change establishes those seams once so no later change has to invent them.

Constraints from the project instructions:

- One codebase for API, schema, and admin, deployed once per client.
- One PostgreSQL database per client; schema changes only through migrations.
- PostgreSQL with Prisma or TypeORM (Prisma chosen during exploration).
- API versioned at `/v1`; additive changes stay in the current version.
- No client-specific code in core.
- Money storage and PostgreSQL hosting location remain undecided and are not needed here.

## Goals / Non-Goals

**Goals:**

- A workspace where `pnpm install` and one command each for lint, typecheck, test, and migrate are enough to work on any package.
- A single migration stream that can initialize an empty database and upgrade a populated one.
- A startup guard that makes schema skew a deployment failure instead of a data-corruption incident.
- A local environment that mirrors production shape closely enough to rehearse migrations.

**Non-Goals:**

- Any domain table, seeding, or provisioning automation.
- Running multiple client deployments from this change; the mechanism is prepared, not exercised.
- A shared control plane for orchestration. That belongs to `provisioning`.
- Performance tuning of the API or database.

## Decisions

### 1. pnpm workspaces, no task runner yet

Use pnpm workspaces with `apps/*` and `packages/*`. Root scripts fan out with `pnpm -r`.

- **Why pnpm:** strict dependency resolution prevents phantom dependencies, and workspaces keep one lockfile for the whole monorepo.
- **Alternatives considered:** npm workspaces (weaker hoisting guarantees), Yarn Berry (more migration friction for little gain), Turborepo/Nx (premature while there is one real app and no build graph worth caching).
- Revisit a task runner when CI duration becomes painful, not before.

### 2. Prisma as the schema and migration tool

Prisma owns the schema definition and generates the client and SQL migrations.

- **Why Prisma:** migrations are committed SQL that can be reviewed like any other change, which matters when the same migration is applied to dozens of client databases; generated types reduce drift between schema and code.
- **Alternatives considered:** TypeORM (entity-diff migrations are harder to review and can hide destructive changes), Kysely + node-pg-migrate (excellent SQL control but more hand-written types), raw SQL only (loses type safety and schema diffing).
- Prisma's lack of native down migrations drives decision 5.

### 3. Schema and migrations live in `packages/database`

```
packages/database/
  prisma/
    schema.prisma          # single file for now; split into a folder when it grows
    migrations/            # ordered SQL migrations, committed
  src/
    index.ts               # exports the generated Prisma client
    expected-version.ts    # generated, checked by CI
```

- **Why a package instead of `apps/api/prisma`:** future workers, provisioning, integration tests, and reporting all need the same client and migrations. Putting it under the API would force those consumers to depend on the API app.
- The root `migrations/` directory mentioned in the instructions is replaced by this path. One owner is better than a root folder that Prisma cannot manage directly.
- Use a single `schema.prisma` until the catalog change makes it unwieldy, then move to Prisma's multi-file schema folder.

### 4. `schema_version` is a view over Prisma's ledger

Prisma creates and maintains `_prisma_migrations`. Do not duplicate it. The first migration creates:

```sql
CREATE VIEW schema_version AS
SELECT migration_name AS version, checksum, finished_at
FROM _prisma_migrations
WHERE finished_at IS NOT NULL
ORDER BY migration_name DESC
LIMIT 1;
```

- **Why a view:** one source of truth. A hand-maintained `schema_version` table written by a wrapper script can drift when a deploy is interrupted; a view cannot.
- **Alternatives considered:** a custom table updated after `prisma migrate deploy` (two writers, drift risk), a semantic version column (extra mapping to maintain; migration order is the real identity), relying on `_prisma_migrations` directly (leaks an internal name into every consumer).
- Treat `_prisma_migrations` as a stable contract and isolate the query in `packages/database`. If Prisma ever changes the table, only one module changes.
- `expected-version.ts` is generated from the newest migration directory name during the build. CI regenerates it and fails if the committed file differs. The runtime image therefore knows its expected version without reading the filesystem.

### 5. Forward-only migrations with snapshot rollback

Applied migrations are immutable. A mistake is corrected by a new forward migration. For production rollback, take a `pg_dump` snapshot immediately before migrating and restore it if the deploy must be undone.

- **Why:** Prisma does not generate down migrations, and hand-written down scripts are rarely tested and often lossy (dropped columns cannot be restored from the down script alone).
- **Alternatives considered:** a second raw-SQL migration tool with up/down pairs (two sources of truth, and Prisma would not track them), relying on `prisma migrate resolve` (records state, does not reverse data).
- This is acceptable because the snapshot is taken at the only moment rollback is realistic: immediately before deploy.
- Consequence for later changes: use expand/contract. Add columns and tables first, deploy code that writes both shapes, then remove the old shape in a later release. This keeps the previous API build compatible with the new schema during a rolling deploy.

### 6. Two database identities: runtime and migration

Local Compose creates two roles:

| Role | Privileges | Used by |
|---|---|---|
| `app_runtime` | `SELECT, INSERT, UPDATE, DELETE` on application tables, no DDL | API process |
| `app_migrator` | owner of the application schema, DDL | migration command |

- The API reads `DATABASE_URL` (runtime identity). Migration scripts read `MIGRATION_DATABASE_URL` (migration identity); the API must never receive that value.
- **Why:** the API should not be able to alter its own schema. This turns the "migrations are the only way to change schema" rule into a database-enforced constraint.
- The runtime role also cannot read `_prisma_migrations` beyond the view, which keeps health checks honest.
- In managed PostgreSQL, provisioning must grant these roles; that is deferred to `provisioning`, but the requirement is stated now so it is not lost.

### 7. Configuration validated with a schema, no required defaults

`apps/api/src/platform/config` parses `process.env` with a typed schema at bootstrap. Required keys have no fallback; optional keys have documented defaults. Secrets are redacted from logs.

- **Why a schema instead of scattered `process.env` reads:** one place to see every setting, one error listing every problem, and tests can assert failure modes.
- Use `@nestjs/config` with a validation function rather than a custom loader, to stay within NestJS conventions.
- Values needed by the API in this change: `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_PROBE_TIMEOUT_MS`, `LOG_LEVEL`. Optional: `ALLOW_SCHEMA_MISMATCH` is explicitly **not** added; there is no override.

### 8. Health checks are a dedicated module, versioned under `/v1`

Global prefix `api` is not used for health; the contract is `/v1/health/live` and `/v1/health/ready`, enabled with Nest's URI versioning and default version `1`.

- Liveness performs no I/O. Readiness runs `SELECT 1` through the Prisma client with a statement timeout derived from `DATABASE_PROBE_TIMEOUT_MS`, plus the schema-version comparison. If either fails, readiness is 503.
- The response body is an allowlisted shape: `{ status, checks: { database, schema } }`. No versions of secrets, no connection strings, no stack traces.
- **Why separate endpoints:** an orchestrator must not restart a process because the database is briefly unavailable; it should stop routing to it instead.

### 9. Docker Compose for local PostgreSQL only

`docker/compose.yaml` runs `postgres:16-alpine` with a health check, a named volume, and an init script that creates the two roles. The API itself is not containerized in this change.

- Committed `.env.example` documents every variable; `.env` stays untracked.
- **Why not containerize the API yet:** the deployment template is Phase 0/5 work and would add build complexity before the first endpoint exists. Running the API on the host against Compose Postgres is faster to iterate.

### 10. CI runs the migration path, not just unit tests

Assuming GitHub Actions (the repository has no CI provider configured yet), one workflow:

1. Install pnpm and Node, restore the lockfile cache.
2. Lint, typecheck, unit test.
3. Start a PostgreSQL service container with the migrator and runtime roles.
4. Run `db:migrate` against an empty database, then `db:status` and a query against `schema_version`.
5. Start the API and assert `/v1/health/ready` returns 200.
6. Fail if `expected-version.ts` is stale.

- **Why:** a migration system that is not exercised in CI will break on the first real client database.

## Risks / Trade-offs

- **Prisma has no down migrations** → snapshot before deploy, forward-fix after, rehearse restore on staging. Documented in each production release.
- **The view depends on Prisma's internal table** → isolate in one module, cover with an integration test that runs against real PostgreSQL, and pin the Prisma major version deliberately when upgrading.
- **Generated expected version can go stale** → generate during build, fail CI on mismatch, and never hand-edit the file.
- **Expand/contract is a discipline, not a switch** → record it in the migration requirements and enforce in review; a destructive migration without a prior compatible release is a defect.
- **Managed PostgreSQL may not allow a separate owner role** → provisioning must map the two identities to whatever the provider supports; if that is impossible, document the reduced guarantee rather than silently dropping the requirement.
- **Runtime startup now fails hard on schema mismatch** → a forgotten migration takes the instance down. That is intentional; the readiness probe and deployment order (migrate, then start) make the failure obvious and safe.
- **Prisma engine binaries inflate the API image** → use a multi-stage build later; note it for the deployment template.
- **Health endpoints are unauthenticated** → keep the body allowlisted and put them behind the load balancer's internal route when possible.

## Migration Plan

There is no production data yet, so this change has no data migration.

1. Land the workspace, database package, first migration (`schema_version` view plus nothing else), config module, health module, and CI.
2. Local: `docker compose up -d`, `pnpm db:migrate`, `pnpm --filter api start:dev`, verify both health endpoints.
3. CI proves the empty-database path and the startup guard on every commit.
4. Deployment order for every future client: snapshot → `db:migrate` with the migration identity → start the API with the runtime identity. A schema mismatch stops the API instead of serving against the wrong schema.
5. Rollback for this change: drop the local volume. For future clients: restore the pre-migration snapshot. Rehearse the restore on a staging copy before the first client deploy.

## Open Questions

- Where each client's PostgreSQL lives (shared VPS versus managed provider) changes connection and TLS settings but not the behavior or task breakdown. Settle before `add-provisioning-cli`.
- Whether the migration identity is a shared platform credential or a per-client role is a provisioning concern; the requirement that it is separate from the runtime identity is fixed here.
- Money storage (integer poisha versus `numeric(12,2)`) is intentionally untouched and must be settled before `add-core-schema-catalog`.
