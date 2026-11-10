import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type {
  InventoryAdjustmentInput,
  InventoryQuery,
  ReservationInput,
  ReservationQuery,
  ReservationStatusInput,
} from './inventory.schemas';

type InventoryRow = {
  variant_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  low_stock_threshold: number;
};

export interface InventoryItemResponse {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  lowStock: boolean;
}

export interface ReservationResponse {
  id: string;
  variantId: string;
  quantity: number;
  status: 'active' | 'released' | 'committed' | 'expired';
  source?: 'cart' | 'order' | 'manual';
  sourceId?: string;
  expiresAt?: string;
}

export interface InventoryPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function availableQuantity(onHand: number, reserved: number): number {
  return onHand - reserved;
}

export function isLowStock(onHand: number, reserved: number, threshold: number): boolean {
  return availableQuantity(onHand, reserved) <= threshold;
}

function mapInventoryRow(row: {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
  lowStockThreshold: number;
}): InventoryItemResponse {
  return {
    variantId: row.variantId,
    onHand: row.quantityOnHand,
    reserved: row.quantityReserved,
    available: availableQuantity(row.quantityOnHand, row.quantityReserved),
    lowStockThreshold: row.lowStockThreshold,
    lowStock: isLowStock(row.quantityOnHand, row.quantityReserved, row.lowStockThreshold),
  };
}

