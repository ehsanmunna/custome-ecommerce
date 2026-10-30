import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'partially_delivered',
]);

export const returnStatusSchema = z.enum([
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
  'cancelled',
]);

export const adminOrderQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: orderStatusSchema.optional(),
    createdFrom: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
    createdTo: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .optional(),
  })
  .strict()
  .refine(
    ({ createdFrom, createdTo }) =>
      createdFrom === undefined || createdTo === undefined || createdFrom <= createdTo,
    { message: 'createdFrom must be earlier than or equal to createdTo', path: ['createdTo'] },
  );

export const adminReturnQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const orderStatusUpdateSchema = z
  .object({
    status: orderStatusSchema,
    note: z.string().max(1000).optional(),
  })
  .strict();

export const returnStatusUpdateSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'received', 'refunded', 'cancelled']),
    note: z.string().max(1000).optional(),
  })
  .strict();

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;
export type AdminReturnQuery = z.infer<typeof adminReturnQuerySchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type ReturnStatus = z.infer<typeof returnStatusSchema>;
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>;
export type ReturnStatusUpdate = z.infer<typeof returnStatusUpdateSchema>;

export function parseOrderInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid order input',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
