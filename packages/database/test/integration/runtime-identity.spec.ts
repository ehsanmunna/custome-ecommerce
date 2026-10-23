import { beforeEach, describe, expect, it } from 'vitest';
import { EXPECTED_SCHEMA_VERSION } from '../../src/expected-version';
import {
  hasDatabase,
  migrationUrl,
  resetDatabase,
  runMigrateCommand,
  runtimeUrl,
  withClient,
} from '../helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

describeDatabase('database identities', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('lets the runtime identity read and write rows but never change schema', async () => {
    const migrate = runMigrateCommand();
    expect(migrate.status, migrate.stderr).toBe(0);

    await withClient(migrationUrl!, async (client) => {
      await client.query('CREATE TABLE runtime_probe (id integer PRIMARY KEY, note text NOT NULL)');
    });

    await withClient(runtimeUrl!, async (client) => {
      await client.query('INSERT INTO runtime_probe (id, note) VALUES (1, $1)', ['kept']);
      const row = await client.query('SELECT note FROM runtime_probe WHERE id = 1');
      expect(row.rows[0]?.note).toBe('kept');

      const version = await client.query('SELECT version FROM schema_version LIMIT 1');
      expect(version.rows[0]?.version).toBe(EXPECTED_SCHEMA_VERSION);
    });

    await expect(
      withClient(runtimeUrl!, async (client) => {
        await client.query('CREATE TABLE should_not_exist (id integer)');
      }),
    ).rejects.toMatchObject({ code: '42501' });

    await expect(
      withClient(runtimeUrl!, async (client) => {
        await client.query('ALTER TABLE runtime_probe ADD COLUMN extra integer');
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
