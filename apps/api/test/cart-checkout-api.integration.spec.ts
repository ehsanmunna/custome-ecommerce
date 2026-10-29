import 'reflect-metadata';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartCheckoutController } from '../src/cart-checkout/cart-checkout.controller';
import { CartCheckoutService } from '../src/cart-checkout/cart-checkout.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

interface CartRow {
  id: string;
  customerId: string | null;
  status: string;
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    variant: {
      id: string;
      sku: string;
      pricePoisha: number;
      status: string;
      product: {
        id: string;
        translations: Array<{ locale: string; name: string }>;
      };
    };
  }>;
}

interface InventoryRow {
  variantId: string;
  quantityOnHand: number;
  quantityReserved: number;
}

interface ZoneRow {
  district: string;
  zone: { id: string; deliveryFeePoisha: number; isActive: boolean };
}

interface CouponRow {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderPoisha: number;
  startsAt: Date;
  expiresAt: Date;
  totalUsageLimit: number | null;
  _count: { redemptions: number };
  isActive: boolean;
}

describe('cart checkout HTTP API', () => {
const carts: CartRow[] = [];
const VALID_VARIANT_ID = '00000000-0000-4000-8000-000000000003';
const VALID_CART_ID = '00000000-0000-4000-8000-000000000001';
const VALID_ITEM_ID = '00000000-0000-4000-8000-000000000002';
const logger = { log: vi.fn(), error: vi.fn() };
  let cartService: any;
  let app: INestApplication;
  let baseUrl: string;

  const prisma = {
    cart: {
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        const cart: CartRow = {
          id: 'cart-id',
          customerId: args.data.customerId ?? null,
          status: 'active',
          items: [],
        };
        carts.push(cart);
        return cart;
      }),
      findUnique: vi.fn(async (args: { where: { id: string }; include?: any }) => {
        const cart = carts.find((c) => c.id === args.where.id);
        if (!cart) return null;
        return args.include ? cart : { id: cart.id, status: cart.status };
      }),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, any> }) => {
        const cart = carts.find((c) => c.id === args.where.id);
        if (!cart) throw new Error('missing cart');
        Object.assign(cart, args.data);
        return cart;
      }),
    },
    cartItem: {
      create: vi.fn(async (args: { data: Record<string, any> }) => ({
        id: 'cart-item-id',
        ...args.data,
      })),
      update: vi.fn(async (args: { where: { id: string }; data: Record<string, any> }) => ({
        id: args.where.id,
        ...args.data,
      })),
      delete: vi.fn(async () => undefined),
    },
    productVariant: {
      findUnique: vi.fn(async () => ({
        id: 'variant-id',
        productId: 'product-id',
        sku: 'SKU-001',
        pricePoisha: 1000,
        status: 'active',
        attributes: {},
        product: {
          id: 'product-id',
          translations: [{ locale: 'bn', name: 'ভালো পণ্য' }],
        },
      })),
    },
    inventoryItem: {
      findUnique: vi.fn(async () => ({
      variantId: VALID_VARIANT_ID,
        quantityOnHand: 10,
        quantityReserved: 2,
      })),
    },
    order: {
      create: vi.fn(async (args: { data: Record<string, any> }) => ({
        id: 'order-id',
        orderNumber: 'ORD-test-1234',
        status: 'pending',
        totalPoisha: args.data.totalPoisha,
        ...args.data,
      })),
    },
    coupon: {
      findUnique: vi.fn(async () => null),
    },
    couponRedemption: {
      create: vi.fn(async () => ({ id: 'redemption-id' })),
    },
    shippingZoneDistrict: {
      findUnique: vi.fn(async () => ({
        district: 'Dhaka',
        zone: { id: 'zone-id', deliveryFeePoisha: 5000, isActive: true },
      })),
    },
    $queryRaw: vi.fn(async () => [{ id: 'variant-id' }]),
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };

  beforeAll(async () => {
    cartService = {
      createCart: vi.fn(async (customerId: string | undefined) => ({
        id: 'cart-id',
        customerId,
        status: 'active',
        items: [],
      })),
      getCart: vi.fn(async (cartId: string) => ({
        id: cartId,
        customerId: null,
        status: 'active',
        items: [],
      })),
      addCartItem: vi.fn(async (cartId: string, input: any) => ({
        id: cartId,
        status: 'active',
        items: [{ id: 'item-id', variantId: input.variantId, quantity: input.quantity, unitPrice: 1000 }],
      })),
      updateCartItem: vi.fn(async (cartId: string, itemId: string, input: any) => ({
        id: cartId,
        status: 'active',
        items: [{ id: itemId, quantity: input.quantity, unitPrice: 1000 }],
      })),
      removeCartItem: vi.fn(async () => undefined),
      checkout: vi.fn(async (cartId: string, input: any) => ({
        orderId: 'order-id',
        orderNumber: 'ORD-test-1234',
        status: 'pending',
        totalPoisha: 7000,
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CartCheckoutController],
      providers: [
        { provide: Reflector, useValue: new Reflector() },
        { provide: CartCheckoutService, useValue: cartService },
        { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
        {
          provide: ProblemDetailsFilter,
          useFactory: (adapterHost: HttpAdapterHost) =>
            new ProblemDetailsFilter(adapterHost, logger as never),
          inject: [HttpAdapterHost],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  beforeEach(() => {
    carts.length = 0;
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a guest cart without authentication', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string; status: string };
    expect(body.id).toBe('cart-id');
    expect(body.status).toBe('active');
    expect(cartService.createCart).toHaveBeenCalledWith(undefined);
  });

  it('gets a cart without authentication', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}`);

    expect(response.status).toBe(200);
    expect(cartService.getCart).toHaveBeenCalledWith(VALID_CART_ID);
  });

  it('adds an item to a cart', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId: VALID_VARIANT_ID, quantity: 2 }),
    });

    expect(response.status).toBe(201);
    expect(cartService.addCartItem).toHaveBeenCalledWith(VALID_CART_ID, {
      variantId: VALID_VARIANT_ID,
      quantity: 2,
    });
  });

  it('updates a cart item quantity', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/items/${VALID_ITEM_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: 5 }),
    });

    expect(response.status).toBe(200);
    expect(cartService.updateCartItem).toHaveBeenCalledWith(VALID_CART_ID, VALID_ITEM_ID, {
      quantity: 5,
    });
  });

  it('removes a cart item', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/items/${VALID_ITEM_ID}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(cartService.removeCartItem).toHaveBeenCalledWith(VALID_CART_ID, VALID_ITEM_ID);
  });

  it('checks out a cart and places an order', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contactName: 'Test User',
        contactPhone: '+8801712345678',
        contactEmail: 'test@example.com',
        delivery: {
          recipientName: 'Test User',
          recipientPhone: '+8801712345678',
          line1: 'House 1, Road 1',
          district: 'Dhaka',
          division: 'Dhaka',
          countryCode: 'BD',
        },
        paymentMethod: 'cod',
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { status: string; totalPoisha: number };
    expect(body.status).toBe('pending');
    expect(body.totalPoisha).toBe(7000);
    expect(cartService.checkout).toHaveBeenCalledWith(VALID_CART_ID, expect.any(Object));
  });

  it('rejects invalid add item body', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId: 'not-a-uuid', quantity: 0 }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });

  it('rejects invalid checkout body', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/${VALID_CART_ID}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contactName: '',
        contactPhone: 'not-a-phone',
        delivery: {
          recipientName: '',
          recipientPhone: 'not-a-phone',
          line1: '',
          district: '',
          division: '',
        },
        paymentMethod: 'invalid',
      }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
  });

  it('rejects malformed cart id', async () => {
    const response = await fetch(`${baseUrl}/storefront/carts/not-a-uuid`);

    expect(response.status).toBe(400);
  });
});
