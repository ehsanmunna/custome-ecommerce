import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';
import { loadEnv, packageRoot, requireEnv } from './env.mjs';
import { runPrisma } from './run-prisma.mjs';

const { Client } = pg;

loadEnv();

const migrationUrl = requireEnv('MIGRATION_DATABASE_URL');
const schemaPath = process.env.MIGRATION_SCHEMA_PATH
  ? resolve(process.env.MIGRATION_SCHEMA_PATH)
  : resolve(packageRoot, 'prisma', 'schema.prisma');
const migrationsDir = join(dirname(schemaPath), 'migrations');

if (process.env.DATABASE_URL === migrationUrl) {
  console.warn(
    'DATABASE_URL and MIGRATION_DATABASE_URL are identical. The runtime and migration identities should differ.',
  );
}

function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function readMigrationsFromDisk() {
  const migrations = new Map();

  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d{14}_.+$/.test(entry.name)) {
      continue;
    }

    const contents = readFileSync(join(migrationsDir, entry.name, 'migration.sql'));
    migrations.set(entry.name, checksum(contents));
  }

  return migrations;
}

async function validateAppliedMigrations() {
  const client = new Client({ connectionString: migrationUrl });
  await client.connect();

  try {
    const ledger = await client.query("SELECT to_regclass('public._prisma_migrations') AS name");
    if (!ledger.rows[0]?.name) {
      return true;
    }

    const applied = await client.query(
      'SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
    );
    const onDisk = readMigrationsFromDisk();
    const problems = [];

    for (const row of applied.rows) {
      const diskChecksum = onDisk.get(row.migration_name);

      if (!diskChecksum) {
        problems.push(
          `Applied migration ${row.migration_name} is missing from the committed migration stream (schema drift).`,
        );
        continue;
      }

      if (diskChecksum !== row.checksum) {
        problems.push(
          `Applied migration ${row.migration_name} was modified after it was applied. Restore the original file and add a new forward migration instead.`,
        );
      }
    }

    if (problems.length > 0) {
      console.error('Migration validation failed before applying anything:');
      for (const problem of problems) {
        console.error(`- ${problem}`);
      }
      return false;
    }

    return true;
  } finally {
    await client.end();
  }
}

const valid = await validateAppliedMigrations();

if (!valid) {
  process.exit(1);
}

const status = runPrisma(['migrate', 'deploy', '--schema', schemaPath], {
  ...process.env,
  DATABASE_URL: migrationUrl,
});

process.exit(status);
