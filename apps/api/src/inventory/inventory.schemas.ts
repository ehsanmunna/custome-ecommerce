import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const inventoryQuerySchema = paginationSchema
  .extend({
    lowStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

export const reservationQuerySchema = paginationSchema
  .extend({
    status: z.enum(['active', 'released', 'committed', 'expired']).optional(),
  })
  .strict();

export const inventoryAdjustmentSchema = z
  .object({
    quantityDelta: z
      .number()
      .int()
      .min(-2_147_483_648)
      .max(2_147_483_647)
      .refine((value) => value !== 0),
    reason: z.string().trim().min(1).max(500),
    lowStockThreshold: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict();

export const reservationInputSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(2_147_483_647),
    expiresAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
  })
  .strict();

export const reservationStatusSchema = z
  .object({
    status: z.enum(['released', 'committed']),
  })
  .strict();

export function parseInventoryInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid inventory request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type InventoryQuery = z.infer<typeof inventoryQuerySchema>;
export type ReservationQuery = z.infer<typeof reservationQuerySchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type ReservationInput = z.infer<typeof reservationInputSchema>;
export type ReservationStatusInput = z.infer<typeof reservationStatusSchema>;
