import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type {
  AttributeDefinitionInput,
  BrandInput,
  CategoryInput,
  Locale,
  LocalizedContentMap,
  ProductInput,
  VariantInput,
} from './catalog.schemas';

const categoryInclude = {
  translations: true,
  imageMedia: { include: { altTexts: true } },
} satisfies Prisma.CategoryInclude;

const brandInclude = {
  translations: true,
  imageMedia: { include: { altTexts: true } },
} satisfies Prisma.BrandInclude;

const productInclude = {
  translations: true,
  variants: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  media: {
    orderBy: [{ sortOrder: 'asc' }, { mediaId: 'asc' }],
    include: { media: { include: { altTexts: true } } },
  },
} satisfies Prisma.ProductInclude;

const productDetailInclude = {
  ...productInclude,
  category: { include: { translations: true } },
  brand: { include: { translations: true } },
} satisfies Prisma.ProductInclude;

type CategoryRecord = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;
type BrandRecord = Prisma.BrandGetPayload<{ include: typeof brandInclude }>;
type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export interface CatalogPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CatalogTranslation {
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface CatalogMedia {
  id: string;
  provider: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  createdAt: string;
  alt: Record<string, string>;
}

export interface CatalogCategory {
  id: string;
  parentId?: string;
  status: 'active' | 'archived';
  sortOrder: number;
  content: Record<string, CatalogTranslation>;
  imageId?: string;
}

export interface CatalogBrand {
  id: string;
  status: 'active' | 'archived';
  content: Record<string, CatalogTranslation>;
  image?: CatalogMedia;
}

export interface CatalogVariant {
  id: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  status: 'active' | 'archived';
  sortOrder: number;
  attributes: Prisma.JsonValue;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  brandId?: string;
  status: 'draft' | 'active' | 'archived';
  content: Record<string, CatalogTranslation>;
  variants: CatalogVariant[];
  media: CatalogMedia[];
}

export interface CatalogAttributeDefinition {
  key: string;
  valueType: string;
  required: boolean;
  filterable: boolean;
  sortOrder: number;
  options: string[];
}

interface PageInput {
  page: number;
  pageSize: number;
}

interface ProductFilter {
  locale: Locale;
  q?: string;
  category?: string;
  brand?: string;
  status?: 'draft' | 'active' | 'archived';
  publicOnly?: boolean;
}

function pageResult<T>(items: T[], total: number, { page, pageSize }: PageInput): CatalogPage<T> {
  return { items, total, page, pageSize };
}

function translationsMap(
  rows: Array<{
    locale: string;
    name: string;
    slug: string;
    metaTitle: string | null;
    metaDescription: string | null;
    description?: string | null;
    shortDescription?: string | null;
  }>,
): Record<string, CatalogTranslation> {
  return Object.fromEntries(
    rows.map((row) => [
      row.locale,
      {
        name: row.name,
        slug: row.slug,
        ...(row.description !== undefined && row.description !== null
          ? { description: row.description }
          : {}),
        ...(row.shortDescription !== undefined && row.shortDescription !== null
          ? { shortDescription: row.shortDescription }
          : {}),
        ...(row.metaTitle !== null ? { metaTitle: row.metaTitle } : {}),
        ...(row.metaDescription !== null ? { metaDescription: row.metaDescription } : {}),
      },
    ]),
  );
}

function mapMedia(
  media: {
    id: string;
    provider: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: bigint;
    width: number | null;
    height: number | null;
    createdAt: Date;
    altTexts: Array<{ locale: string; altText: string }>;
  } | null,
): CatalogMedia | undefined {
  if (!media) return undefined;
  const sizeBytes = Number(media.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes)) {
    throw new Error('Media size exceeds the safe JSON integer range');
  }

  return {
    id: media.id,
    provider: media.provider,
    key: media.storageKey,
    mimeType: media.mimeType,
    sizeBytes,
    ...(media.width !== null ? { width: media.width } : {}),
    ...(media.height !== null ? { height: media.height } : {}),
    createdAt: media.createdAt.toISOString(),
    alt: Object.fromEntries(media.altTexts.map(({ locale, altText }) => [locale, altText])),
  };
}

