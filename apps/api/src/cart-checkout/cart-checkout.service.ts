import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import {
  lineTotalPoisha,
  orderTotals,
  percentageDiscountPoisha,
  fixedDiscountPoisha,
} from './money';
import type {
  CartItemInput,
  CartItemUpdate,
  CheckoutRequest,
} from './cart-checkout.schemas';

const ORDER_NUMBER_PREFIX = 'ORD';

type CartRow = Prisma.CartGetPayload<{
  include: {
    items: { include: { variant: { include: { product: { include: { translations: true } } } } } };
  };
}>;

export interface CartView {
  id: string;
  customerId: string | null;
  status: string;
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  status: string;
  totalPoisha: number;
}

@Injectable()
export class CartCheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createCart(customerId: string | undefined): Promise<CartView> {
    const cart = await this.prisma.cart.create({
      data: {
        customerId,
        status: 'active',
      },
      include: { items: { include: { variant: true } } },
    });
    return this.mapCart(cart);
  }

  async getCart(cartId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: { include: { variant: true } } },
    });
    if (!cart) throw new NotFoundException('Cart not found');
    return this.mapCart(cart);
  }

  async addCartItem(cartId: string, input: CartItemInput): Promise<CartView> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: { include: { variant: true } } },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      if (cart.status !== 'active') {
        throw new ConflictException('Only active carts can be modified');
      }

      const existing = cart.items.find((item) => item.variantId === input.variantId);
      if (existing) {
        throw new ConflictException('This variant is already in the cart');
      }

      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId },
      });
      if (!variant || variant.status !== 'active') {
        throw new NotFoundException('Product variant not found or unavailable');
      }

      await tx.cartItem.create({
        data: {
          cartId,
          variantId: input.variantId,
          quantity: input.quantity,
        },
      });

      const updated = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: { include: { variant: true } } },
      });
      return this.mapCart(updated!);
    });
  }

  async updateCartItem(cartId: string, itemId: string, input: CartItemUpdate): Promise<CartView> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: true },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      if (cart.status !== 'active') {
        throw new ConflictException('Only active carts can be modified');
      }

      const item = cart.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Cart item not found');

      await tx.cartItem.update({
        where: { id: itemId },
        data: { quantity: input.quantity },
      });

      const updated = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: { include: { variant: true } } },
      });
      return this.mapCart(updated!);
    });
  }

  async removeCartItem(cartId: string, itemId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: true },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      if (cart.status !== 'active') {
        throw new ConflictException('Only active carts can be modified');
      }

      const item = cart.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Cart item not found');

      await tx.cartItem.delete({ where: { id: itemId } });
    });
  }

  async checkout(cartId: string, input: CheckoutRequest): Promise<CheckoutResult> {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: {
                    include: { translations: true },
                  },
                },
              },
            },
          },
        },
      });
      if (!cart) throw new NotFoundException('Cart not found');
      if (cart.status !== 'active') {
        throw new ConflictException('Cart is not active');
      }
      if (cart.items.length === 0) {
        throw new BadRequestException('Cannot checkout an empty cart');
      }

      await this.lockVariantRows(tx, cart.items.map((item) => item.variantId));

      const orderItems: Array<{
        variantId: string;
        productName: string;
        variantSku: string;
        attributes: unknown;
        unitPricePoisha: number;
        quantity: number;
        lineTotalPoisha: number;
      }> = [];
      let subtotalPoisha = 0;

      for (const item of cart.items) {
        const variant = item.variant;
        if (!variant || variant.status !== 'active') {
          throw new NotFoundException(`Product variant ${item.variantId} is unavailable`);
        }

        await this.assertStockAvailable(tx, variant.id, item.quantity);

        const unitPrice = variant.pricePoisha;
        const lineTotal = lineTotalPoisha(unitPrice, item.quantity);
        subtotalPoisha += lineTotal;

        orderItems.push({
          variantId: variant.id,
          productName:
            variant.product.translations.find((t) => t.locale === 'bn')?.name ??
            variant.product.translations.find((t) => t.locale === 'en')?.name ??
            variant.sku,
          variantSku: variant.sku,
          attributes: variant.attributes,
          unitPricePoisha: unitPrice,
          quantity: item.quantity,
          lineTotalPoisha: lineTotal,
        });
      }

      const zone = await this.resolveShippingZone(tx, input.delivery.district);
      const deliveryFeePoisha = zone.deliveryFeePoisha;

      let discountPoisha = 0;
      let couponId: string | undefined;
      if (input.couponCode) {
        const coupon = await this.validateCoupon(tx, input.couponCode, subtotalPoisha);
        couponId = coupon.id;
        if (coupon.discountType === 'percentage') {
          discountPoisha = percentageDiscountPoisha(subtotalPoisha, coupon.discountValue);
        } else {
          discountPoisha = fixedDiscountPoisha(subtotalPoisha, coupon.discountValue);
        }
      }

      const { taxPoisha, totalPoisha } = orderTotals(
        subtotalPoisha,
        discountPoisha,
        deliveryFeePoisha,
      );

      const orderNumber = this.generateOrderNumber();

      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: cart.customerId,
          cartId: cart.id,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          contactEmail: input.contactEmail ?? null,
          deliveryRecipientName: input.delivery.recipientName,
          deliveryRecipientPhone: input.delivery.recipientPhone,
          deliveryAddressLine1: input.delivery.line1,
          deliveryAddressLine2: input.delivery.line2 ?? null,
          deliveryArea: input.delivery.area ?? null,
          deliveryDistrict: input.delivery.district,
          deliveryDivision: input.delivery.division,
          deliveryPostalCode: input.delivery.postalCode ?? null,
          deliveryCountryCode: input.delivery.countryCode,
          shippingZoneId: zone.id,
          deliveryFeePoisha,
          couponId,
          status: 'pending',
          subtotalPoisha,
          discountPoisha,
          taxPoisha,
          totalPoisha,
          items: {
            create: orderItems.map((item) => ({
              variant: { connect: { id: item.variantId } },
              productName: item.productName,
              variantSku: item.variantSku,
              attributes: item.attributes as Prisma.InputJsonValue,
              unitPricePoisha: item.unitPricePoisha,
              quantity: item.quantity,
              lineTotalPoisha: item.lineTotalPoisha,
            })),
          },
        },
      });

      if (couponId) {
        await tx.couponRedemption.create({
          data: {
            couponId,
            orderId: order.id,
            customerId: cart.customerId ?? null,
            discountPoisha,
          },
        });
      }

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: 'converted' },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalPoisha: order.totalPoisha,
      };
    });
  }

  private mapCart(cart: CartRow): CartView {
    return {
      id: cart.id,
      customerId: cart.customerId,
      status: cart.status,
      items: cart.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.variant.pricePoisha,
      })),
    };
  }

  private async lockVariantRows(tx: Prisma.TransactionClient, variantIds: string[]): Promise<void> {
    for (const variantId of variantIds) {
      const variants = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM product_variants WHERE id = ${variantId}::uuid FOR UPDATE
      `);
      if (variants.length === 0) {
        throw new NotFoundException(`Product variant ${variantId} not found`);
      }
    }
  }

  private async assertStockAvailable(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    const inventory = await tx.inventoryItem.findUnique({
      where: { variantId },
    });
    const available = inventory
      ? inventory.quantityOnHand - inventory.quantityReserved
      : 0;
    if (available < quantity) {
      throw new ConflictException(`Insufficient stock for variant ${variantId}`);
    }
  }

  private async resolveShippingZone(
    tx: Prisma.TransactionClient,
    district: string,
  ): Promise<{ id: string; deliveryFeePoisha: number }> {
    const districtRow = await tx.shippingZoneDistrict.findUnique({
      where: { district },
      include: { zone: true },
    });
    if (!districtRow || !districtRow.zone.isActive) {
      throw new NotFoundException(`No active shipping zone for district ${district}`);
    }
    return {
      id: districtRow.zone.id,
      deliveryFeePoisha: districtRow.zone.deliveryFeePoisha,
    };
  }

  private async validateCoupon(
    tx: Prisma.TransactionClient,
    code: string,
    subtotalPoisha: number,
  ): Promise<{
    id: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  }> {
    const now = new Date();
    const coupon = await tx.coupon.findUnique({
      where: { code },
      include: {
        _count: { select: { redemptions: true } },
      },
    });
    if (!coupon || !coupon.isActive) {
      throw new NotFoundException('Coupon not found or inactive');
    }
    if (now < coupon.startsAt || now > coupon.expiresAt) {
      throw new ConflictException('Coupon is not currently valid');
    }
    if (subtotalPoisha < coupon.minOrderPoisha) {
      throw new ConflictException('Order subtotal is below the coupon minimum');
    }
    if (coupon.totalUsageLimit !== null && coupon._count.redemptions >= coupon.totalUsageLimit) {
      throw new ConflictException('Coupon usage limit has been reached');
    }
    return {
      id: coupon.id,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    };
  }

  private generateOrderNumber(): string {
    return `${ORDER_NUMBER_PREFIX}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }
}
