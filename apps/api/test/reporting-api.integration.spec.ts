import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { AnalyticsController } from '../src/analytics/analytics.controller';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { InventoryController } from '../src/inventory/inventory.controller';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

describe('reporting API (existing contract endpoints)', () => {
  const logger = { error: vi.fn() };
  const sessions = {
    validateAccessToken: vi.fn(async () => ({
      sub: 'admin-id',
      sid: 'session-id',
      typ: 'admin' as const,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    })),
  };
  let permissions = ['analytics.read', 'inventory.read'];
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async () => ({
        id: 'admin-id',
        status: 'active',
        role: {
          scope: 'store',
          permissions: permissions.map((key) => ({ permission: { key } })),
        },
      })),
    },
  };
  const analytics = {
    getOverview: vi.fn(async () => ({
      orderCount: 5,
      revenue: { amount: 50000, currency: 'BDT' },
      averageOrderValue: { amount: 10000, currency: 'BDT' },
    })),
    getSales: vi.fn(async () => ({
      series: [
        {
          periodStart: '2026-01-01T00:00:00.000Z',
          orderCount: 3,
          revenue: { amount: 30000, currency: 'BDT' },
        },
      ],
    })),
  };
  const inventory = {
    listInventory: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    listReservations: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
    adjustInventory: vi.fn(async () => ({})),
    createReservation: vi.fn(async () => ({})),
    updateReservationStatus: vi.fn(async () => ({})),
  };
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController, InventoryController],
      providers: [
        { provide: Reflector, useValue: new Reflector() },
        AuthenticationGuard,
        { provide: APP_GUARD, useExisting: AuthenticationGuard },
        { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
        {
          provide: ProblemDetailsFilter,
          useFactory: (adapterHost: HttpAdapterHost) =>
            new ProblemDetailsFilter(adapterHost, logger as never),
          inject: [HttpAdapterHost],
        },
        { provide: AuthSessionService, useValue: sessions },
        { provide: PrismaService, useValue: prisma },
        { provide: AnalyticsService, useValue: analytics },
        { provide: InventoryService, useValue: inventory },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves analytics overview with validated query inputs', async () => {
    const response = await fetch(
      `${baseUrl}/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.orderCount).toBe(5);
    expect(body.revenue.amount).toBe(50000);
    expect(body.revenue.currency).toBe('BDT');
    expect(body.averageOrderValue.amount).toBe(10000);
    expect(analytics.getOverview).toHaveBeenCalledWith({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
    });
  });

  it('serves analytics sales series over time', async () => {
    const response = await fetch(
      `${baseUrl}/admin/analytics/sales?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z&interval=day`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.series.length).toBe(1);
    expect(body.series[0].periodStart).toBe('2026-01-01T00:00:00.000Z');
    expect(analytics.getSales).toHaveBeenCalledWith({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.000Z',
      interval: 'day',
    });
  });

  it('serves empty analytics results when there are no orders', async () => {
    analytics.getOverview.mockResolvedValueOnce({
      orderCount: 0,
      revenue: { amount: 0, currency: 'BDT' },
      averageOrderValue: { amount: 0, currency: 'BDT' },
    });
    analytics.getSales.mockResolvedValueOnce({ series: [] });

    const overview = await fetch(
      `${baseUrl}/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    const overviewBody = await overview.json();
    expect(overview.status).toBe(200);
    expect(overviewBody.orderCount).toBe(0);
    expect(overviewBody.revenue.amount).toBe(0);

    const sales = await fetch(
      `${baseUrl}/admin/analytics/sales?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    const salesBody = await sales.json();
    expect(sales.status).toBe(200);
    expect(salesBody.series).toEqual([]);
  });

  it('serves low-stock inventory variants', async () => {
    inventory.listInventory.mockResolvedValueOnce({
      items: [
        {
          variantId: 'a65a44f6-0ed0-40b2-aea4-84a7e716862f',
          onHand: 2,
          reserved: 0,
          available: 2,
          lowStockThreshold: 5,
          lowStock: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const response = await fetch(
      `${baseUrl}/admin/inventory?lowStock=true`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.items[0].lowStock).toBe(true);
    expect(inventory.listInventory).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      lowStock: true,
    });
  });

  it('enforces analytics.read permission on reporting endpoints', async () => {
    const anonymousOverview = await fetch(`${baseUrl}/admin/analytics/overview`);
    expect(anonymousOverview.status).toBe(401);

    const anonymousSales = await fetch(`${baseUrl}/admin/analytics/sales`);
    expect(anonymousSales.status).toBe(401);

    const anonymousInventory = await fetch(`${baseUrl}/admin/inventory?lowStock=true`);
    expect(anonymousInventory.status).toBe(401);

    permissions = ['inventory.read'];
    const deniedOverview = await fetch(`${baseUrl}/admin/analytics/overview`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(deniedOverview.status).toBe(403);

    const deniedSales = await fetch(`${baseUrl}/admin/analytics/sales`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(deniedSales.status).toBe(403);

    permissions = ['analytics.read', 'inventory.read'];
    const allowedOverview = await fetch(`${baseUrl}/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(allowedOverview.status).toBe(200);
  });
});
