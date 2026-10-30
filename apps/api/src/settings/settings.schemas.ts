import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const settingsQuerySchema = paginationSchema.strict();

export const settingInputSchema = z
  .object({
    key: z.string().trim().min(1),
    value: z
      .object({})
      .catchall(z.unknown())
      .refine((value) => Object.keys(value).length > 0, { message: 'value must not be empty' }),
  })
  .strict();

export const settingsUpdateSchema = z
  .object({
    settings: z.array(settingInputSchema).min(1),
  })
  .strict();

export function parseSettingsInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid settings request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type SettingsQuery = z.infer<typeof settingsQuerySchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
