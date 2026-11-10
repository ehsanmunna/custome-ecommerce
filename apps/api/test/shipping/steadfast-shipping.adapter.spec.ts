import { describe, expect, it, vi } from 'vitest';
import { SteadfastShippingAdapter } from '../../src/shipping/steadfast-shipping.adapter';

type SteadfastSettings = {
  apiKey?: string;
  baseUrl?: string;
};
type SteadfastDeps = {
  fetch?: typeof fetch;
};
type FetchCall = Parameters<typeof fetch>;

function createAdapter(
  settings: SteadfastSettings = {},
  dependencies: SteadfastDeps = {},
) {
  return new SteadfastShippingAdapter(
    { apiKey: 'test-key', baseUrl: 'https://api.steadfast.com.bd', ...settings },
    dependencies,
  );
}

describe('SteadfastShippingAdapter', () => {
  it('reports unconfigured when apiKey or baseUrl is missing', () => {
    expect(createAdapter({ apiKey: undefined }).isConfigured()).toBe(false);
    expect(createAdapter({ baseUrl: undefined }).isConfigured()).toBe(false);
    expect(createAdapter({}).isConfigured()).toBe(true);
  });

  it('creates a parcel and maps the tracking number, reference, status, and bookedAt', async () => {
    const fetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            tracking_number: 'TRK-123',
            reference_id: 'REF-9',
            status: 'booked',
            booked_at: '2026-10-25T10:00:00Z',
          }),
          { status: 200 },
        ),
      ),
    );
    const adapter = createAdapter({}, { fetch });

    const result = await adapter.createParcel({
      orderId: 'order-id',
      customerName: 'Test Customer',
      customerPhone: '+8801700000000',
      customerAddress: 'House 1, Road 1',
      customerCity: 'Dhaka',
      codAmountPoisha: 1000,
      itemName: 'Widget',
      itemQuantity: 2,
      itemWeightGram: 500,
    });

    const call = (fetch.mock.calls[0] as unknown as FetchCall)!;
    const url = call[0];
    const init = call[1]!;
    expect(url).toBe('https://api.steadfast.com.bd/api/v1/shipments');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      recipient_name: 'Test Customer',
      recipient_phone: '+8801700000000',
      recipient_address: 'House 1, Road 1',
      recipient_city: 'Dhaka',
      cod_amount: 1000,
      product_name: 'Widget',
      product_quantity: 2,
      product_weight: 500,
      reference: 'order-id',
    });
    expect(result).toMatchObject({
      trackingNumber: 'TRK-123',
      courierReference: 'REF-9',
      status: 'booked',
    });
    expect(result.bookedAt?.toISOString()).toBe('2026-10-25T10:00:00.000Z');
  });

  it('accepts alternate tracking fields in the response', async () => {
    const fetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ tracking: 'TRK-ALT', id: 'REF-ALT', status: 'picked up' }),
          { status: 200 },
        ),
      ),
    );
    const adapter = createAdapter({}, { fetch });

    const result = await adapter.createParcel({
      orderId: 'order-id',
      customerName: 'N',
      customerPhone: 'P',
      customerAddress: 'A',
      customerCity: 'C',
      codAmountPoisha: 0,
      itemName: 'Item',
      itemQuantity: 1,
    });

    expect(result.trackingNumber).toBe('TRK-ALT');
    expect(result.courierReference).toBe('REF-ALT');
    expect(result.status).toBe('picked_up');
  });

  it('throws when the response is not ok', async () => {
    const fetch = vi.fn(async () =>
      Promise.resolve(new Response('error', { status: 401, statusText: 'Unauthorized' })),
    );
    const adapter = createAdapter({}, { fetch });

    await expect(
      adapter.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toMatchObject({ message: 'Steadfast create parcel failed with HTTP 401' });
  });

  it('throws when the response omits a tracking number', async () => {
    const fetch = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify({ status: 'booked' }), { status: 200 })),
    );
    const adapter = createAdapter({}, { fetch });

    await expect(
      adapter.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toMatchObject({
      message: 'Steadfast create parcel response did not include a tracking number',
    });
  });

  it('throws a typed adapter error when the request fails', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const adapter = createAdapter({}, { fetch });

    await expect(
      adapter.createParcel({
        orderId: 'order-id',
        customerName: 'N',
        customerPhone: 'P',
        customerAddress: 'A',
        customerCity: 'C',
        codAmountPoisha: 0,
        itemName: 'Item',
        itemQuantity: 1,
      }),
    ).rejects.toMatchObject({
      message: 'Steadfast create parcel request failed',
      cause: expect.any(Error),
    });
  });

  it('defaults missing weight to zero and maps unknown status to pending', async () => {
    const fetch = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ tracking_number: 'TRK-1', status: 'unknown_status' }), {
          status: 200,
        }),
      ),
    );
    const adapter = createAdapter({}, { fetch });

    const result = await adapter.createParcel({
      orderId: 'order-id',
      customerName: 'N',
      customerPhone: 'P',
      customerAddress: 'A',
      customerCity: 'C',
      codAmountPoisha: 0,
      itemName: 'Item',
      itemQuantity: 1,
    });

    const body = JSON.parse(
      ((fetch.mock.calls[0] as unknown as FetchCall)![1]!.body as string),
    );
    expect(body.product_weight).toBe(0);
    expect(result.status).toBe('pending');
  });
});
