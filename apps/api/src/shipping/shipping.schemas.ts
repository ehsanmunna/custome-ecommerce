import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const createParcelInputSchema = z.object({
  orderId: z.string().uuid('orderId must be a valid UUID'),
  customerName: z.string().trim().min(1, 'customerName is required'),
  customerPhone: z.string().trim().min(1, 'customerPhone is required'),
  customerAddress: z.string().trim().min(1, 'customerAddress is required'),
  customerCity: z.string().trim().min(1, 'customerCity is required'),
  codAmountPoisha: z.coerce
    .number()
    .int('codAmountPoisha must be an integer')
    .min(0, 'codAmountPoisha must not be negative'),
  itemName: z.string().trim().min(1, 'itemName is required'),
  itemQuantity: z.coerce
    .number()
    .int('itemQuantity must be an integer')
    .min(1, 'itemQuantity must be at least 1'),
  itemWeightGram: z.coerce
    .number()
    .int('itemWeightGram must be an integer')
    .min(1, 'itemWeightGram must be at least 1')
    .optional(),
});

export type CreateParcelInput = z.infer<typeof createParcelInputSchema>;

export const steadfastWebhookSchema = z.object({
  tracking_number: z.string().trim().min(1),
  status: z.string().trim().min(1),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  note: z.string().optional(),
});

export type SteadfastWebhookPayload = z.infer<typeof steadfastWebhookSchema>;

export const shippingZoneQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const shippingZoneInputSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(100),
    fee: z.number().int().min(0),
    active: z.boolean(),
  })
  .strict();

export const districtsInputSchema = z
  .object({
    districts: z.array(z.string().trim().min(1)),
  })
  .strict();

export function parseCreateParcelInput(input: unknown): CreateParcelInput {
  return createParcelInputSchema.parse(input);
}

export function parseSteadfastWebhook(input: unknown): SteadfastWebhookPayload {
  return steadfastWebhookSchema.parse(input);
}

export function parseShippingZoneInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid shipping zone request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type ShippingZoneQuery = z.infer<typeof shippingZoneQuerySchema>;
export type ShippingZoneInput = z.infer<typeof shippingZoneInputSchema>;
export type DistrictsInput = z.infer<typeof districtsInputSchema>;
