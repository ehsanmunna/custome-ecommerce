import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

const ORDER_ID = 'a65a44f6-0ed0-40b2-aea4-84a7e716862f';
const RETURN_ID = 'b75a44f6-0ed0-40b2-aea4-84a7e716862f';
const ADMIN_ID = 'c85a44f6-0ed0-40b2-aea4-84a7e716862f';
const ITEM_ID = 'd95a44f6-0ed0-40b2-aea4-84a7e716862f';
const INITIAL_DATE = new Date('2026-01-01T00:00:00.000Z');

describe('admin order and return HTTP API', () => {
  const logger = { error: vi.fn() };
  let caughtError = '';
  const sessions = {
    validateAccessToken: vi.fn(async () => ({
      sub: ADMIN_ID,
      sid: 'session-id',
      typ: 'admin' as const,
      iat: 1,
      exp: 2,
    })),
  };
  let permissions = ['orders.read', 'orders.returns.read'];
  const order = createOrder();
  const returnRecord = createReturn();
  const prisma: Record<string, any> = {
    adminUser: {
      findUnique: vi.fn(async () => ({
        id: ADMIN_ID,
        status: 'active',
        role: {
          scope: 'store',
          permissions: permissions.map((key) => ({ permission: { key } })),
        },
      })),
    },
    order: {
      findMany: vi.fn(async () => [order]),
      count: vi.fn(async () => 1),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === order.id ? order : null,
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return order;
      }),
    },
    orderStatusHistory: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: 'history-id', createdAt: new Date('2026-01-02T00:00:00.000Z') };
        order.statusHistory.push(row);
        return row;
      }),
    },
    orderReturn: {
      findMany: vi.fn(async () => [returnRecord]),
      count: vi.fn(async () => 1),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === returnRecord.id ? returnRecord : null,
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(returnRecord, data);
        return returnRecord;
      }),
    },
    orderReturnStatusHistory: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...data,
          id: 'return-history-id',
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
        };
        returnRecord.statusHistory.push(row);
        return row;
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: 'locked-row' }]),
  };
  prisma.$transaction = vi.fn(async (operation: (tx: typeof prisma) => Promise<unknown>) =>
    operation(prisma),
  );

  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: Reflector, useValue: new Reflector() },
        AuthenticationGuard,
        { provide: APP_GUARD, useExisting: AuthenticationGuard },
        { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
        {
          provide: ProblemDetailsFilter,
          useFactory: (adapterHost: HttpAdapterHost) => {
            const filter = new ProblemDetailsFilter(adapterHost, logger as never);
            const originalCatch = filter.catch.bind(filter);
            filter.catch = (exception, host) => {
              caughtError = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
              return originalCatch(exception, host);
            };
            return filter;
          },
          inject: [HttpAdapterHost],
        },
        { provide: AuthSessionService, useValue: sessions },
        { provide: PrismaService, useValue: prisma },
        OrdersService,
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  beforeEach(() => {
    resetOrder();
    resetReturn();
    permissions = ['orders.read', 'orders.returns.read'];
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists filtered, paginated order snapshots and history', async () => {
    const response = await fetch(
      `${baseUrl}/admin/orders?page=2&pageSize=5&status=pending&createdFrom=2025-12-01T00%3A00%3A00Z`,
      { headers: { authorization: 'Bearer test-token' } },
    );

    expect(response.status, `${JSON.stringify(logger.error.mock.calls)}\n${caughtError}`).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        { id: ORDER_ID, number: 'ORD-1001', status: 'pending', history: [{ status: 'pending' }] },
      ],
      total: 1,
      page: 2,
      pageSize: 5,
    });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'pending',
          createdAt: { gte: new Date('2025-12-01T00:00:00Z') },
        },
        skip: 5,
        take: 5,
      }),
    );
  });

  it('validates filters and returns not found for an unknown order', async () => {
    const invalid = await fetch(
      `${baseUrl}/admin/orders?createdFrom=2026-02-01T00%3A00%3A00Z&createdTo=2026-01-01T00%3A00%3A00Z`,
      {
        headers: { authorization: 'Bearer test-token' },
      },
    );
    expect(invalid.status).toBe(400);

    const missing = await fetch(`${baseUrl}/admin/orders/${ITEM_ID}`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(missing.status).toBe(404);
  });

  it('updates order status and records actor and note', async () => {
    permissions = ['orders.status.update'];
    const response = await fetch(`${baseUrl}/admin/orders/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'confirmed', note: 'Verified payment method' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'confirmed',
      history: [
        { status: 'pending' },
        {
          previousStatus: 'pending',
          status: 'confirmed',
          actorAdminId: ADMIN_ID,
          note: 'Verified payment method',
        },
      ],
    });
  });

  it('rejects invalid order transitions without changing status or history', async () => {
    permissions = ['orders.status.update'];
    const response = await fetch(`${baseUrl}/admin/orders/${ORDER_ID}/status`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'shipped' }),
    });

    expect(response.status).toBe(409);
    expect(order.status).toBe('pending');
    expect(order.statusHistory).toHaveLength(1);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('lists return items with their initial status history', async () => {
    const response = await fetch(`${baseUrl}/admin/returns?page=1&pageSize=10`, {
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          id: RETURN_ID,
          orderId: ORDER_ID,
          status: 'requested',
          history: [{ status: 'requested' }],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it('updates return status and preserves the actor and note in append-only history', async () => {
    permissions = ['orders.returns.update'];
    const response = await fetch(`${baseUrl}/admin/returns/${RETURN_ID}/status`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'approved', note: 'Eligible for return' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'approved',
      history: [
        { status: 'requested' },
        {
          previousStatus: 'requested',
          status: 'approved',
          actorAdminId: ADMIN_ID,
          note: 'Eligible for return',
        },
      ],
    });
    expect(returnRecord.approvedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid return transitions without modifying history', async () => {
    permissions = ['orders.returns.update'];
    const response = await fetch(`${baseUrl}/admin/returns/${RETURN_ID}/status`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'refunded' }),
    });

    expect(response.status).toBe(409);
    expect(returnRecord.status).toBe('requested');
    expect(returnRecord.statusHistory).toHaveLength(1);
    expect(prisma.orderReturn.update).not.toHaveBeenCalled();
  });

  it('enforces separate read and update permissions', async () => {
    const orderReadDenied = await fetch(`${baseUrl}/admin/orders`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(orderReadDenied.status).toBe(403);

    permissions = ['orders.read'];
    const returnReadDenied = await fetch(`${baseUrl}/admin/returns`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(returnReadDenied.status).toBe(403);
  });

  function resetOrder() {
    Object.assign(order, createOrder());
    order.statusHistory.splice(0, order.statusHistory.length, ...createOrder().statusHistory);
  }

  function resetReturn() {
    Object.assign(returnRecord, createReturn());
    returnRecord.statusHistory.splice(
      0,
      returnRecord.statusHistory.length,
      ...createReturn().statusHistory,
    );
  }
});

function createOrder() {
  return {
    id: ORDER_ID,
    orderNumber: 'ORD-1001',
    customerId: 'customer-id',
    status: 'pending',
    contactName: 'Customer Example',
    contactPhone: '+8801234567890',
    contactEmail: 'customer@example.com',
    deliveryRecipientName: 'Recipient Example',
    deliveryRecipientPhone: '+8801234567890',
    deliveryAddressLine1: '1 Main Street',
    deliveryAddressLine2: null,
    deliveryArea: null,
    deliveryDistrict: 'Dhaka',
    deliveryDivision: 'Dhaka',
    deliveryPostalCode: null,
    deliveryCountryCode: 'BD',
    subtotalPoisha: 10000,
    discountPoisha: 0,
    deliveryFeePoisha: 500,
    taxPoisha: 0,
    totalPoisha: 10500,
    createdAt: INITIAL_DATE,
    items: [
      {
        id: ITEM_ID,
        variantId: 'variant-id',
        productName: 'Sample product',
        variantSku: 'SAMPLE-1',
        attributes: { color: 'blue' },
        quantity: 1,
        unitPricePoisha: 10000,
        lineTotalPoisha: 10000,
        createdAt: INITIAL_DATE,
      },
    ],
    statusHistory: [
      {
        id: 'initial-history-id',
        fromStatus: null,
        toStatus: 'pending',
        changedByAdminId: null,
        note: null,
        createdAt: INITIAL_DATE,
      },
    ] as Array<Record<string, unknown>>,
  };
}

function createReturn() {
  return {
    id: RETURN_ID,
    orderId: ORDER_ID,
    status: 'requested',
    reason: 'Item arrived damaged',
    refundTotalPoisha: 10000,
    approvedAt: null,
    receivedAt: null,
    refundedAt: null,
    cancelledAt: null,
    createdAt: INITIAL_DATE,
    items: [
      {
        id: 'return-item-id',
        orderItemId: ITEM_ID,
        quantity: 1,
        refundAmountPoisha: 10000,
        createdAt: INITIAL_DATE,
      },
    ],
    statusHistory: [
      {
        id: 'initial-return-history-id',
        fromStatus: null,
        toStatus: 'requested',
        changedByAdminId: null,
        note: null,
        createdAt: INITIAL_DATE,
      },
    ] as Array<Record<string, unknown>>,
  };
}
