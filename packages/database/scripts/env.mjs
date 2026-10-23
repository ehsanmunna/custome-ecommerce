import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(packageRoot, '../..');

export function loadEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  for (const candidate of [resolve(repoRoot, '.env'), resolve(packageRoot, '.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable ${name}. Copy .env.example to .env.`);
    process.exit(1);
  }
  return value;
}
