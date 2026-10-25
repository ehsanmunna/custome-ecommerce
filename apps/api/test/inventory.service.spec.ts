import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/platform/database/prisma.service';
import {
  availableQuantity,
  InventoryService,
  isLowStock,
} from '../src/inventory/inventory.service';

const variantId = 'a65a44f6-0ed0-40b2-aea4-84a7e716862f';
const reservationId = 'b75a44f6-0ed0-40b2-aea4-84a7e716862f';
const manualReferenceId = 'c85a44f6-0ed0-40b2-aea4-84a7e716862f';

function inventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    variantId,
    quantityOnHand: 10,
    quantityReserved: 2,
    lowStockThreshold: 3,
    createdAt: new Date('2026-10-25T12:00:00.000Z'),
    updatedAt: new Date('2026-10-25T12:00:00.000Z'),
    ...overrides,
  };
}

function reservationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: reservationId,
    variantId,
    quantity: 2,
    status: 'active',
    referenceType: 'manual',
    referenceId: manualReferenceId,
    expiresAt: null,
    createdAt: new Date('2026-10-25T12:00:00.000Z'),
    updatedAt: new Date('2026-10-25T12:00:00.000Z'),
    ...overrides,
  };
}

function createHarness() {
  let item = inventoryRow();
  let reservation = reservationRow();
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: variantId }]),
    inventoryItem: {
      findUnique: vi.fn(async () => item),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        item = inventoryRow({
          quantityOnHand: 0,
          quantityReserved: 0,
          lowStockThreshold: data.lowStockThreshold,
        });
        return item;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        item = { ...item, ...data };
        return item;
      }),
    },
    stockReservation: {
      findUnique: vi.fn(async () => reservation),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        reservation = reservationRow(data);
        return reservation;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        reservation = { ...reservation, ...data };
        return reservation;
      }),
    },
    stockMovement: { create: vi.fn(async () => undefined) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    $queryRaw: vi.fn(async () => []),
    inventoryItem: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    stockReservation: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
  };

  return {
    service: new InventoryService(prisma as unknown as PrismaService),
    prisma,
    tx,
    getItem: () => item,
    getReservation: () => reservation,
  };
}

describe('inventory calculations', () => {
  it('derives available stock and treats the low-stock threshold as inclusive', () => {
    expect(availableQuantity(10, 3)).toBe(7);
    expect(isLowStock(10, 3, 7)).toBe(true);
    expect(isLowStock(10, 3, 6)).toBe(false);
    expect(isLowStock(0, 0, 0)).toBe(true);
  });
});