function mapReservation(row: {
  id: string;
  variantId: string;
  quantity: number;
  status: string;
  referenceType: string | null;
  referenceId: string | null;
  expiresAt: Date | null;
}): ReservationResponse {
  return {
    id: row.id,
    variantId: row.variantId,
    quantity: row.quantity,
    status: row.status as ReservationResponse['status'],
    ...(row.referenceType ? { source: row.referenceType as ReservationResponse['source'] } : {}),
    ...(row.referenceId ? { sourceId: row.referenceId } : {}),
    ...(row.expiresAt ? { expiresAt: row.expiresAt.toISOString() } : {}),
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listInventory(input: InventoryQuery): Promise<InventoryPage<InventoryItemResponse>> {
    const skip = (input.page - 1) * input.pageSize;
    if (input.lowStock) {
      const [rows, countRows] = await Promise.all([
        this.prisma.$queryRaw<InventoryRow[]>(Prisma.sql`
          SELECT variant_id, quantity_on_hand, quantity_reserved, low_stock_threshold
          FROM inventory_items
          WHERE quantity_on_hand - quantity_reserved <= low_stock_threshold
          ORDER BY variant_id ASC
          LIMIT ${input.pageSize} OFFSET ${skip}
        `),
        this.prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS total
          FROM inventory_items
          WHERE quantity_on_hand - quantity_reserved <= low_stock_threshold
        `),
      ]);
      return {
        items: rows.map((row) =>
          mapInventoryRow({
            variantId: row.variant_id,
            quantityOnHand: row.quantity_on_hand,
            quantityReserved: row.quantity_reserved,
            lowStockThreshold: row.low_stock_threshold,
          }),
        ),
        total: Number(countRows[0]?.total ?? 0n),
        page: input.page,
        pageSize: input.pageSize,
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        orderBy: { variantId: 'asc' },
        skip,
        take: input.pageSize,
      }),
      this.prisma.inventoryItem.count(),
    ]);
    return {
      items: rows.map(mapInventoryRow),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async listReservations(input: ReservationQuery): Promise<InventoryPage<ReservationResponse>> {
    const where: Prisma.StockReservationWhereInput = input.status ? { status: input.status } : {};
    const [rows, total] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.stockReservation.count({ where }),
    ]);
    return {
      items: rows.map(mapReservation),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async adjustInventory(
    variantId: string,
    input: InventoryAdjustmentInput,
  ): Promise<InventoryItemResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockVariant(tx, variantId);
      let item = await tx.inventoryItem.findUnique({ where: { variantId } });
      let isNewInventory = false;
      if (!item) {
        if (input.quantityDelta < 1) {
          throw new ConflictException('A new inventory balance requires a positive adjustment');
        }
        item = await tx.inventoryItem.create({
          data: { variantId, lowStockThreshold: input.lowStockThreshold ?? 0 },
        });
        isNewInventory = true;
      }

      const quantityOnHand = item.quantityOnHand + input.quantityDelta;
      if (quantityOnHand < item.quantityReserved || quantityOnHand < 0) {
        throw new ConflictException('Adjustment cannot reduce stock below the reserved quantity');
      }
      if (quantityOnHand > 2_147_483_647) {
        throw new BadRequestException('Adjusted stock exceeds the supported quantity range');
      }

      const updated = await tx.inventoryItem.update({
        where: { variantId },
        data: {
          quantityOnHand,
          ...(input.lowStockThreshold !== undefined
            ? { lowStockThreshold: input.lowStockThreshold }
            : {}),
        },
      });
      await tx.stockMovement.create({
        data: {
          variantId,
          type: isNewInventory ? 'initial' : 'adjustment',
          onHandDelta: input.quantityDelta,
          reservedDelta: 0,
          resultingOnHand: updated.quantityOnHand,
          resultingReserved: updated.quantityReserved,
          note: input.reason,
        },
      });
      return mapInventoryRow(updated);
    });
  }

  async createReservation(input: ReservationInput): Promise<ReservationResponse> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockVariant(tx, input.variantId);
      const item = await tx.inventoryItem.findUnique({ where: { variantId: input.variantId } });
      if (!item) throw new NotFoundException('Inventory item not found');
      const available = availableQuantity(item.quantityOnHand, item.quantityReserved);
      if (input.quantity > available) {
        throw new ConflictException('Reservation quantity exceeds available stock');
      }

      const reservationId = randomUUID();
      const updated = await tx.inventoryItem.update({
        where: { variantId: input.variantId },
        data: { quantityReserved: item.quantityReserved + input.quantity },
      });
      const reservation = await tx.stockReservation.create({
        data: {
          id: reservationId,
          variantId: input.variantId,
          quantity: input.quantity,
          referenceType: 'manual',
          referenceId: reservationId,
          expiresAt: input.expiresAt,
        },
      });
      await tx.stockMovement.create({
        data: {
          variantId: input.variantId,
          type: 'reservation',
          onHandDelta: 0,
          reservedDelta: input.quantity,
          resultingOnHand: updated.quantityOnHand,
          resultingReserved: updated.quantityReserved,
          referenceType: 'manual',
          referenceId: reservationId,
        },
      });
      return mapReservation(reservation);
    });
  }

  async updateReservationStatus(
    reservationId: string,
    input: ReservationStatusInput,
  ): Promise<ReservationResponse> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new NotFoundException('Reservation not found');
      await this.lockVariant(tx, reservation.variantId);

      const lockedReservation = await tx.stockReservation.findUnique({
        where: { id: reservationId },
      });
      if (!lockedReservation) throw new NotFoundException('Reservation not found');
      if (lockedReservation.status !== 'active') {
        throw new ConflictException('Only active reservations can change status');
      }

      const item = await tx.inventoryItem.findUnique({
        where: { variantId: lockedReservation.variantId },
      });
      if (!item) throw new NotFoundException('Inventory item not found');
      if (item.quantityReserved < lockedReservation.quantity) {
        throw new ConflictException('Reserved quantity is inconsistent with the inventory balance');
      }

      const isCommit = input.status === 'committed';
      const quantityDelta = isCommit ? -lockedReservation.quantity : 0;
      const reservedDelta = -lockedReservation.quantity;
      const updatedItem = await tx.inventoryItem.update({
        where: { variantId: lockedReservation.variantId },
        data: {
          quantityOnHand: item.quantityOnHand + quantityDelta,
          quantityReserved: item.quantityReserved + reservedDelta,
        },
      });
      const updatedReservation = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: input.status },
      });
      await tx.stockMovement.create({
        data: {
          variantId: lockedReservation.variantId,
          type: isCommit ? 'deduction' : 'release',
          onHandDelta: quantityDelta,
          reservedDelta,
          resultingOnHand: updatedItem.quantityOnHand,
          resultingReserved: updatedItem.quantityReserved,
          ...(lockedReservation.referenceType
            ? {
                referenceType: lockedReservation.referenceType,
                referenceId: lockedReservation.referenceId,
              }
            : {}),
        },
      });
      return mapReservation(updatedReservation);
    });
  }

  private async lockVariant(tx: Prisma.TransactionClient, variantId: string): Promise<void> {
    const variants = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM product_variants WHERE id = ${variantId}::uuid FOR UPDATE
    `);
    if (variants.length === 0) throw new NotFoundException('Product variant not found');
  }
}
