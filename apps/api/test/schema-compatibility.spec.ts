import { describe, expect, it, vi } from 'vitest';
import { EXPECTED_SCHEMA_VERSION } from 'database';
import type { AppConfigService } from '../src/platform/config/app-config.service';
import type { PrismaService } from '../src/platform/database/prisma.service';
import {
  SchemaCompatibilityError,
  SchemaCompatibilityService,
} from '../src/platform/schema/schema-compatibility.service';

function createService(query: () => Promise<unknown>, timeoutMs = 25): SchemaCompatibilityService {
  const prisma = { $queryRawUnsafe: vi.fn(query) } as unknown as PrismaService;
  const config = { databaseProbeTimeoutMs: timeoutMs } as AppConfigService;
  return new SchemaCompatibilityService(prisma, config);
}

describe('schema compatibility', () => {
  it('matches when the database version equals the build version', async () => {
    const service = createService(async () => [{ version: EXPECTED_SCHEMA_VERSION }]);

    await expect(service.assertCompatible()).resolves.toMatchObject({ status: 'match' });
  });

  it('reports a database behind the build and instructs the operator to migrate', async () => {
    const service = createService(async () => [{ version: '20000101000000_old' }]);

    await expect(service.assertCompatible()).rejects.toMatchObject({
      reason: 'behind',
    });
    await expect(service.assertCompatible()).rejects.toThrowError(/run migrations/i);
  });

  it('reports a database ahead of the build as an outdated build', async () => {
    const service = createService(async () => [{ version: '29990101000000_future' }]);

    await expect(service.assertCompatible()).rejects.toMatchObject({ reason: 'ahead' });
    await expect(service.assertCompatible()).rejects.toThrowError(/outdated/i);
  });

  it('treats an empty schema_version view as uninitialized', async () => {
    const service = createService(async () => []);

    await expect(service.assertCompatible()).rejects.toMatchObject({
      reason: 'uninitialized',
    });
    await expect(service.assertCompatible()).rejects.toThrowError(/run migrations/i);
  });

  it('treats a missing schema_version view as uninitialized', async () => {
    const missing = Object.assign(new Error('relation "schema_version" does not exist'), {
      code: 'P2021',
    });
    const service = createService(async () => {
      throw missing;
    });

    await expect(service.check()).resolves.toMatchObject({ status: 'uninitialized' });
  });

  it('reports an unreachable database as a distinct check failure', async () => {
    const service = createService(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    const result = await service.check();
    expect(result.status).toBe('error');
    await expect(service.assertCompatible()).rejects.toBeInstanceOf(SchemaCompatibilityError);
    await expect(service.assertCompatible()).rejects.toMatchObject({ reason: 'error' });
  });

  it('fails the check when the database query hangs', async () => {
    const service = createService(() => new Promise(() => undefined), 10);

    const result = await service.check();
    expect(result.status).toBe('error');
  });
});
