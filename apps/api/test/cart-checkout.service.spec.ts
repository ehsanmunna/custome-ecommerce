import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/platform/database/prisma.service';
import { CartCheckoutService } from '../src/cart-checkout/cart-checkout.service';
import {
  fixedDiscountPoisha,
  lineTotalPoisha,
  orderTotals,
  percentageDiscountPoisha,
} from '../src/cart-checkout/money';

function variantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'variant-id',
    productId: 'product-id',
    sku: 'SKU-001',
    pricePoisha: 1000,
    status: 'active',
    attributes: {},
    ...overrides,
  };
}

function inventoryRow(overrides: Record<string, unknown> = {}) {
  return {
    variantId: 'variant-id',
    quantityOnHand: 10,
    quantityReserved: 2,
    ...overrides,
  };
}

function cartRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cart-id',
    customerId: null,
    status: 'active',
    items: [],
    ...overrides,
  };
}

function createHarness() {
  const prisma = {
    cart: {
      create: vi.fn(async (args: { data: Record<string, any> }) => ({
        id: 'cart-id',
        ...(args.data as any),
        customerId: args.data.customerId ?? null,
        status: 'active',
        items: [],
      })),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({ id: 'cart-id', status: 'converted' })),
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
      findUnique: vi.fn(async () => variantRow()),
    },
    inventoryItem: {
      findUnique: vi.fn(async () => inventoryRow()),
    },
    order: {
      create: vi.fn(async (args: { data: Record<string, any> }) => ({
        id: 'order-id',
        orderNumber: 'ORD-1234-test',
        status: 'pending',
        totalPoisha: args.data.totalPoisha,
        ...(args.data as any),
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

  return {
    service: new CartCheckoutService(prisma as unknown as PrismaService),
    prisma,
  };
}

describe('money helpers', () => {
  it('computes line total', () => {
    expect(lineTotalPoisha(1000, 3)).toBe(3000);
  });

  it('rejects non-positive quantity for line total', () => {
    expect(() => lineTotalPoisha(1000, 0)).toThrow(BadRequestException);
  });

  it('computes percentage discount capped at subtotal', () => {
    expect(percentageDiscountPoisha(1000, 10)).toBe(100);
    expect(percentageDiscountPoisha(1000, 200)).toBe(1000);
  });

  it('computes fixed discount capped at subtotal', () => {
    expect(fixedDiscountPoisha(1000, 500)).toBe(500);
    expect(fixedDiscountPoisha(1000, 2000)).toBe(1000);
  });

  it('computes order totals', () => {
    expect(orderTotals(1000, 100, 500)).toEqual({ taxPoisha: 0, totalPoisha: 1400 });
  });

  it('rejects discount exceeding subtotal', () => {
    expect(() => orderTotals(1000, 2000, 500)).toThrow(BadRequestException);
  });
});

describe('cart creation', () => {
  it('creates a guest cart', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null);

    const cart = await service.createCart(undefined);

    expect(cart.id).toBe('cart-id');
    expect(cart.customerId).toBeNull();
    expect(cart.status).toBe('active');
    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: { customerId: undefined, status: 'active' },
      include: { items: { include: { variant: true } } },
    });
  });

  it('creates a customer cart', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null);

    const cart = await service.createCart('customer-id');

    expect(cart.customerId).toBe('customer-id');
    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: { customerId: 'customer-id', status: 'active' },
      include: { items: { include: { variant: true } } },
    });
  });
});

