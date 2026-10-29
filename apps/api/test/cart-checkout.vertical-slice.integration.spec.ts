import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CartCheckoutController } from '../src/cart-checkout/cart-checkout.controller';
import { CartCheckoutService } from '../src/cart-checkout/cart-checkout.service';
import { PrismaService } from '../src/platform/database/prisma.service';
import { ProblemDetailsFilter } from '../src/platform/problem-details.filter';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDatabase = hasDatabase ? describe : describe.skip;

describeDatabase('cart checkout HTTP-to-database vertical slice', () => {
  const prisma = new PrismaService();
  const suffix = randomUUID();
  const productName = `Checkout test ${suffix}`;
  const slug = `checkout-test-${suffix}`;
  const sku = `CHECKOUT-${suffix}`;
  const district = `Test-${suffix}`;
  const zoneCode = `checkout-${suffix}`;
  const createdCartIds: string[] = [];
  let categoryId: string | undefined;
  let productId: string | undefined;
  let variantId: string | undefined;
  let zoneId: string | undefined;
  let app: INestApplication | undefined;
  let baseUrl: string;

  async function createCart(): Promise<string> {
    const response = await fetch(`${baseUrl}/storefront/carts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status, await response.clone().text()).toBe(201);
    const body = (await response.json()) as { id: string; status: string; customerId: null };
    expect(body.status).toBe('active');
    expect(body.customerId).toBeNull();
    createdCartIds.push(body.id);
    return body.id;
  }

  async function addVariant(cartId: string, quantity: number): Promise<void> {
    const response = await fetch(`${baseUrl}/storefront/carts/${cartId}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId, quantity }),
    });
    expect(response.status).toBe(201);
  }

  function checkoutBody() {
    return {
      contactName: 'Checkout Test',
      contactPhone: '+8801712345678',
      contactEmail: 'checkout@example.com',
      delivery: {
        recipientName: 'Checkout Recipient',
        recipientPhone: '+8801712345678',
        line1: 'House 1, Test Road',
        district,
        division: 'Test Division',
        countryCode: 'BD',
      },
      paymentMethod: 'cod',
    };
  }

  async function checkout(cartId: string): Promise<Response> {
    return fetch(`${baseUrl}/storefront/carts/${cartId}/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(checkoutBody()),
    });
  }

  beforeAll(async () => {
    await prisma.$connect();

    const category = await prisma.category.create({
      data: {
        translations: {
          create: { locale: 'en', name: `Category ${suffix}`, slug: `category-${suffix}` },
        },
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        categoryId,
        status: 'active',
        translations: { create: { locale: 'en', name: productName, slug } },
      },
    });
    productId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku,
        pricePoisha: 2500,
        attributes: { color: 'test-blue' },
        status: 'active',
      },
    });
    variantId = variant.id;

    await prisma.inventoryItem.create({
      data: { variantId, quantityOnHand: 10, quantityReserved: 0 },
    });

    const zone = await prisma.shippingZone.create({
      data: {
        code: zoneCode,
        name: `Checkout Test Zone ${suffix}`,
        deliveryFeePoisha: 6000,
        districts: { create: { district } },
      },
    });
    zoneId = zone.id;

    const moduleRef = await Test.createTestingModule({
      controllers: [CartCheckoutController],
      providers: [
        Reflector,
        PrismaService,
        {
          provide: CartCheckoutService,
          useFactory: (database: PrismaService) => new CartCheckoutService(database),
          inject: [PrismaService],
        },
        {
          provide: APP_FILTER,
          useFactory: (adapterHost: HttpAdapterHost) =>
            new ProblemDetailsFilter(adapterHost, { error: () => undefined } as never),
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

  afterAll(async () => {
    try {
      if (createdCartIds.length > 0) {
        const orders = await prisma.order.findMany({
          where: { cartId: { in: createdCartIds } },
          select: { id: true },
        });
        if (orders.length > 0) {
          const orderIds = orders.map(({ id }) => id);
          await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
        }
        await prisma.order.deleteMany({ where: { cartId: { in: createdCartIds } } });
        await prisma.cart.deleteMany({ where: { id: { in: createdCartIds } } });
      }
      if (variantId) {
        await prisma.inventoryItem.deleteMany({ where: { variantId } });
        await prisma.productVariant.deleteMany({ where: { id: variantId } });
      }
      if (productId) {
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (categoryId) {
        await prisma.category.deleteMany({ where: { id: categoryId } });
      }
      if (zoneId) {
        await prisma.shippingZoneDistrict.deleteMany({ where: { zoneId } });
        await prisma.shippingZone.deleteMany({ where: { id: zoneId } });
      }
      expect(await prisma.cart.count({ where: { id: { in: createdCartIds } } })).toBe(0);
      expect(await prisma.productVariant.count({ where: { sku } })).toBe(0);
      expect(await prisma.shippingZone.count({ where: { code: zoneCode } })).toBe(0);
    } finally {
      try {
        await app?.close();
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  it('creates a guest cart, checks out through HTTP, and persists an immutable order snapshot', async () => {
    const cartId = await createCart();
    await addVariant(cartId, 2);

    const response = await checkout(cartId);

    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      orderId: string;
      orderNumber: string;
      status: string;
      totalPoisha: number;
    };
    expect(result).toMatchObject({
      status: 'pending',
      totalPoisha: 11_000,
    });
    expect(result.orderNumber).toMatch(/^ORD-/);

    const [order, cart] = await Promise.all([
      prisma.order.findUnique({
        where: { id: result.orderId },
        include: { items: true },
      }),
      prisma.cart.findUnique({ where: { id: cartId }, include: { items: true } }),
    ]);
    expect(order).toMatchObject({
      orderNumber: result.orderNumber,
      customerId: null,
      cartId,
      status: 'pending',
      contactName: 'Checkout Test',
      deliveryRecipientName: 'Checkout Recipient',
      deliveryDistrict: district,
      subtotalPoisha: 5000,
      discountPoisha: 0,
      deliveryFeePoisha: 6000,
      totalPoisha: 11_000,
      items: [
        {
          variantId,
          productName,
          variantSku: sku,
          attributes: { color: 'test-blue' },
          unitPricePoisha: 2500,
          quantity: 2,
          lineTotalPoisha: 5000,
        },
      ],
    });
    expect(cart).toMatchObject({ status: 'converted', items: [{ variantId, quantity: 2 }] });
  });

  it('rejects repeat checkout and rolls back insufficient-stock checkout', async () => {
    const successfulCartId = await createCart();
    await addVariant(successfulCartId, 1);
    const successfulCheckout = await checkout(successfulCartId);
    expect(successfulCheckout.status).toBe(201);
    const successfulOrder = (await successfulCheckout.json()) as { orderId: string };

    const repeatCheckout = await checkout(successfulCartId);
    expect(repeatCheckout.status).toBe(409);
    expect(repeatCheckout.headers.get('content-type')).toContain('application/problem+json');
    expect(
      await prisma.order.count({ where: { cartId: successfulCartId } }),
    ).toBe(1);

    const insufficientCartId = await createCart();
    await addVariant(insufficientCartId, 2);
    await prisma.inventoryItem.update({
      where: { variantId },
      data: { quantityOnHand: 1, quantityReserved: 0 },
    });

    const insufficientCheckout = await checkout(insufficientCartId);
    expect(insufficientCheckout.status).toBe(409);
    expect(insufficientCheckout.headers.get('content-type')).toContain(
      'application/problem+json',
    );
    expect(await prisma.order.count({ where: { cartId: insufficientCartId } })).toBe(0);
    expect(await prisma.cart.findUnique({ where: { id: insufficientCartId } })).toMatchObject({
      status: 'active',
    });

    expect(
      await prisma.order.findUnique({ where: { id: successfulOrder.orderId } }),
    ).not.toBeNull();
  });
});
