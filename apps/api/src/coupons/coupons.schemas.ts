import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const couponQuerySchema = paginationSchema.strict();

export const couponInputSchema = z
  .object({
    code: z.string().trim().min(1).max(50).regex(/^[A-Z0-9_-]+$/, 'code must be uppercase alphanumeric with dashes or underscores'),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.number().int().min(1),
    minimumOrder: z.number().int().min(0),
    startsAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    expiresAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    totalUsageLimit: z.number().int().min(1).optional(),
    perCustomerUsageLimit: z.number().int().min(1).optional(),
    active: z.boolean(),
  })
  .refine((data) => data.expiresAt > data.startsAt, {
    message: 'expiresAt must be later than startsAt',
    path: ['expiresAt'],
  })
  .refine(
    (data) => {
      if (data.discountType === 'percentage') {
        return data.discountValue <= 100;
      }
      return true;
    },
    {
      message: 'discountValue for percentage must not exceed 100',
      path: ['discountValue'],
    },
  )
  .strict();

export function parseCouponInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid coupon request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type CouponQuery = z.infer<typeof couponQuerySchema>;
export type CouponInput = z.infer<typeof couponInputSchema>;
