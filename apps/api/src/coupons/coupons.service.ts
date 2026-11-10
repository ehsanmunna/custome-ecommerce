import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../platform/database/prisma.service';
import type { CouponQuery, CouponInput } from './coupons.schemas';

export interface CouponResponse {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrderPoisha: number;
  startsAt: string;
  expiresAt: string;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponPage {
  items: CouponResponse[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoupons(input: CouponQuery): Promise<CouponPage> {
    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        orderBy: [{ createdAt: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.coupon.count(),
    ]);

    return {
      items: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderPoisha: c.minOrderPoisha,
        startsAt: c.startsAt.toISOString(),
        expiresAt: c.expiresAt.toISOString(),
        totalUsageLimit: c.totalUsageLimit ?? undefined,
        perCustomerLimit: c.perCustomerLimit ?? undefined,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async createCoupon(input: CouponInput): Promise<CouponResponse> {
    const existing = await this.prisma.coupon.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictException(`Coupon "${input.code}" already exists`);
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderPoisha: input.minimumOrder,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        totalUsageLimit: input.totalUsageLimit,
        perCustomerLimit: input.perCustomerUsageLimit,
        isActive: input.active,
      },
    });

    return this.toResponse(coupon);
  }

  async updateCoupon(couponId: string, input: CouponInput): Promise<CouponResponse> {
    const existing = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!existing) {
      throw new NotFoundException(`Coupon "${couponId}" not found`);
    }

    if (input.code !== existing.code) {
      const duplicate = await this.prisma.coupon.findUnique({ where: { code: input.code } });
      if (duplicate) {
        throw new ConflictException(`Coupon "${input.code}" already exists`);
      }
    }

    const coupon = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        code: input.code,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderPoisha: input.minimumOrder,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        totalUsageLimit: input.totalUsageLimit,
        perCustomerLimit: input.perCustomerUsageLimit,
        isActive: input.active,
      },
    });

    return this.toResponse(coupon);
  }

  async deleteCoupon(couponId: string): Promise<void> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true, redemptions: { select: { id: true } } },
    });
    if (!coupon) {
      throw new NotFoundException(`Coupon "${couponId}" not found`);
    }
    if (coupon.redemptions.length > 0) {
      throw new BadRequestException(`Coupon "${couponId}" has redemptions and cannot be deleted`);
    }

    await this.prisma.coupon.delete({ where: { id: couponId } });
  }

  private toResponse(coupon: any): CouponResponse {
    return {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderPoisha: coupon.minOrderPoisha,
      startsAt: coupon.startsAt.toISOString(),
      expiresAt: coupon.expiresAt.toISOString(),
      totalUsageLimit: coupon.totalUsageLimit ?? undefined,
      perCustomerLimit: coupon.perCustomerLimit ?? undefined,
      isActive: coupon.isActive,
      createdAt: coupon.createdAt.toISOString(),
      updatedAt: coupon.updatedAt.toISOString(),
    };
  }
}
