import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { paginationQuerySchema } from '../catalog/catalog.schemas';

const localizedAltSchema = z
  .object({
    bn: z.string().trim().min(1).max(2_000).optional(),
    en: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const imageStorageUploadSchema = z
  .object({
    feature: z.string().trim().min(1).max(100),
    alt: localizedAltSchema.optional(),
  })
  .strict();

export const mediaListQuerySchema = paginationQuerySchema;

export function parseImageStorageInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid image storage request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export type ImageStorageUploadInput = z.infer<typeof imageStorageUploadSchema>;
export type MediaListInput = z.infer<typeof mediaListQuerySchema>;

export function parseMediaInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid media input',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}
