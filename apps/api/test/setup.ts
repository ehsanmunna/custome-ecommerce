import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const packageRoot = process.cwd();
const repoRoot = resolve(packageRoot, '../..');

for (const candidate of [resolve(repoRoot, '.env'), resolve(packageRoot, '.env')]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}