describe('cart retrieval', () => {
  it('returns a cart with items', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue({
      id: 'cart-id',
      customerId: null,
      status: 'active',
      items: [
        {
          id: 'item-id',
          cartId: 'cart-id',
          variantId: 'variant-id',
          quantity: 2,
          variant: variantRow(),
        },
      ],
    } as any);

    const cart = await service.getCart('cart-id');

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].unitPrice).toBe(1000);
    expect(cart.items[0].quantity).toBe(2);
  });

  it('throws not found for missing cart', async () => {
    const { service } = createHarness();

    await expect(service.getCart('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('add cart item', () => {
  it('adds a new item to an active cart', async () => {
    const { service, prisma } = createHarness();
    const existingCart = cartRow({ items: [] });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart as any);

    const cart = await service.addCartItem('cart-id', {
      variantId: 'variant-id',
      quantity: 2,
    });

    expect(cart.id).toBe('cart-id');
    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: { cartId: 'cart-id', variantId: 'variant-id', quantity: 2 },
    });
  });

  it('rejects duplicate variant', async () => {
    const { service, prisma } = createHarness();
    const existingCart = cartRow({
      items: [{ id: 'item-id', variantId: 'variant-id', quantity: 1, variant: variantRow() }],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart as any);

    await expect(
      service.addCartItem('cart-id', { variantId: 'variant-id', quantity: 1 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects inactive cart', async () => {
    const { service, prisma } = createHarness();
    const existingCart = cartRow({ status: 'converted', items: [] });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart as any);

    await expect(
      service.addCartItem('cart-id', { variantId: 'variant-id', quantity: 1 }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects missing or inactive variant', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cartRow() as any);
    vi.mocked(prisma.productVariant.findUnique).mockResolvedValue(null as any);

    await expect(
      service.addCartItem('cart-id', { variantId: 'variant-id', quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('update cart item', () => {
  it('updates item quantity', async () => {
    const { service, prisma } = createHarness();
    const existingCart = cartRow({
      items: [{ id: 'item-id', variantId: 'variant-id', quantity: 1, variant: variantRow() }],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart as any);

    const cart = await service.updateCartItem('cart-id', 'item-id', { quantity: 5 });

    expect(cart.id).toBe('cart-id');
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-id' },
      data: { quantity: 5 },
    });
  });

  it('throws not found for missing item', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cartRow({ items: [] }) as any);

    await expect(
      service.updateCartItem('cart-id', 'missing-item', { quantity: 1 }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('remove cart item', () => {
  it('removes an item from an active cart', async () => {
    const { service, prisma } = createHarness();
    const existingCart = cartRow({
      items: [{ id: 'item-id', variantId: 'variant-id', quantity: 1, variant: variantRow() }],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart as any);

    await service.removeCartItem('cart-id', 'item-id');

    expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'item-id' } });
  });

  it('throws not found for missing item', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cartRow({ items: [] }) as any);

    await expect(service.removeCartItem('cart-id', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('checkout', () => {
  it('places an order successfully', async () => {
    const { service, prisma } = createHarness();
    const variant = variantRow();
    const cart = cartRow({
      items: [
        {
          id: 'item-id',
          cartId: 'cart-id',
          variantId: 'variant-id',
          quantity: 2,
          variant: { ...variant, product: { translations: [{ locale: 'bn', name: 'ভালো পণ্য' }] } },
        },
      ],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cart as any);
    vi.mocked(prisma.productVariant.findUnique).mockResolvedValue(variant);
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      inventoryRow({ quantityOnHand: 10, quantityReserved: 2 }),
    );
    vi.mocked(prisma.shippingZoneDistrict.findUnique).mockResolvedValue({
      district: 'Dhaka',
      zone: { id: 'zone-id', deliveryFeePoisha: 5000, isActive: true },
    });
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: 'variant-id' }]);

    const result = await service.checkout('cart-id', {
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
    });

    expect(result.status).toBe('pending');
    expect(result.totalPoisha).toBe(7000); // 2 * 1000 + 5000 delivery
    expect(prisma.order.create).toHaveBeenCalled();
    expect(prisma.cart.update).toHaveBeenCalledWith({
      where: { id: 'cart-id' },
      data: { status: 'converted' },
    });
  });

  it('rejects checkout on empty cart', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cartRow({ items: [] }) as any);

    await expect(
      service.checkout('cart-id', {
        contactName: 'Test',
        contactPhone: '+8801712345678',
        delivery: {
          recipientName: 'Test',
          recipientPhone: '+8801712345678',
          line1: 'House 1',
          district: 'Dhaka',
          division: 'Dhaka',
          countryCode: 'BD',
        },
        paymentMethod: 'cod',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects checkout on insufficient stock', async () => {
    const { service, prisma } = createHarness();
    const variant = variantRow();
    const cart = cartRow({
      items: [
        {
          id: 'item-id',
          cartId: 'cart-id',
          variantId: 'variant-id',
          quantity: 20,
          variant,
        },
      ],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cart as any);
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      inventoryRow({ quantityOnHand: 5, quantityReserved: 0 }),
    );

    await expect(
      service.checkout('cart-id', {
        contactName: 'Test',
        contactPhone: '+8801712345678',
        delivery: {
          recipientName: 'Test',
          recipientPhone: '+8801712345678',
          line1: 'House 1',
          district: 'Dhaka',
          division: 'Dhaka',
          countryCode: 'BD',
        },
        paymentMethod: 'cod',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects checkout on already converted cart', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(
      cartRow({ status: 'converted', items: [] }) as any,
    );

    await expect(
      service.checkout('cart-id', {
        contactName: 'Test',
        contactPhone: '+8801712345678',
        delivery: {
          recipientName: 'Test',
          recipientPhone: '+8801712345678',
          line1: 'House 1',
          district: 'Dhaka',
          division: 'Dhaka',
          countryCode: 'BD',
        },
        paymentMethod: 'cod',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('applies percentage coupon discount', async () => {
    const { service, prisma } = createHarness();
    const variant = { ...variantRow(), product: { id: 'product-id', translations: [{ locale: 'bn', name: 'ভালো পণ্য' }] } };
    const cart = cartRow({
      items: [{ id: 'item-id', cartId: 'cart-id', variantId: 'variant-id', quantity: 1, variant }],
    });
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(cart as any);
    vi.mocked(prisma.inventoryItem.findUnique).mockResolvedValue(
      inventoryRow({ quantityOnHand: 10, quantityReserved: 0 }),
    );
    vi.mocked(prisma.shippingZoneDistrict.findUnique).mockResolvedValue({
      district: 'Dhaka',
      zone: { id: 'zone-id', deliveryFeePoisha: 5000, isActive: true },
    });
    vi.mocked(prisma.coupon.findUnique).mockResolvedValue({
      id: 'coupon-id',
      discountType: 'percentage',
      discountValue: 10,
      minOrderPoisha: 0,
      startsAt: new Date('2020-01-01'),
      expiresAt: new Date('2030-01-01'),
      totalUsageLimit: null,
      _count: { redemptions: 0 },
      isActive: true,
    } as any);

    const result = await service.checkout('cart-id', {
      contactName: 'Test',
      contactPhone: '+8801712345678',
      delivery: {
        recipientName: 'Test',
        recipientPhone: '+8801712345678',
        line1: 'House 1',
        district: 'Dhaka',
        division: 'Dhaka',
        countryCode: 'BD',
      },
      couponCode: 'SAVE10',
      paymentMethod: 'cod',
    });

    expect(result.totalPoisha).toBe(5900); // 1000 - 100 discount + 5000 delivery
    expect(prisma.couponRedemption.create).toHaveBeenCalled();
  });

  it('rejects unknown shipping district', async () => {
    const { service, prisma } = createHarness();
    vi.mocked(prisma.shippingZoneDistrict.findUnique).mockResolvedValue(null as any);

    await expect(
      service.checkout('cart-id', {
        contactName: 'Test',
        contactPhone: '+8801712345678',
        delivery: {
          recipientName: 'Test',
          recipientPhone: '+8801712345678',
          line1: 'House 1',
          district: 'Unknown',
          division: 'Unknown',
          countryCode: 'BD',
        },
        paymentMethod: 'cod',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
