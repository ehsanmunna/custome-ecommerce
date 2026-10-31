import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type {
  AdminOrderQuery,
  AdminReturnQuery,
  OrderStatus,
  OrderStatusUpdate,
  ReturnStatus,
  ReturnStatusUpdate,
} from './orders.schemas';

const orderInclude = {
  items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.OrderInclude;

const returnInclude = {
  items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  statusHistory: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.OrderReturnInclude;

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
type ReturnRecord = Prisma.OrderReturnGetPayload<{ include: typeof returnInclude }>;

const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'partially_delivered'],
  delivered: ['returned'],
  partially_delivered: ['delivered'],
  cancelled: [],
  returned: [],
};

const returnTransitions: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['refunded'],
  rejected: [],
  refunded: [],
  cancelled: [],
};

export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderResponse {
  id: string;
  number: string;
  customerId?: string;
  status: OrderStatus;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  delivery: {
    recipientName: string;
    recipientPhone: string;
    line1: string;
    line2?: string;
    area?: string;
    district: string;
    division: string;
    postalCode?: string;
    countryCode: string;
  };
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  items: Array<{
    variantId: string;
    productName: string;
    sku: string;
    attributes: Record<string, unknown>;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  history: Array<{
    previousStatus?: OrderStatus;
    status: OrderStatus;
    actorAdminId?: string;
    note?: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export interface AdminReturnResponse {
  id: string;
  orderId: string;
  status: ReturnStatus;
  reason: string;
  refundTotal: number;
  items: Array<{
    orderItemId: string;
    quantity: number;
    refundAmount: number;
  }>;
  history: Array<{
    previousStatus?: ReturnStatus;
    status: ReturnStatus;
    actorAdminId?: string;
    note?: string;
    createdAt: string;
  }>;
  createdAt: string;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(input: AdminOrderQuery): Promise<AdminPage<AdminOrderResponse>> {
    const where: Prisma.OrderWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.createdFrom || input.createdTo
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: input.createdFrom } : {}),
              ...(input.createdTo ? { lte: input.createdTo } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: rows.map(mapOrder),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getOrder(orderId: string): Promise<AdminOrderResponse> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return mapOrder(order);
  }

  async updateOrderStatus(
    orderId: string,
    input: OrderStatusUpdate,
    adminId: string,
  ): Promise<AdminOrderResponse> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
      `);
      if (locked.length === 0) throw new NotFoundException('Order not found');

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) throw new NotFoundException('Order not found');
      if (!orderTransitions[order.status].includes(input.status)) {
        throw new ConflictException(
          `Order cannot transition from ${order.status} to ${input.status}`,
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: input.status },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: input.status,
          changedByAdminId: adminId,
          note: input.note ?? null,
        },
      });

      const updated = await tx.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!updated) throw new Error('Updated order disappeared during its status transaction');
      return mapOrder(updated);
    });
  }

  async listReturns(input: AdminReturnQuery): Promise<AdminPage<AdminReturnResponse>> {
    const [rows, total] = await Promise.all([
      this.prisma.orderReturn.findMany({
        include: returnInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.orderReturn.count(),
    ]);
    return {
      items: rows.map(mapReturn),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async updateReturnStatus(
    returnId: string,
    input: ReturnStatusUpdate,
    adminId: string,
  ): Promise<AdminReturnResponse> {
    return this.prisma.$transaction(async (tx) => {
      const lockedReturn = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM order_returns WHERE id = ${returnId}::uuid FOR UPDATE
      `);
      if (lockedReturn.length === 0) throw new NotFoundException('Return not found');

      const returnRecord = await tx.orderReturn.findUnique({
        where: { id: returnId },
        include: returnInclude,
      });
      if (!returnRecord) throw new NotFoundException('Return not found');

      await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM order_items
        WHERE order_id = ${returnRecord.orderId}::uuid
        ORDER BY id
        FOR UPDATE
      `);

      if (!returnTransitions[returnRecord.status].includes(input.status)) {
        throw new ConflictException(
          `Return cannot transition from ${returnRecord.status} to ${input.status}`,
        );
      }

      const now = new Date();
      await tx.orderReturn.update({
        where: { id: returnId },
        data: {
          status: input.status,
          ...(input.status === 'approved' ? { approvedAt: now } : {}),
          ...(input.status === 'received' ? { receivedAt: now } : {}),
          ...(input.status === 'refunded' ? { refundedAt: now } : {}),
          ...(input.status === 'cancelled' ? { cancelledAt: now } : {}),
        },
      });
      await tx.orderReturnStatusHistory.create({
        data: {
          returnId,
          fromStatus: returnRecord.status,
          toStatus: input.status,
          changedByAdminId: adminId,
          note: input.note ?? null,
        },
      });

      const updated = await tx.orderReturn.findUnique({
        where: { id: returnId },
        include: returnInclude,
      });
      if (!updated) throw new Error('Updated return disappeared during its status transaction');
      return mapReturn(updated);
    });
  }
}

function mapOrder(order: OrderRecord): AdminOrderResponse {
  return {
    id: order.id,
    number: order.orderNumber,
    ...(order.customerId ? { customerId: order.customerId } : {}),
    status: order.status,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    ...(order.contactEmail ? { contactEmail: order.contactEmail } : {}),
    delivery: {
      recipientName: order.deliveryRecipientName,
      recipientPhone: order.deliveryRecipientPhone,
      line1: order.deliveryAddressLine1,
      ...(order.deliveryAddressLine2 ? { line2: order.deliveryAddressLine2 } : {}),
      ...(order.deliveryArea ? { area: order.deliveryArea } : {}),
      district: order.deliveryDistrict,
      division: order.deliveryDivision,
      ...(order.deliveryPostalCode ? { postalCode: order.deliveryPostalCode } : {}),
      countryCode: order.deliveryCountryCode,
    },
    subtotal: order.subtotalPoisha,
    discount: order.discountPoisha,
    deliveryFee: order.deliveryFeePoisha,
    tax: order.taxPoisha,
    total: order.totalPoisha,
    items: order.items.map((item) => ({
      variantId: item.variantId,
      productName: item.productName,
      sku: item.variantSku,
      attributes:
        item.attributes !== null &&
        typeof item.attributes === 'object' &&
        !Array.isArray(item.attributes)
          ? item.attributes
          : {},
      quantity: item.quantity,
      unitPrice: item.unitPricePoisha,
      lineTotal: item.lineTotalPoisha,
    })),
    history: order.statusHistory.map((entry) => ({
      ...(entry.fromStatus ? { previousStatus: entry.fromStatus } : {}),
      status: entry.toStatus,
      ...(entry.changedByAdminId ? { actorAdminId: entry.changedByAdminId } : {}),
      ...(entry.note ? { note: entry.note } : {}),
      createdAt: entry.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}

function mapReturn(returnRecord: ReturnRecord): AdminReturnResponse {
  return {
    id: returnRecord.id,
    orderId: returnRecord.orderId,
    status: returnRecord.status,
    reason: returnRecord.reason,
    refundTotal: returnRecord.refundTotalPoisha,
    items: returnRecord.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      refundAmount: item.refundAmountPoisha,
    })),
    history: returnRecord.statusHistory.map((entry) => ({
      ...(entry.fromStatus ? { previousStatus: entry.fromStatus } : {}),
      status: entry.toStatus,
      ...(entry.changedByAdminId ? { actorAdminId: entry.changedByAdminId } : {}),
      ...(entry.note ? { note: entry.note } : {}),
      createdAt: entry.createdAt.toISOString(),
    })),
    createdAt: returnRecord.createdAt.toISOString(),
  };
}
