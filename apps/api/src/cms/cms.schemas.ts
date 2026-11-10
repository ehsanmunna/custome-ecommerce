import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cmsPageQuerySchema = paginationSchema.strict();

export const cmsBannerQuerySchema = paginationSchema.strict();

const localeSchema = z.enum(['bn', 'en']);

const pageTranslationSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  body: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
});

export const cmsPageInputSchema = z
  .object({
    content: z.record(localeSchema, pageTranslationSchema).refine(
      (val) => Object.keys(val).length > 0,
      { message: 'content must not be empty' },
    ),
  })
  .strict();

const bannerTranslationSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().optional(),
  destinationUrl: z.string().url().optional(),
});

export const cmsBannerInputSchema = z
  .object({
    placement: z.string().trim().min(1),
    sortOrder: z.coerce.number().int().min(0).default(0),
    active: z.boolean().default(true),
    mediaId: z.string().uuid().optional(),
    content: z.record(localeSchema, bannerTranslationSchema).refine(
      (val) => Object.keys(val).length > 0,
      { message: 'content must not be empty' },
    ),
  })
  .strict();

export function parseCmsInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid CMS request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type CmsPageQuery = z.infer<typeof cmsPageQuerySchema>;
export type CmsBannerQuery = z.infer<typeof cmsBannerQuerySchema>;
export type CmsPageInput = z.infer<typeof cmsPageInputSchema>;
export type CmsBannerInput = z.infer<typeof cmsBannerInputSchema>;