function mapCategory(record: CategoryRecord): CatalogCategory {
  return {
    id: record.id,
    ...(record.parentId ? { parentId: record.parentId } : {}),
    status: record.status,
    sortOrder: record.sortOrder,
    content: translationsMap(record.translations),
    ...(record.imageMediaId ? { imageId: record.imageMediaId } : {}),
  };
}

function mapBrand(record: BrandRecord): CatalogBrand {
  return {
    id: record.id,
    status: record.status,
    content: translationsMap(record.translations),
    ...(record.imageMedia ? { image: mapMedia(record.imageMedia) } : {}),
  };
}

function mapVariant(variant: Prisma.ProductVariantGetPayload<object>): CatalogVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    price: variant.pricePoisha,
    compareAtPrice: variant.compareAtPricePoisha,
    status: variant.status,
    sortOrder: variant.sortOrder,
    attributes: variant.attributes,
  };
}

function mapProduct(record: ProductRecord, publicOnly = false): CatalogProduct {
  return {
    id: record.id,
    categoryId: record.categoryId,
    ...(record.brandId ? { brandId: record.brandId } : {}),
    status: record.status,
    content: translationsMap(record.translations),
    variants: record.variants
      .filter((variant) => !publicOnly || variant.status === 'active')
      .map(mapVariant),
    media: record.media.map(({ media }) => mapMedia(media)).filter((media) => media !== undefined),
  };
}

