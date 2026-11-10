import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const analyticsOverviewQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .refine((data) => new Date(data.to) > new Date(data.from), {
    message: 'to must be later than from',
    path: ['to'],
  })
  .strict();

export const analyticsSalesQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    interval: z.enum(['day', 'week', 'month']).default('day'),
  })
  .refine((data) => new Date(data.to) > new Date(data.from), {
    message: 'to must be later than from',
    path: ['to'],
  })
  .strict();

export function parseAnalyticsInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid analytics request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type AnalyticsOverviewQuery = z.infer<typeof analyticsOverviewQuerySchema>;
export type AnalyticsSalesQuery = z.infer<typeof analyticsSalesQuerySchema>;
