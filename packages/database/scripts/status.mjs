import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnv, packageRoot, requireEnv } from './env.mjs';

const { Client } = pg;

loadEnv();
const client = new Client({ connectionString: requireEnv('MIGRATION_DATABASE_URL') });

await client.connect();

try {
  const ledger = await client.query("SELECT to_regclass('public._prisma_migrations') AS name");
  if (!ledger.rows[0]?.name) {
    console.error('Database is uninitialized: no migration ledger. Run `pnpm db:migrate` first.');
    process.exitCode = 1;
  } else {
    const applied = await client.query(
      'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
    );

    const migrationsDir = resolve(packageRoot, 'prisma', 'migrations');
    const onDisk = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\d{14}_.+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort();

    const appliedNames = new Set(
      applied.rows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => row.migration_name),
    );
    const pending = onDisk.filter((name) => !appliedNames.has(name));
    const failed = applied.rows.filter((row) => !row.finished_at || row.rolled_back_at);
    const current = [...appliedNames].sort().at(-1) ?? 'none';

    console.log(`Current schema version: ${current}`);
    console.log(`Applied migrations: ${appliedNames.size}`);
    console.log(
      pending.length > 0
        ? `Pending migrations:\n${pending.map((name) => `  - ${name}`).join('\n')}`
        : 'Pending migrations: none',
    );

    if (failed.length > 0) {
      console.error(
        `Failed or rolled-back migrations:\n${failed
          .map((row) => `  - ${row.migration_name}`)
          .join('\n')}`,
      );
      process.exitCode = 1;
    }
  }
} finally {
  await client.end();
}
