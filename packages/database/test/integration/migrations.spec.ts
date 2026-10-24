import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXPECTED_SCHEMA_VERSION } from '../../src/expected-version';
import {
  addFixtureMigration,
  createFixtureProject,
  deployFixtureProject,
  editFixtureMigration,
  hasDatabase,
  insertProbeRow,
  migrationUrl,
  readLedger,
  readProbeRow,
  readSchemaVersion,
  resetDatabase,
  runMigrateCommand,
  withClient,
  type FixtureProject,
} from '../helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

const CREATE_PROBE = 'CREATE TABLE probe (id integer PRIMARY KEY, name text NOT NULL);';
const ADD_NOTE = "ALTER TABLE probe ADD COLUMN note text NOT NULL DEFAULT 'kept';";

describeDatabase('database migrations', () => {
  let project: FixtureProject | undefined;

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    project?.cleanup();
    project = undefined;
  });

  it('applies migrations to an empty database and exposes the newest version', async () => {
    const result = runMigrateCommand();

    expect(result.status, result.stderr).toBe(0);
    expect(await readSchemaVersion()).toBe(EXPECTED_SCHEMA_VERSION);

    const ledger = await readLedger();
    expect(ledger.map((entry) => entry.migration_name)).toEqual([
      '20260101000000_init',
      '20260102000000_catalog',
      '20260103000000_inventory',
      '20260104000000_customers_auth',
      '20260105000000_orders_payments_shipping',
      '20260106000000_settings_cms',
    ]);
    expect(ledger[0]?.checksum).toBeTruthy();
    expect(ledger[0]?.finished_at).toBeTruthy();
  });

  it('changes nothing when the migration command is run twice', async () => {
    const first = runMigrateCommand();
    expect(first.status, first.stderr).toBe(0);
    const ledgerBefore = await readLedger();
    const versionBefore = await readSchemaVersion();

    const second = runMigrateCommand();

    expect(second.status, second.stderr).toBe(0);
    expect(await readLedger()).toEqual(ledgerBefore);
    expect(await readSchemaVersion()).toBe(versionBefore);
  });

  it('fails before applying anything when an applied migration was modified', async () => {
    project = createFixtureProject([{ name: '20260102000000_create_probe', sql: CREATE_PROBE }]);

    const first = deployFixtureProject(project);
    expect(first.status, first.stderr).toBe(0);

    editFixtureMigration(project, '20260102000000_create_probe', '-- edited after apply');

    const second = runMigrateCommand({ MIGRATION_SCHEMA_PATH: project.schemaPath });
    const output = `${second.stdout}\n${second.stderr}`;

    expect(second.status).not.toBe(0);
    expect(output).toContain('20260102000000_create_probe');
    expect(output.toLowerCase()).toContain('modified');
  });

  it('preserves existing rows when a later migration is applied', async () => {
    project = createFixtureProject([{ name: '20260102000000_create_probe', sql: CREATE_PROBE }]);
    expect(deployFixtureProject(project).status).toBe(0);
    await insertProbeRow('customer data');

    addFixtureMigration(project, { name: '20260107000000_add_note', sql: ADD_NOTE });
    const second = deployFixtureProject(project);
    expect(second.status, second.stderr).toBe(0);

    const row = await readProbeRow();
    expect(row?.name).toBe('customer data');
    expect(await readSchemaVersion()).toBe('20260107000000_add_note');
  });

  it('rolls back a failed migration and keeps the previous schema version', async () => {
    project = createFixtureProject([
      { name: '20260102000000_create_probe', sql: CREATE_PROBE },
      {
        name: '20260107000000_failing',
        sql: 'CREATE TABLE should_be_rolled_back (id integer);\nSELECT * FROM table_that_does_not_exist;',
      },
    ]);

    const result = deployFixtureProject(project);
    expect(result.status).not.toBe(0);

    const ledger = await readLedger();
    const applied = ledger.filter((entry) => entry.finished_at);
    expect(applied.map((entry) => entry.migration_name)).toEqual([
      '20260101000000_init',
      '20260102000000_catalog',
      '20260102000000_create_probe',
      '20260103000000_inventory',
      '20260104000000_customers_auth',
      '20260105000000_orders_payments_shipping',
      '20260106000000_settings_cms',
    ]);
    expect(await readSchemaVersion()).toBe(EXPECTED_SCHEMA_VERSION);

    const rolledBack = await withClient(migrationUrl!, async (client) => {
      const result = await client.query(
        "SELECT to_regclass('public.should_be_rolled_back') AS name",
      );
      return result.rows[0]?.name;
    });
    expect(rolledBack).toBeNull();
  });
});
