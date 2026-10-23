import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../src/platform/config/app-config.service';
import type { PrismaService } from '../src/platform/database/prisma.service';
import { HealthController } from '../src/platform/health/health.controller';
import { HealthService } from '../src/platform/health/health.service';
import type { StructuredLogger } from '../src/platform/logging/structured-logger';
import type { SchemaCompatibilityService } from '../src/platform/schema/schema-compatibility.service';

const secret = 'postgresql://app_runtime:super-secret@localhost:5432/app';

function createHealth(
  query: () => Promise<unknown>,
  schemaStatus: 'match' | 'behind' | 'ahead' | 'uninitialized' | 'error' = 'match',
  timeoutMs = 25,
): {
  health: HealthService;
  controller: HealthController;
  logger: { warn: ReturnType<typeof vi.fn> };
} {
  const prisma = { $queryRawUnsafe: vi.fn(query) } as unknown as PrismaService;
  const config = { databaseProbeTimeoutMs: timeoutMs } as AppConfigService;
  const schemaCompatibility = {
    check: vi.fn(async () => ({ status: schemaStatus, expected: 'x', actual: 'x' })),
  } as unknown as SchemaCompatibilityService;
  const logger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() };
  const health = new HealthService(
    prisma,
    config,
    schemaCompatibility,
    logger as unknown as StructuredLogger,
  );

  return { health, controller: new HealthController(health), logger };
}

describe('health checks', () => {
  it('reports ready when the database responds and the schema matches', async () => {
    const { health, controller } = createHealth(async () => [{ '?column?': 1 }]);

    await expect(health.checkReadiness()).resolves.toEqual({
      status: 'ok',
      checks: { database: { status: 'ok' }, schema: { status: 'ok' } },
    });

    const response = { status: vi.fn() };
    await controller.ready(response);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('reports not ready with 503 when the database probe fails', async () => {
    const { health, controller } = createHealth(async () => {
      throw new Error(`cannot reach ${secret}`);
    });

    const result = await health.checkReadiness();
    expect(result).toEqual({
      status: 'error',
      checks: { database: { status: 'error' }, schema: { status: 'ok' } },
    });

    const response = { status: vi.fn() };
    await controller.ready(response);
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('reports not ready when the schema does not match', async () => {
    const { health, controller } = createHealth(async () => [{ ok: 1 }], 'behind');

    await expect(health.checkReadiness()).resolves.toEqual({
      status: 'error',
      checks: { database: { status: 'ok' }, schema: { status: 'error' } },
    });

    const response = { status: vi.fn() };
    await controller.ready(response);
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('returns 503 after the configured timeout when the database probe hangs', async () => {
    const { controller } = createHealth(() => new Promise(() => undefined), 'match', 15);
    const startedAt = Date.now();

    const response = { status: vi.fn() };
    const result = await controller.ready(response);
    const elapsed = Date.now() - startedAt;

    expect(result.status).toBe('error');
    expect(response.status).toHaveBeenCalledWith(503);
    expect(elapsed).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThan(1_000);
  });

  it('never exposes secrets or connection strings in the response', async () => {
    const { health } = createHealth(async () => [{ ok: 1 }]);

    const body = JSON.stringify(await health.checkReadiness());

    expect(body).not.toContain('postgresql://');
    expect(body).not.toContain('super-secret');
    expect(body).not.toContain('app_runtime');
  });

  it('liveness does no I/O', async () => {
    const { controller } = createHealth(async () => [{ ok: 1 }]);

    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