function translationData(content: LocalizedContentMap) {
  return (['bn', 'en'] as const).flatMap((locale) => {
    const value = content[locale];
    return value
      ? [
          {
            locale,
            name: value.name,
            slug: value.slug,
            ...(value.description !== undefined ? { description: value.description } : {}),
            ...(value.shortDescription !== undefined
              ? { shortDescription: value.shortDescription }
              : {}),
            ...(value.metaTitle !== undefined ? { metaTitle: value.metaTitle } : {}),
            ...(value.metaDescription !== undefined
              ? { metaDescription: value.metaDescription }
              : {}),
          },
        ]
      : [];
  });
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async storefrontCategories(input: PageInput): Promise<CatalogPage<CatalogCategory>> {
    const where: Prisma.CategoryWhereInput = { status: 'active' };
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: categoryInclude,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);
    return pageResult(rows.map(mapCategory), total, input);
  }

  async storefrontBrands(input: PageInput): Promise<CatalogPage<CatalogBrand>> {
    const where: Prisma.BrandWhereInput = { status: 'active' };
    const [rows, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        include: brandInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.brand.count({ where }),
    ]);
    return pageResult(rows.map(mapBrand), total, input);
  }

  async storefrontProducts(input: PageInput & ProductFilter): Promise<CatalogPage<CatalogProduct>> {
    const where = this.productWhere({ ...input, publicOnly: true });
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(
      rows.map((row) => mapProduct(row, true)),
      total,
      input,
    );
  }

  async storefrontProductsByCategory(
    slug: string,
    locale: Locale,
    input: PageInput,
  ): Promise<CatalogPage<CatalogProduct>> {
    const category = await this.prisma.category.findFirst({
      where: {
        status: 'active',
        translations: { some: { locale, slug } },
      },
      select: { id: true },
    });
    if (!category) return pageResult([], 0, input);

    const where: Prisma.ProductWhereInput = {
      ...this.productWhere({ locale, publicOnly: true }),
      categoryId: category.id,
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(
      rows.map((row) => mapProduct(row, true)),
      total,
      input,
    );
  }

  async storefrontProduct(slug: string, locale: Locale): Promise<CatalogProduct> {
    const record = await this.prisma.product.findFirst({
      where: {
        translations: { some: { locale, slug } },
        ...this.productWhere({ locale, publicOnly: true }),
      },
      include: productDetailInclude,
    });
    if (!record) throw new NotFoundException('Product not found');
    return mapProduct(record, true);
  }

  async storefrontBrand(slug: string, locale: Locale): Promise<CatalogBrand> {
    const record = await this.prisma.brand.findFirst({
      where: { status: 'active', translations: { some: { locale, slug } } },
      include: brandInclude,
    });
    if (!record) throw new NotFoundException('Brand not found');
    return mapBrand(record);
  }

  async adminBrands(input: PageInput): Promise<CatalogPage<CatalogBrand>> {
    const where: Prisma.BrandWhereInput = {};
    const [rows, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        include: brandInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.brand.count({ where }),
    ]);
    return pageResult(rows.map(mapBrand), total, input);
  }

  async createBrand(input: BrandInput): Promise<CatalogBrand> {
    try {
      const record = await this.prisma.brand.create({
        data: {
          status: input.status ?? 'active',
          imageMediaId: input.imageId,
          translations: { create: translationData(input.content) },
        },
        include: brandInclude,
      });
      return mapBrand(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async updateBrand(id: string, input: BrandInput): Promise<CatalogBrand> {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.brand.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new NotFoundException('Brand not found');
        for (const translation of translationData(input.content)) {
          await tx.brandTranslation.upsert({
            where: { brandId_locale: { brandId: id, locale: translation.locale } },
            create: { ...translation, brandId: id },
            update: {
              name: translation.name,
              slug: translation.slug,
              ...(translation.description !== undefined
                ? { description: translation.description }
                : {}),
              metaTitle: translation.metaTitle,
              metaDescription: translation.metaDescription,
            },
          });
        }
        return tx.brand.update({
          where: { id },
          data: {
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.imageId !== undefined ? { imageMediaId: input.imageId } : {}),
          },
          include: brandInclude,
        });
      });
      return mapBrand(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async deleteBrand(id: string): Promise<void> {
    try {
      await this.prisma.brand.delete({ where: { id } });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async adminCategories(input: PageInput): Promise<CatalogPage<CatalogCategory>> {
    const where: Prisma.CategoryWhereInput = {};
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: categoryInclude,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);
    return pageResult(rows.map(mapCategory), total, input);
  }

  async createCategory(input: CategoryInput): Promise<CatalogCategory> {
    if (input.parentId) await this.assertCategoryParent(input.parentId);
    try {
      const record = await this.prisma.category.create({
        data: {
          parentId: input.parentId,
          imageMediaId: input.imageId,
          status: input.status ?? 'active',
          sortOrder: input.sortOrder ?? 0,
          translations: { create: translationData(input.content) },
        },
        include: categoryInclude,
      });
      return mapCategory(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async updateCategory(id: string, input: CategoryInput): Promise<CatalogCategory> {
    if (input.parentId) await this.assertCategoryParent(input.parentId, id);
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.category.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new NotFoundException('Category not found');
        for (const translation of translationData(input.content)) {
          await tx.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: id, locale: translation.locale } },
            create: { ...translation, categoryId: id },
            update: {
              name: translation.name,
              slug: translation.slug,
              ...(translation.description !== undefined
                ? { description: translation.description }
                : {}),
              metaTitle: translation.metaTitle,
              metaDescription: translation.metaDescription,
            },
          });
        }
        return tx.category.update({
          where: { id },
          data: {
            ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
            ...(input.imageId !== undefined ? { imageMediaId: input.imageId } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          },
          include: categoryInclude,
        });
      });
      return mapCategory(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async categoryAttributes(
    id: string,
    input: PageInput,
  ): Promise<CatalogPage<CatalogAttributeDefinition>> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundException('Category not found');
    const where: Prisma.AttributeDefinitionWhereInput = { categoryId: id };
    const [rows, total] = await Promise.all([
      this.prisma.attributeDefinition.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.attributeDefinition.count({ where }),
    ]);
    return pageResult(
      rows.map((row) => this.mapAttributeDefinition(row)),
      total,
      input,
    );
  }

  async createCategoryAttribute(
    id: string,
    input: AttributeDefinitionInput,
  ): Promise<CatalogAttributeDefinition> {
    const category = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) throw new NotFoundException('Category not found');
    try {
      const row = await this.prisma.attributeDefinition.create({
        data: {
          categoryId: id,
          attributeKey: input.key,
          valueType: input.valueType,
          isRequired: input.required,
          isFilterable: input.filterable,
          sortOrder: input.sortOrder,
          options: input.options ?? [],
        },
      });
      return this.mapAttributeDefinition(row);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async adminProducts(input: PageInput & ProductFilter): Promise<CatalogPage<CatalogProduct>> {
    const where = this.productWhere(input);
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return pageResult(
      rows.map((row) => mapProduct(row)),
      total,
      input,
    );
  }

  async adminProduct(id: string): Promise<CatalogProduct> {
    const record = await this.prisma.product.findUnique({
      where: { id },
      include: productDetailInclude,
    });
    if (!record) throw new NotFoundException('Product not found');
    return mapProduct(record);
  }

  async createProduct(input: ProductInput): Promise<CatalogProduct> {
    await this.assertProductReferences(input);
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            categoryId: input.categoryId,
            brandId: input.brandId,
            status: input.status,
            translations: { create: translationData(input.content) },
          },
          select: { id: true },
        });
        if (input.media !== undefined) await this.replaceProductMedia(tx, created.id, input.media);
        return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: productInclude });
      });
      return mapProduct(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async updateProduct(id: string, input: ProductInput): Promise<CatalogProduct> {
    await this.assertProductReferences(input);
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.product.findUnique({
          where: { id },
          include: { variants: true },
        });
        if (!existing) throw new NotFoundException('Product not found');
        if (existing.categoryId !== input.categoryId) {
          const definitions = await tx.attributeDefinition.findMany({
            where: { categoryId: input.categoryId },
          });
          for (const variant of existing.variants) {
            this.validateAttributes(variant.attributes, definitions);
          }
        }
        for (const translation of translationData(input.content)) {
          await tx.productTranslation.upsert({
            where: { productId_locale: { productId: id, locale: translation.locale } },
            create: { ...translation, productId: id },
            update: {
              name: translation.name,
              slug: translation.slug,
              description: translation.description,
              shortDescription: translation.shortDescription,
              metaTitle: translation.metaTitle,
              metaDescription: translation.metaDescription,
            },
          });
        }
        await tx.product.update({
          where: { id },
          data: {
            categoryId: input.categoryId,
            brandId: input.brandId,
            status: input.status,
          },
        });
        if (input.media !== undefined) await this.replaceProductMedia(tx, id, input.media);
        return tx.product.findUniqueOrThrow({ where: { id }, include: productInclude });
      });
      return mapProduct(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async createVariant(productId: string, input: VariantInput): Promise<CatalogVariant> {
    const categoryId = await this.productCategoryId(productId);
    await this.validateVariantAttributes(categoryId, input.attributes);
    try {
      const record = await this.prisma.productVariant.create({
        data: {
          productId,
          sku: input.sku,
          pricePoisha: input.price,
          compareAtPricePoisha: input.compareAtPrice,
          status: input.status ?? 'active',
          sortOrder: input.sortOrder ?? 0,
          attributes: input.attributes as Prisma.InputJsonObject,
        },
      });
      return mapVariant(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async updateVariant(id: string, input: VariantInput): Promise<CatalogVariant> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!existing) throw new NotFoundException('Variant not found');
    const categoryId = await this.productCategoryId(existing.productId);
    await this.validateVariantAttributes(categoryId, input.attributes);
    try {
      const record = await this.prisma.productVariant.update({
        where: { id },
        data: {
          sku: input.sku,
          pricePoisha: input.price,
          compareAtPricePoisha: input.compareAtPrice,
          status: input.status,
          sortOrder: input.sortOrder,
          attributes: input.attributes as Prisma.InputJsonObject,
        },
      });
      return mapVariant(record);
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  async deleteVariant(id: string): Promise<void> {
    try {
      await this.prisma.productVariant.delete({ where: { id } });
    } catch (error) {
      this.mapWriteError(error);
    }
  }

  private productWhere(filter: ProductFilter): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.publicOnly
        ? {
            status: 'active',
            category: { status: 'active' },
            OR: [{ brandId: null }, { brand: { status: 'active' } }],
          }
        : {}),
      ...(filter.category
        ? {
            category: {
              status: 'active',
              translations: { some: { locale: filter.locale, slug: filter.category } },
            },
          }
        : {}),
      ...(filter.brand
        ? {
            brand: {
              status: 'active',
              translations: { some: { locale: filter.locale, slug: filter.brand } },
            },
          }
        : {}),
      ...(filter.q
        ? {
            translations: {
              some: {
                locale: filter.locale,
                OR: [
                  { name: { contains: filter.q, mode: 'insensitive' } },
                  { description: { contains: filter.q, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    };
    return where;
  }

  private async assertCategoryParent(parentId: string, categoryId?: string) {
    let currentId: string | null = parentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new BadRequestException('Category parent would create a hierarchy cycle');
      }
      visited.add(currentId);
      const parent: { id: string; parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { id: true, parentId: true },
        });
      if (!parent) throw new NotFoundException('Parent category not found');
      currentId = parent.parentId;
    }
  }

  private async assertProductReferences(input: ProductInput) {
    const [category, brand, mediaIds] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      input.brandId
        ? this.prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })
        : Promise.resolve(true),
      input.media?.length
        ? this.prisma.mediaAsset.findMany({
            where: { id: { in: input.media.map(({ mediaId }) => mediaId) } },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    if (!category) throw new NotFoundException('Category not found');
    if (!brand) throw new NotFoundException('Brand not found');
    if (
      input.media &&
      mediaIds.length !== new Set(input.media.map(({ mediaId }) => mediaId)).size
    ) {
      throw new NotFoundException('Media asset not found');
    }
    if (
      input.media?.filter(({ primary }) => primary).length &&
      input.media.filter(({ primary }) => primary).length !== 1
    ) {
      throw new BadRequestException('At most one product media item can be primary');
    }
  }

  private async replaceProductMedia(
    tx: Prisma.TransactionClient,
    productId: string,
    media: NonNullable<ProductInput['media']>,
  ) {
    await tx.productMedia.deleteMany({ where: { productId } });
    if (media.length) {
      await tx.productMedia.createMany({
        data: media.map(({ mediaId, primary, sortOrder }, index) => ({
          productId,
          mediaId,
          isPrimary: primary ?? false,
          sortOrder: sortOrder ?? index,
        })),
      });
    }
  }

  private async productCategoryId(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product.categoryId;
  }

  private async validateVariantAttributes(categoryId: string, attributes: Record<string, unknown>) {
    const definitions = await this.prisma.attributeDefinition.findMany({ where: { categoryId } });
    this.validateAttributes(attributes, definitions);
  }

  private validateAttributes(
    attributes: Prisma.JsonValue | Record<string, unknown>,
    definitions: Array<{
      attributeKey: string;
      valueType: string;
      isRequired: boolean;
      options: string[];
    }>,
  ) {
    if (attributes === null || Array.isArray(attributes) || typeof attributes !== 'object') {
      throw new BadRequestException('Variant attributes must be an object');
    }
    const values = attributes as Record<string, unknown>;
    const definitionsByKey = new Map(
      definitions.map((definition) => [definition.attributeKey, definition]),
    );
    for (const [key, value] of Object.entries(values)) {
      const definition = definitionsByKey.get(key);
      if (!definition) throw new BadRequestException(`Unknown variant attribute: ${key}`);
      const valid =
        (definition.valueType === 'text' && typeof value === 'string') ||
        (definition.valueType === 'number' &&
          typeof value === 'number' &&
          Number.isFinite(value)) ||
        (definition.valueType === 'boolean' && typeof value === 'boolean') ||
        (definition.valueType === 'select' &&
          typeof value === 'string' &&
          definition.options.includes(value));
      if (!valid) throw new BadRequestException(`Invalid value for variant attribute: ${key}`);
    }
    for (const definition of definitions) {
      if (definition.isRequired && !(definition.attributeKey in values)) {
        throw new BadRequestException(
          `Required variant attribute is missing: ${definition.attributeKey}`,
        );
      }
    }
  }

  private mapAttributeDefinition(row: {
    attributeKey: string;
    valueType: string;
    isRequired: boolean;
    isFilterable: boolean;
    sortOrder: number;
    options: string[];
  }): CatalogAttributeDefinition {
    return {
      key: row.attributeKey,
      valueType: row.valueType,
      required: row.isRequired,
      filterable: row.isFilterable,
      sortOrder: row.sortOrder,
      options: row.options,
    };
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Catalog value already exists');
      if (error.code === 'P2003') throw new ConflictException('Catalog record is still referenced');
      if (error.code === 'P2025') throw new NotFoundException('Catalog record not found');
    }
    throw error;
  }
}
