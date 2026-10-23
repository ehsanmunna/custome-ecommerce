## 1. Workspace scaffold

- [x] 1.1 Add `pnpm-workspace.yaml`, root `package.json`, `.npmrc`, `.gitignore`, `.nvmrc`, and `.editorconfig`
- [x] 1.2 Add a base `tsconfig.base.json` and shared ESLint and Prettier configuration
- [x] 1.3 Create `apps/api` from the NestJS starter and remove the generated sample module
- [x] 1.4 Create placeholder `apps/admin`, `apps/storefront-starter`, `packages/shared-types`, and `packages/api-sdk` packages with a README and buildable empty entry point
- [x] 1.5 Add root scripts for `lint`, `typecheck`, `test`, and `build` that fan out across the workspace
- [x] 1.6 Confirm a clean clone installs, builds, lints, and typechecks with one command each

## 2. Database package and migration stream

- [x] 2.1 Create `packages/database` with its own `package.json`, TypeScript config, and a `src/index.ts` that exports the Prisma client
- [x] 2.2 Add `prisma/schema.prisma` with the PostgreSQL datasource and client generator, using `MIGRATION_DATABASE_URL` for migrations
- [x] 2.3 Write the first migration that creates the `schema_version` view over `_prisma_migrations`
- [x] 2.4 Add a script that generates `src/expected-version.ts` from the newest migration directory name
- [x] 2.5 Add `db:migrate`, `db:status`, `db:version`, and `db:generate` scripts to the package
- [x] 2.6 Add an integration test that applies migrations to an empty database and asserts `schema_version` returns the newest version
- [x] 2.7 Add an integration test that runs `db:migrate` twice and asserts the second run changes nothing
- [x] 2.8 Add an integration test that modifies an applied migration and asserts the migration command fails on checksum mismatch
- [x] 2.9 Add an integration test that applies a table-creating fixture migration, inserts a row, applies a second fixture migration, and asserts the row survives

## 3. Local PostgreSQL and database identities

- [x] 3.1 Add `docker/compose.yaml` running `postgres:16-alpine` with a health check and named volume
- [x] 3.2 Add an init script that creates `app_migrator` (schema owner, DDL) and `app_runtime` (DML only)
- [x] 3.3 Add `.env.example` documenting every variable, including both database URLs, and confirm `.env` is ignored
- [x] 3.4 Add an integration test proving `app_runtime` cannot create or alter a table
- [x] 3.5 Verify the full local flow: `docker compose up -d`, `pnpm db:migrate`, `pnpm --filter api start:dev`

## 4. API bootstrap and versioning

- [x] 4.1 Enable NestJS URI versioning with default version `1` so health and later endpoints live under `/v1`
- [x] 4.2 Implement a typed configuration schema in `apps/api/src/platform/config` with no fallback for required keys
- [x] 4.3 Make startup fail with one error naming every missing or invalid key before the HTTP listener binds
- [x] 4.4 Add structured logging with secret redaction and log effective non-secret configuration at startup
- [x] 4.5 Add tests for missing, invalid, and complete configuration

## 5. Health checks and schema compatibility

- [x] 5.1 Add a `platform/health` module exposing `GET /v1/health/live` with no I/O
- [x] 5.2 Add `GET /v1/health/ready` that runs a bounded database probe and returns 200 or 503
- [x] 5.3 Restrict the health response to allowlisted status fields and add a test asserting no secret or connection string appears
- [x] 5.4 Implement the schema compatibility check that compares the database `schema_version` with `expected-version.ts`
- [x] 5.5 Fail startup with a distinct error for each mismatch case: matching, database behind, database ahead, uninitialized
- [x] 5.6 Include the schema check result in readiness and add tests for all four mismatch cases
- [x] 5.7 Add a test proving a hung database probe returns 503 after the configured timeout

## 6. Continuous integration

- [x] 6.1 Add a CI workflow that installs pnpm and Node and caches the lockfile
- [x] 6.2 Run lint, typecheck, and unit tests in CI
- [x] 6.3 Start a PostgreSQL service, create both roles, run `db:migrate` on an empty database, and run `db:status`
- [x] 6.4 Start the API against the migrated database and assert `/v1/health/ready` returns 200
- [x] 6.5 Regenerate `expected-version.ts` in CI and fail when the committed file is stale
- [x] 6.6 Run migration integration tests against the CI database

## 7. Verification, rollback rehearsal, and documentation

- [x] 7.1 Rehearse rollback: take a `pg_dump` snapshot, apply a fixture migration, restore the snapshot, and confirm the previous schema version
- [x] 7.2 Document the deployment order: snapshot, run migrations with the migration identity, then start the API with the runtime identity
- [x] 7.3 Document the expand/contract rule for future schema changes and the forward-fix policy for mistakes
- [x] 7.4 Write a README covering local setup, every root script, environment variables, and the two database identities
- [x] 7.5 Run `openspec validate setup-monorepo-and-migrations --strict`
