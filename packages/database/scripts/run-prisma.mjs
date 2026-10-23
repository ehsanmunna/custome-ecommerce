import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { packageRoot } from './env.mjs';

export function runPrisma(args, env = process.env) {
  const isWindows = process.platform === 'win32';
  const binary = resolve(packageRoot, 'node_modules', '.bin', isWindows ? 'prisma.cmd' : 'prisma');
  const result = spawnSync(binary, args, {
    cwd: packageRoot,
    env,
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }

  return result.status ?? 1;
}
