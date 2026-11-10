import { describe, expect, it, vi } from 'vitest';
import { ShippingController, SteadfastWebhookController, type RawBodyRequest } from '../../src/shipping/shipping.controller';
import type { ShippingService } from '../../src/shipping/shipping.service';

type ServiceMock = ShippingService & {
  createParcel: ReturnType<typeof vi.fn>;
  handleSteadfastWebhook: ReturnType<typeof vi.fn>;
};

function serviceMock() {
  return {
    createParcel: vi.fn(),
    handleSteadfastWebhook: vi.fn(),
  } as unknown as ServiceMock;
}

describe('ShippingController', () => {
  it('parses the parcel request body and delegates to the service', async () => {
    const service = serviceMock();
    const controller = new ShippingController(service);

    service.createParcel.mockResolvedValueOnce({
      id: 'shipment-id',
      orderId: 'order-id',
      trackingNumber: 'TRK-123',
      courier: 'steadfast',
      status: 'booked',
      codAmountPoisha: 500,
      bookedAt: null,
      deliveredAt: null,
      createdAt: '2026-10-25T10:00:00.000Z',
    });

    const result = await controller.createParcel({
      orderId: 'order-id',
      customerName: 'Test Customer',
      customerPhone: '+8801700000000',
      customerAddress: 'House 1',
      customerCity: 'Dhaka',
      codAmountPoisha: 500,
      itemName: 'Widget',
      itemQuantity: 2,
    });

    expect(service.createParcel).toHaveBeenCalledTimes(1);
    expect(service.createParcel).toHaveBeenCalledWith({
      orderId: 'order-id',
      customerName: 'Test Customer',
      customerPhone: '+8801700000000',
      customerAddress: 'House 1',
      customerCity: 'Dhaka',
      codAmountPoisha: 500,
      itemName: 'Widget',
      itemQuantity: 2,
      itemWeightGram: undefined,
    });
    expect(result.trackingNumber).toBe('TRK-123');
  });
});

describe('SteadfastWebhookController', () => {
  it('reads the raw body and signature header and delegates to the service', async () => {
    const service = serviceMock();
    const controller = new SteadfastWebhookController(service);

    const body = JSON.stringify({
      tracking_number: 'TRK-123',
      status: 'delivered',
    });
    service.handleSteadfastWebhook.mockResolvedValueOnce({
      id: 'shipment-id',
      orderId: 'order-id',
      trackingNumber: 'TRK-123',
      courier: 'steadfast',
      status: 'delivered',
      codAmountPoisha: 500,
      bookedAt: null,
      deliveredAt: '2026-10-26T10:00:00.000Z',
      createdAt: '2026-10-25T10:00:00.000Z',
    });

    const request = {
      headers: { 'x-steadfast-signature': 'sig-123' },
      [Symbol.asyncIterator]: function () {
        const chunks = [Buffer.from(body)];
        let index = 0;
        return {
          next() {
            if (index < chunks.length) {
              return Promise.resolve({ value: chunks[index++], done: false });
            }
            return Promise.resolve({ value: undefined, done: true });
          },
          return() {
            return Promise.resolve({ value: undefined, done: true });
          },
        };
      },
    } as unknown as RawBodyRequest;

    const result = await controller.handleWebhook(request);

    expect(service.handleSteadfastWebhook).toHaveBeenCalledTimes(1);
    expect(service.handleSteadfastWebhook).toHaveBeenCalledWith(
      expect.any(Buffer),
      'sig-123',
    );
    expect(Buffer.compare(service.handleSteadfastWebhook.mock.calls[0]?.[0] as Buffer, Buffer.from(body))).toBe(0);
    expect(result.status).toBe('delivered');
  });
});
