import pg from 'pg';
import { loadEnv, requireEnv } from './env.mjs';

const { Client } = pg;

loadEnv();
const client = new Client({ connectionString: requireEnv('MIGRATION_DATABASE_URL') });

await client.connect();

try {
  const view = await client.query("SELECT to_regclass('public.schema_version') AS name");
  if (!view.rows[0]?.name) {
    console.error(
      'Database is uninitialized: schema_version does not exist. Run `pnpm db:migrate`.',
    );
    process.exitCode = 1;
  } else {
    const result = await client.query('SELECT version FROM schema_version LIMIT 1');
    const version = result.rows[0]?.version;
    if (!version) {
      console.error('No applied migration found. Run `pnpm db:migrate`.');
      process.exitCode = 1;
    } else {
      console.log(version);
    }
  }
} finally {
  await client.end();
}
