import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { paginationQuerySchema } from '../catalog/catalog.schemas';

const localizedAltSchema = z
  .object({
    bn: z.string().trim().min(1).max(2_000).optional(),
    en: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const mediaPaginationQuerySchema = paginationQuerySchema;

export const mediaUploadInputSchema = z
  .object({
    fileName: z.string().trim().min(1).max(300),
    mimeType: z.string().trim().min(1).max(100),
    sizeBytes: z.number().int().positive(),
    alt: localizedAltSchema.optional(),
  })
  .strict();

export const mediaCompleteInputSchema = z
  .object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict()
  .refine((input) => (input.width === undefined) === (input.height === undefined), {
    message: 'Width and height must be provided together',
    path: ['width'],
  });

export function parseMediaInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid media request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type MediaUploadInput = z.infer<typeof mediaUploadInputSchema>;
export type MediaCompleteInput = z.infer<typeof mediaCompleteInputSchema>;
