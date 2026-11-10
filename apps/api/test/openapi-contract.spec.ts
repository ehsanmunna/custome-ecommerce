import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { VersioningType } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../../../packages/api-sdk/src';
import type { ApiClientOptions } from '../../../packages/api-sdk/src';
import { HealthController } from '../src/platform/health/health.controller';
import { HealthService } from '../src/platform/health/health.service';

describe('OpenAPI contract integration', () => {
  it('provides a typed SDK call with the configured base URL and bearer token', async () => {
    const requestDetails: { url?: string; authorization?: string | null } = {};
    const fetcher: NonNullable<ApiClientOptions['fetch']> = async (request) => {
      requestDetails.url = request.url;
      requestDetails.authorization = request.headers.get('authorization');
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createApiClient({
      baseUrl: 'http://localhost:3000/v1/',
      getAccessToken: () => 'test-access-token',
      fetch: fetcher,
    });

    const result = await client.GET('/health/live');

    expect(client.baseUrl).toBe('http://localhost:3000/v1');
    expect(requestDetails.url).toBe('http://localhost:3000/v1/health/live');
    expect(requestDetails.authorization).toBe('Bearer test-access-token');
    expect(result.data).toEqual({ status: 'ok' });
  });

  describe('implemented health routes', () => {
    let app: INestApplication;
    let baseUrl: string;
    const healthService = {
      checkReadiness: vi.fn(),
    };

    beforeAll(async () => {
      Reflect.defineMetadata('design:paramtypes', [HealthService], HealthController);
      const module = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [{ provide: HealthService, useValue: healthService }],
      }).compile();
      app = module.createNestApplication();
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });
      await app.listen(0, '127.0.0.1');
      baseUrl = await app.getUrl();
    }, 30_000);

    afterAll(async () => {
      await app.close();
    });

    it('matches the documented liveness response', async () => {
      const response = await fetch(`${baseUrl}/v1/health/live`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({ status: 'ok' });
    });

    it('matches the documented ready and not-ready responses', async () => {
      healthService.checkReadiness.mockResolvedValue({
        status: 'ok',
        checks: {
          database: { status: 'ok' },
          schema: { status: 'ok' },
        },
      });
      const readyResponse = await fetch(`${baseUrl}/v1/health/ready`);
      expect(readyResponse.status).toBe(200);
      expect(await readyResponse.json()).toEqual({
        status: 'ok',
        checks: {
          database: { status: 'ok' },
          schema: { status: 'ok' },
        },
      });

      healthService.checkReadiness.mockResolvedValue({
        status: 'error',
        checks: {
          database: { status: 'error' },
          schema: { status: 'ok' },
        },
      });
      const notReadyResponse = await fetch(`${baseUrl}/v1/health/ready`);
      expect(notReadyResponse.status).toBe(503);
      expect(await notReadyResponse.json()).toEqual({
        status: 'error',
        checks: {
          database: { status: 'error' },
          schema: { status: 'ok' },
        },
      });
    });
  });
});
