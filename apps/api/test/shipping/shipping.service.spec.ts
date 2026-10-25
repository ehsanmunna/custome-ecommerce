import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../../src/platform/database/prisma.service';
import type { ShippingAdapter } from '../../src/shipping/shipping-adapter';
import { ShippingService } from '../../src/shipping/shipping.service';
import { describe, expect, it, vi } from 'vitest';

type ShippingAdapterMock = ShippingAdapter & {
  isConfigured: ReturnType<typeof vi.fn>;
  createParcel: ReturnType<typeof vi.fn>;
};

function shipmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shipment-id',
    orderId: 'order-id',
    courier: 'steadfast',
    status: 'pending',
    trackingNumber: null,
    codAmountPoisha: 0,
    bookedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    returnedAt: null,
    cancelledAt: null,
    failedAt: null,
    createdAt: new Date('2026-10-25T10:00:00.000Z'),
    ...overrides,
  };
}

function createHarness() {
  const prisma = {
    order: {
      findUnique: vi.fn(),
    },
    shipment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;

  const adapter = {
    name: 'steadfast',
    isConfigured: vi.fn(() => true),
    createParcel: vi.fn(),
  } as unknown as ShippingAdapterMock;
  const verifyWebhookSignature = vi.fn(async () => true);

  const service = new ShippingService(
    prisma,
    adapter,
    {} as any,
    { log: vi.fn(), error: vi.fn() } as any,
    verifyWebhookSignature,
  );

  return { prisma, adapter, service, verifyWebhookSignature };
}

describe('ShippingService.createParcel', () => {
  it('creates a shipment and returns a view', async () => {
    const { prisma, adapter, service } = createHarness();

    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'order-id',
      status: 'pending',
      shipments: [],
      contactName: 'Test Customer',
      contactPhone: '+8801700000000',
      deliveryAddressLine1: 'House 1',
      deliveryDistrict: 'Dhaka',
      totalPoisha: 1000,
    });
    (adapter.createParcel as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      trackingNumber: 'TRK-123',
      courierReference: 'REF-9',
      status: 'booked',
      bookedAt: new Date('2026-10-25T11:00:00.000Z'),
    });
    (prisma.shipment.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      shipmentRow({
        trackingNumber: 'TRK-123',
        status: 'booked',
        bookedAt: new Date('2026-10-25T11:00:00.000Z'),
      }),
    );

    const view = await service.createParcel({
      orderId: 'order-id',
      customerName: 'Test Customer',
      customerPhone: '+8801700000000',
      customerAddress: 'House 1',
      customerCity: 'Dhaka',
      codAmountPoisha: 500,
      itemName: 'Widget',
      itemQuantity: 2,
    });

    expect(adapter.createParcel).toHaveBeenCalledTimes(1);
    expect((prisma.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      data: {
        orderId: 'order-id',
        courier: 'steadfast',
        status: 'booked',
        trackingNumber: 'TRK-123',
        codAmountPoisha: 500,
        bookedAt: new Date('2026-10-25T11:00:00.000Z'),
      },
    });
    expect(view).toMatchObject({
      id: 'shipment-id',
      orderId: 'order-id',
      trackingNumber: 'TRK-123',
      courier: 'steadfast',
      status: 'booked',
      codAmountPoisha: 0,
    });
  });

  it('throws NotFound when the order does not exist', async () => {
    const { prisma, service } = createHarness();
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      service.createParcel({
        orderId: 'missing',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws Conflict when the order already has a shipment', async () => {
    const { prisma, service } = createHarness();
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'order-id',
      status: 'pending',
      shipments: [{ id: 'existing', trackingNumber: 'TRK-OLD' }],
    });

    await expect(
      service.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ServiceUnavailable when the adapter is not configured', async () => {
    const { adapter, service } = createHarness();
    adapter.isConfigured.mockReturnValueOnce(false);

    await expect(
      service.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailable when the adapter call fails', async () => {
    const { prisma, adapter, service } = createHarness();
    (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'order-id',
      status: 'pending',
      shipments: [],
      contactName: 'N',
      contactPhone: 'P',
      deliveryAddressLine1: 'A',
      deliveryDistrict: 'C',
      totalPoisha: 100,
    });
    adapter.createParcel.mockRejectedValueOnce(new Error('adapter down'));

    await expect(
      service.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('ShippingService.handleSteadfastWebhook', () => {
  it('rejects when the signature is invalid', async () => {
    const { service, verifyWebhookSignature } = createHarness();
    verifyWebhookSignature.mockResolvedValueOnce(false);

    await expect(
      service.handleSteadfastWebhook('payload', 'bad-signature'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates the shipment status and timestamps from a webhook', async () => {
    const { prisma, service } = createHarness();

    (prisma.shipment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      shipmentRow({ status: 'booked', trackingNumber: 'TRK-123' }),
    );
    (prisma.shipment.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      shipmentRow({ status: 'delivered', trackingNumber: 'TRK-123', deliveredAt: new Date('2026-10-26T10:00:00.000Z') }),
    );

    const view = await service.handleSteadfastWebhook(
      JSON.stringify({ tracking_number: 'TRK-123', status: 'delivered', occurred_at: '2026-10-26T10:00:00Z' }),
      'good-signature',
    );

    expect((prisma.shipment.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'shipment-id' },
      data: { status: 'delivered', deliveredAt: expect.any(Date) },
    });
    expect(view.status).toBe('delivered');
  });

  it('throws NotFound when no shipment matches the tracking number', async () => {
    const { prisma, service } = createHarness();
    (prisma.shipment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      service.handleSteadfastWebhook(
        JSON.stringify({ tracking_number: 'TRK-MISSING', status: 'delivered' }),
        'good-signature',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
