import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const localeSchema = z.enum(['bn', 'en']);
export type Locale = z.infer<typeof localeSchema>;

const localizedContentSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    slug: z.string().trim().min(1).max(300),
    description: z.string().max(20_000).optional(),
    shortDescription: z.string().max(2_000).optional(),
    metaTitle: z.string().max(300).optional(),
    metaDescription: z.string().max(1_000).optional(),
  })
  .strict();

export const localizedContentMapSchema = z
  .object({
    bn: localizedContentSchema.optional(),
    en: localizedContentSchema.optional(),
  })
  .strict()
  .refine((content) => content.bn !== undefined || content.en !== undefined, {
    message: 'At least one locale is required',
  });

export const categoryInputSchema = z
  .object({
    parentId: z.string().uuid().nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
    sortOrder: z.number().int().optional(),
    imageId: z.string().uuid().nullable().optional(),
    content: localizedContentMapSchema,
  })
  .strict();

export const brandInputSchema = z
  .object({
    status: z.enum(['active', 'archived']).optional(),
    imageId: z.string().uuid().nullable().optional(),
    content: localizedContentMapSchema,
  })
  .strict();

export const productInputSchema = z
  .object({
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().nullable().optional(),
    status: z.enum(['draft', 'active', 'archived']),
    content: localizedContentMapSchema,
    media: z
      .array(
        z
          .object({
            mediaId: z.string().uuid(),
            primary: z.boolean().optional(),
            sortOrder: z.number().int().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const variantInputSchema = z
  .object({
    sku: z.string().trim().min(1).max(100),
    price: z.number().int().min(0).max(2_147_483_647),
    compareAtPrice: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
    status: z.enum(['active', 'archived']).optional(),
    sortOrder: z.number().int().optional(),
    attributes: z.record(z.string(), z.unknown()),
  })
  .strict();

export const attributeDefinitionInputSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]*$/),
    valueType: z.enum(['text', 'number', 'boolean', 'select']),
    required: z.boolean(),
    filterable: z.boolean(),
    sortOrder: z.number().int(),
    options: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .refine((input) => input.valueType !== 'select' || (input.options?.length ?? 0) > 0, {
    message: 'Select definitions require at least one option',
    path: ['options'],
  })
  .refine((input) => new Set(input.options ?? []).size === (input.options ?? []).length, {
    message: 'Attribute options must be unique',
    path: ['options'],
  });

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const storefrontQuerySchema = paginationQuerySchema.extend({
  locale: localeSchema.default('bn'),
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().min(1).optional(),
  brand: z.string().trim().min(1).optional(),
});

export const localeQuerySchema = z.object({ locale: localeSchema.default('bn') }).strict();
export const localizedPaginationQuerySchema = paginationQuerySchema.extend({
  locale: localeSchema.default('bn'),
});

export const productAdminQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

export function parseCatalogInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid catalog request',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export type LocalizedContentMap = z.infer<typeof localizedContentMapSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type AttributeDefinitionInput = z.infer<typeof attributeDefinitionInputSchema>;
