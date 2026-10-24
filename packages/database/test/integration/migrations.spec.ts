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
      '20261024000000_auth_sessions',
      '20261025000000_catalog_translation_descriptions',
    ]);
    expect(ledger[0]?.checksum).toBeTruthy();
    expect(ledger[0]?.finished_at).toBeTruthy();

    const columns = await withClient(migrationUrl!, async (client) => {
      const result = await client.query(
        `SELECT table_name, column_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name IN ('category_translations', 'brand_translations')
           AND column_name = 'description'
         ORDER BY table_name`,
      );
      return result.rows;
    });
    expect(columns).toEqual([
      {
        table_name: 'brand_translations',
        column_name: 'description',
        is_nullable: 'YES',
      },
      {
        table_name: 'category_translations',
        column_name: 'description',
        is_nullable: 'YES',
      },
    ]);

    const descriptions = await withClient(migrationUrl!, async (client) => {
      const category = await client.query('INSERT INTO categories DEFAULT VALUES RETURNING id');
      const brand = await client.query('INSERT INTO brands DEFAULT VALUES RETURNING id');
      await client.query(
        `INSERT INTO category_translations (category_id, locale, name, slug, description)
         VALUES ($1, 'en', 'Category', 'category', $2)`,
        [category.rows[0]?.id, 'Category description'],
      );
      await client.query(
        `INSERT INTO brand_translations (brand_id, locale, name, slug, description)
         VALUES ($1, 'en', 'Brand', 'brand', $2)`,
        [brand.rows[0]?.id, 'Brand description'],
      );
      const result = await client.query(
        `SELECT description FROM category_translations WHERE category_id = $1
         UNION ALL
         SELECT description FROM brand_translations WHERE brand_id = $2
         ORDER BY description`,
        [category.rows[0]?.id, brand.rows[0]?.id],
      );
      return result.rows.map(({ description }) => description);
    });
    expect(descriptions).toEqual(['Brand description', 'Category description']);
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

    addFixtureMigration(project, { name: '20261026000000_add_note', sql: ADD_NOTE });
    const second = deployFixtureProject(project);
    expect(second.status, second.stderr).toBe(0);

    const row = await readProbeRow();
    expect(row?.name).toBe('customer data');
    expect(await readSchemaVersion()).toBe('20261026000000_add_note');
  });

  it('rolls back a failed migration and keeps the previous schema version', async () => {
    project = createFixtureProject([
      { name: '20260102000000_create_probe', sql: CREATE_PROBE },
      {
        name: '20261026000000_failing',
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
      '20261024000000_auth_sessions',
      '20261025000000_catalog_translation_descriptions',
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
