import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthenticationGuard } from '../src/auth/authentication.guard';
import { AuthSessionService } from '../src/auth/auth-session.service';
import { InventoryController } from '../src/inventory/inventory.controller';
import { InventoryService } from '../src/inventory/inventory.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

describe('inventory HTTP API', () => {
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
  let permissions = ['inventory_read'];
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
  const inventory = {
    listInventory: vi.fn(async (input: unknown) => ({ items: [], total: 0, ...(input as object) })),
    listReservations: vi.fn(async (input: unknown) => ({
      items: [],
      total: 0,
      ...(input as object),
    })),
    adjustInventory: vi.fn(async () => ({
      variantId: 'a65a44f6-0ed0-40b2-aea4-84a7e716862f',
      onHand: 2,
      reserved: 0,
      available: 2,
      lowStockThreshold: 0,
      lowStock: false,
    })),
    createReservation: vi.fn(async () => ({
      id: 'b75a44f6-0ed0-40b2-aea4-84a7e716862f',
      variantId: 'a65a44f6-0ed0-40b2-aea4-84a7e716862f',
      quantity: 1,
      status: 'active',
      source: 'manual',
      sourceId: 'c85a44f6-0ed0-40b2-aea4-84a7e716862f',
    })),
    updateReservationStatus: vi.fn(async () => ({
      id: 'b75a44f6-0ed0-40b2-aea4-84a7e716862f',
      variantId: 'a65a44f6-0ed0-40b2-aea4-84a7e716862f',
      quantity: 1,
      status: 'released',
    })),
  };
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryController],
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

  it('serves paginated inventory and reservation lists with validated query inputs', async () => {
    const inventoryResponse = await fetch(
      `${baseUrl}/admin/inventory?page=2&pageSize=5&lowStock=true`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    expect(inventoryResponse.status).toBe(200);
    expect(inventory.listInventory).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      lowStock: true,
    });

    const reservationResponse = await fetch(
      `${baseUrl}/admin/inventory/reservations?status=active`,
      { headers: { authorization: 'Bearer test-token' } },
    );
    expect(reservationResponse.status).toBe(200);
    expect(inventory.listReservations).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: 'active',
    });

    const invalid = await fetch(`${baseUrl}/admin/inventory?lowStock=yes`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(invalid.status).toBe(400);
  });

  it('validates adjustment and reservation bodies and serves their routes', async () => {
    permissions = ['inventory_read', 'inventory_manage'];
    const variantId = 'a65a44f6-0ed0-40b2-aea4-84a7e716862f';
    const invalidAdjustment = await fetch(`${baseUrl}/admin/inventory/${variantId}/adjustments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ quantityDelta: 0, reason: 'Count' }),
    });
    expect(invalidAdjustment.status).toBe(400);
    expect(inventory.adjustInventory).not.toHaveBeenCalled();

    const adjustment = await fetch(`${baseUrl}/admin/inventory/${variantId}/adjustments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        quantityDelta: 2,
        reason: 'Count correction',
        lowStockThreshold: 1,
      }),
    });
    expect(adjustment.status).toBe(201);
    expect(inventory.adjustInventory).toHaveBeenCalledWith(variantId, {
      quantityDelta: 2,
      reason: 'Count correction',
      lowStockThreshold: 1,
    });

    const reservation = await fetch(`${baseUrl}/admin/inventory/reservations`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ variantId, quantity: 1 }),
    });
    expect(reservation.status).toBe(201);
    expect(inventory.createReservation).toHaveBeenCalledWith({ variantId, quantity: 1 });

    const reservationId = 'b75a44f6-0ed0-40b2-aea4-84a7e716862f';
    const transition = await fetch(
      `${baseUrl}/admin/inventory/reservations/${reservationId}/status`,
      {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'released' }),
      },
    );
    expect(transition.status).toBe(200);
    expect(inventory.updateReservationStatus).toHaveBeenCalledWith(reservationId, {
      status: 'released',
    });
  });

  it('enforces authentication and distinct inventory read and adjustment permissions', async () => {
    permissions = ['inventory_read'];
    const anonymous = await fetch(`${baseUrl}/admin/inventory`);
    expect(anonymous.status).toBe(401);

    const read = await fetch(`${baseUrl}/admin/inventory`, {
      headers: { authorization: 'Bearer test-token' },
    });
    expect(read.status).toBe(200);

    const variantId = 'a65a44f6-0ed0-40b2-aea4-84a7e716862f';
    const deniedAdjustment = await fetch(`${baseUrl}/admin/inventory/${variantId}/adjustments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ quantityDelta: 1, reason: 'Count' }),
    });
    expect(deniedAdjustment.status).toBe(403);

    permissions = ['inventory_read', 'inventory_manage'];
    const allowedAdjustment = await fetch(`${baseUrl}/admin/inventory/${variantId}/adjustments`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ quantityDelta: 1, reason: 'Count' }),
    });
    expect(allowedAdjustment.status).toBe(201);
  });
});
