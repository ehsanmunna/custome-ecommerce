# Database operations

The platform uses one ordered migration stream for every client database. Schema changes never happen
by hand and never branch per client.

## Identities

- `app_runtime` (`DATABASE_URL`) is the API identity. It can read and write rows but cannot create or
  alter tables, and it is never used to run migrations.
- `app_migrator` (`MIGRATION_DATABASE_URL`) owns the schema and runs DDL. Only the migration command
  and operators receive it.

## Deployment order

1. **Snapshot** the client database with `pg_dump` and store the dump outside the database host.
2. **Migrate** with the migration identity:
   ```bash
   MIGRATION_DATABASE_URL=... pnpm db:migrate
   ```
   The command verifies every applied migration checksum before applying anything. It fails on a
   modified or missing migration and stops without partial application.
3. **Verify** the version and pending state:
   ```bash
   pnpm db:status
   pnpm db:version
   ```
4. **Start the API** with the runtime identity. The process refuses to bind a listener when the
   database is behind, ahead, or uninitialized, so a skipped migration becomes a failed deploy
   instead of serving against the wrong schema.

A rolling deploy may briefly run API instances whose expected version is older than the migrated
schema. Only run migrations after the previous API build is no longer serving, or use expand/contract
so both builds remain compatible.

## Rollback: restore the snapshot

v1 has no down migrations. A migration mistake is handled by restoring the pre-migration snapshot,
then fixing forward.

1. Stop the API instances that use the database.
2. Take a final dump if any data written after the snapshot must be preserved for analysis.
3. Restore the snapshot into a clean schema (or a clean database) so objects created by the failed
   migration do not survive:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public AUTHORIZATION app_migrator;
   GRANT USAGE ON SCHEMA public TO app_runtime;
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   ```
   ```bash
   pg_restore -U app_migrator -d <database> --clean --if-exists snapshot.dump
   ```
4. Confirm the previous schema version:
   ```bash
   pnpm db:version
   ```
5. Start the previous API build with the runtime identity.

`pg_restore --clean` alone is not enough: it drops objects present in the dump but leaves objects
created after the snapshot, such as tables introduced by the failed migration. Drop the schema (or
recreate the database) first.

### Rehearsal record

- Date: 2026-10-23
- Environment: local `postgres:16-alpine` from `docker/compose.yaml`
- Procedure: reset to the committed schema, `pg_dump` snapshot, apply a fixture migration
  (`20260102000000_add_fixture_table`), insert a row, drop and recreate `public`, `pg_restore` the
  snapshot.
- Result: `schema_version` returned `20260101000000_init` again, the fixture table was gone, and the
  runtime identity could still read `schema_version`.
- Repeat this rehearsal on staging against a copy of a client database before the first client
  production migration.

## Expand/contract for future schema changes

A single release must not break the previous API build while both are running.

1. **Expand:** add the new column or table and its indexes. Do not remove or rename the old shape.
2. **Deploy code** that writes both the old and new shapes and reads whichever is present.
3. **Backfill** data in a separate migration or job after the code is live.
4. **Contract:** in a later release, after no running build uses the old shape, drop it.

Renames are treated as add + backfill + contract, never as a single destructive change. A destructive
migration without a prior compatible release is a defect.

## Forward-fix policy

- Applied migrations are immutable. Never edit one to fix a mistake.
- Correct the problem with a new migration that moves the schema forward.
- If the mistake is severe or destructive, restore the pre-migration snapshot first, then add the
  corrected forward migration and rehearse it on staging.
- A migration that needs a manual database edit is rejected; the fix belongs in the stream.

## CI guarantees

CI runs the migration stream against an empty PostgreSQL database, runs the checksum, idempotency,
data-preservation, and runtime-identity tests, checks that `expected-version.ts` matches the newest
migration, and starts the API to confirm readiness. A migration system that is not exercised on every
commit will break on the first real client database.
