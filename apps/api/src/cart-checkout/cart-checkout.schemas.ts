import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const idSchema = z.string().uuid();

export const cartItemInputSchema = z
  .object({
    variantId: idSchema,
    quantity: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();

export const cartItemUpdateSchema = z
  .object({
    quantity: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();

const deliveryAddressSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(200),
    recipientPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).optional().nullable(),
    area: z.string().trim().max(100).optional().nullable(),
    district: z.string().trim().min(1).max(100),
    division: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().max(20).optional().nullable(),
    countryCode: z.string().length(2).regex(/^[A-Z]{2}$/).default('BD'),
  })
  .strict();

export const checkoutRequestSchema = z
  .object({
    contactName: z.string().trim().min(1).max(200),
    contactPhone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    contactEmail: z.string().email().max(200).optional().nullable(),
    delivery: deliveryAddressSchema,
    couponCode: z.string().trim().min(1).max(100).regex(/^[A-Z0-9_-]+$/).optional(),
    paymentMethod: z.enum(['cod', 'bkash', 'shurjopay']),
  })
  .strict();

export function parseCartCheckoutInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid cart checkout request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CartItemUpdate = z.infer<typeof cartItemUpdateSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;