describe('inventory service reads', () => {
  it('lists inventory with derived availability and deterministic pagination', async () => {
    const { service, prisma } = createHarness();
    prisma.inventoryItem.findMany.mockResolvedValueOnce([inventoryRow()] as never);
    prisma.inventoryItem.count.mockResolvedValueOnce(1);

    const result = await service.listInventory({ page: 2, pageSize: 5 });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
      orderBy: { variantId: 'asc' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      items: [
        {
          variantId,
          onHand: 10,
          reserved: 2,
          available: 8,
          lowStockThreshold: 3,
          lowStock: false,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 5,
    });
  });

  it('filters low-stock rows before pagination and reports the filtered total', async () => {
    const { service, prisma } = createHarness();
    const row = {
      variant_id: variantId,
      quantity_on_hand: 5,
      quantity_reserved: 1,
      low_stock_threshold: 4,
    };
    prisma.$queryRaw
      .mockResolvedValueOnce([row] as never)
      .mockResolvedValueOnce([{ total: 1n }] as never);

    const result = await service.listInventory({ page: 1, pageSize: 20, lowStock: true });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      items: [
        {
          variantId,
          onHand: 5,
          reserved: 1,
          available: 4,
          lowStockThreshold: 4,
          lowStock: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('lists reservations by status with stable ordering and source details', async () => {
    const { service, prisma } = createHarness();
    prisma.stockReservation.findMany.mockResolvedValueOnce([reservationRow()] as never);
    prisma.stockReservation.count.mockResolvedValueOnce(1);

    const result = await service.listReservations({
      page: 1,
      pageSize: 10,
      status: 'active',
    });

    expect(prisma.stockReservation.findMany).toHaveBeenCalledWith({
      where: { status: 'active' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(result.items[0]).toMatchObject({
      id: reservationId,
      variantId,
      quantity: 2,
      status: 'active',
      source: 'manual',
      sourceId: manualReferenceId,
    });
  });
});

describe('inventory service mutations', () => {
  it('initializes a variant with its first positive adjustment and an initial movement', async () => {
    const { service, tx } = createHarness();
    tx.inventoryItem.findUnique.mockResolvedValueOnce(null as never);

    const result = await service.adjustInventory(variantId, {
      quantityDelta: 10,
      reason: 'Opening stock',
      lowStockThreshold: 2,
    });

    expect(result.onHand).toBe(10);
    expect(tx.inventoryItem.create).toHaveBeenCalledWith({
      data: { variantId, lowStockThreshold: 2 },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'initial',
        onHandDelta: 10,
        reservedDelta: 0,
        resultingOnHand: 10,
        note: 'Opening stock',
      }),
    });
  });

  it('rejects an adjustment that would reduce on-hand stock below reserved stock', async () => {
    const { service, tx } = createHarness();

    await expect(
      service.adjustInventory(variantId, { quantityDelta: -9, reason: 'Correction' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects initialization with a negative adjustment and rejects an unknown variant', async () => {
    const { service, tx } = createHarness();
    tx.inventoryItem.findUnique.mockResolvedValueOnce(null as never);

    await expect(
      service.adjustInventory(variantId, { quantityDelta: -1, reason: 'Correction' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventoryItem.create).not.toHaveBeenCalled();

    tx.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      service.adjustInventory(variantId, { quantityDelta: 1, reason: 'Opening stock' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a manual reservation and records the matching movement', async () => {
    const { service, tx } = createHarness();

    const result = await service.createReservation({
      variantId,
      quantity: 3,
      expiresAt: new Date('2026-10-26T12:00:00.000Z'),
    });

    expect(result.status).toBe('active');
    expect(tx.inventoryItem.update).toHaveBeenCalledWith({
      where: { variantId },
      data: { quantityReserved: 5 },
    });
    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'reservation',
        reservedDelta: 3,
        resultingReserved: 5,
        referenceType: 'manual',
      }),
    });
  });

  it('rejects reservations exceeding available stock without updating balances', async () => {
    const { service, tx } = createHarness();

    await expect(service.createReservation({ variantId, quantity: 9 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    expect(tx.stockReservation.create).not.toHaveBeenCalled();
  });

  it('releases and commits active reservations with balanced movement entries', async () => {
    const release = createHarness();
    await release.service.updateReservationStatus(reservationId, { status: 'released' });
    expect(release.getItem()).toMatchObject({ quantityOnHand: 10, quantityReserved: 0 });
    expect(release.getReservation().status).toBe('released');
    expect(release.tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'release',
        onHandDelta: 0,
        reservedDelta: -2,
        resultingOnHand: 10,
        resultingReserved: 0,
      }),
    });

    const commit = createHarness();
    await commit.service.updateReservationStatus(reservationId, { status: 'committed' });
    expect(commit.getItem()).toMatchObject({ quantityOnHand: 8, quantityReserved: 0 });
    expect(commit.getReservation().status).toBe('committed');
    expect(commit.tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'deduction',
        onHandDelta: -2,
        reservedDelta: -2,
        resultingOnHand: 8,
        resultingReserved: 0,
      }),
    });
  });

  it('rejects repeated reservation transitions and missing reservations', async () => {
    const repeated = createHarness();
    repeated.tx.stockReservation.findUnique
      .mockResolvedValueOnce(reservationRow({ status: 'released' }) as never)
      .mockResolvedValueOnce(reservationRow({ status: 'released' }) as never);
    await expect(
      repeated.service.updateReservationStatus(reservationId, { status: 'committed' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repeated.tx.inventoryItem.update).not.toHaveBeenCalled();

    const missing = createHarness();
    missing.tx.stockReservation.findUnique.mockResolvedValueOnce(null as never);
    await expect(
      missing.service.updateReservationStatus(reservationId, { status: 'released' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates failures from the transaction instead of returning success-shaped results', async () => {
    const { service, tx } = createHarness();
    tx.stockMovement.create.mockRejectedValueOnce(new Error('ledger write failed'));

    await expect(
      service.adjustInventory(variantId, { quantityDelta: 1, reason: 'Count correction' }),
    ).rejects.toThrow('ledger write failed');
  });
});
