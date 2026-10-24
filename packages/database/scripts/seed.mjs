import { Prisma, PrismaClient } from '@prisma/client';
import { loadEnv, requireEnv } from './env.mjs';

loadEnv();
requireEnv('DATABASE_URL');

const { parseBootstrapConfig, seedDatabase } = await import('../dist/seed.js');
const client = new PrismaClient();

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return message.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[redacted]@');
}

try {
  const bootstrap = parseBootstrapConfig(process.env);
  const result = await seedDatabase(client, bootstrap);
  console.log('Baseline store data seeded successfully.');
  if (result.admin === 'created') {
    console.log('Created the initial store administrator.');
  } else if (result.admin === 'skipped-existing-admin') {
    console.log('Skipped administrator bootstrap because an administrator already exists.');
  } else {
    console.log('Skipped administrator bootstrap because credentials are not configured.');
  }
} catch (error) {
  const knownCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
  if (knownCode === 'P2021' || knownCode === 'P2022') {
    console.error(
      'Seed failed because the required schema is missing. Run `pnpm db:migrate` first.',
    );
  } else {
    console.error(`Seed failed: ${safeErrorMessage(error)}`);
  }
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}
