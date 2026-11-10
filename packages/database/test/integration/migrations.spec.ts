import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
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
  packageRoot,
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
const ORDER_HISTORY_MIGRATION = '20261026000000_order_return_history_integrity';

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
      ORDER_HISTORY_MIGRATION,
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

    addFixtureMigration(project, { name: '20261027000000_add_note', sql: ADD_NOTE });
    const second = deployFixtureProject(project);
    expect(second.status, second.stderr).toBe(0);

    const row = await readProbeRow();
    expect(row?.name).toBe('customer data');
    expect(await readSchemaVersion()).toBe('20261027000000_add_note');
  });

  it('backfills initial order history when the corrective migration reaches an existing schema', async () => {
    project = createFixtureProject([]);
    rmSync(join(project.migrationsDir, ORDER_HISTORY_MIGRATION), { recursive: true, force: true });

    const initialDeploy = deployFixtureProject(project);
    expect(initialDeploy.status, initialDeploy.stderr).toBe(0);

    const orderId = await withClient(migrationUrl!, async (client) => {
      const zone = await client.query<{ id: string }>(
        `INSERT INTO shipping_zones (code, name, delivery_fee_poisha)
         VALUES ('migration-zone', 'Migration Zone', 0) RETURNING id`,
      );
      const order = await client.query<{ id: string }>(
        `INSERT INTO orders
           (order_number, contact_name, contact_phone, delivery_recipient_name,
            delivery_recipient_phone, delivery_address_line1, delivery_district,
            delivery_division, shipping_zone_id, delivery_fee_poisha, status,
            subtotal_poisha, total_poisha)
         VALUES ('ORD-MIGRATION-BACKFILL', 'Customer', '+8801712345678',
                 'Recipient', '+8801712345678', 'House 1', 'Dhaka', 'Dhaka',
                 $1, 0, 'confirmed', 1000, 1000)
         RETURNING id`,
        [zone.rows[0]!.id],
      );
      return order.rows[0]!.id;
    });

    const migrationSql = readFileSync(
      join(packageRoot, 'prisma', 'migrations', ORDER_HISTORY_MIGRATION, 'migration.sql'),
      'utf8',
    );
    addFixtureMigration(project, { name: ORDER_HISTORY_MIGRATION, sql: migrationSql });

    const correctiveDeploy = deployFixtureProject(project);
    expect(correctiveDeploy.status, correctiveDeploy.stderr).toBe(0);

    await withClient(migrationUrl!, async (client) => {
      const history = await client.query<{
        from_status: string | null;
        to_status: string;
      }>(
        `SELECT from_status, to_status
         FROM order_status_history
         WHERE order_id = $1`,
        [orderId],
      );
      expect(history.rows).toEqual([{ from_status: null, to_status: 'confirmed' }]);

      await expect(
        client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status)
           VALUES ($1, NULL, 'pending')`,
          [orderId],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });
    expect(await readSchemaVersion()).toBe(ORDER_HISTORY_MIGRATION);
  });

  it('rolls back a failed migration and keeps the previous schema version', async () => {
    project = createFixtureProject([
      { name: '20260102000000_create_probe', sql: CREATE_PROBE },
      {
        name: '20261027000000_failing',
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
      ORDER_HISTORY_MIGRATION,
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
