import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'database';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/platform/database/prisma.service';
import { CatalogService } from '../src/catalog/catalog.service';
import { attributeDefinitionInputSchema } from '../src/catalog/catalog.schemas';

function createHarness() {
  const tx = {
    brand: {
      findUnique: vi.fn(async () => ({ id: 'brand-id' })),
      update: vi.fn(async () => ({
        id: 'brand-id',
        status: 'active',
        translations: [
          {
            locale: 'bn',
            name: 'Brand',
            slug: 'brand',
            description: 'Localized brand description',
            metaTitle: null,
            metaDescription: null,
          },
        ],
        imageMedia: null,
      })),
    },
    brandTranslation: { upsert: vi.fn(async () => undefined) },
    category: {
      findUnique: vi.fn(async () => ({ id: 'category-id' })),
      update: vi.fn(),
    },
    categoryTranslation: { upsert: vi.fn(async () => undefined) },
    product: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(async () => ({ id: 'product-id' })),
      update: vi.fn(),
    },
    productTranslation: { upsert: vi.fn(async () => undefined) },
    productVariant: { findUnique: vi.fn(), update: vi.fn() },
    productMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
    attributeDefinition: { findMany: vi.fn(async () => []) },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    category: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    brand: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    product: {
      findMany: vi.fn(async (_args: { where?: Record<string, unknown> }) => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    brandTranslation: { upsert: vi.fn() },
    categoryTranslation: { upsert: vi.fn() },
    productTranslation: { upsert: vi.fn() },
    productVariant: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
    attributeDefinition: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(async () => 0),
    },
    mediaAsset: { findMany: vi.fn(async () => []) },
    tx,
  };

  return {
    service: new CatalogService(prisma as unknown as PrismaService),
    prisma,
    tx,
  };
}

describe('catalog service', () => {
  it('lists only active categories in stable order with paginated query parameters', async () => {
    const { service, prisma } = createHarness();

    const result = await service.storefrontCategories({ page: 2, pageSize: 10 });

    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      }),
    );
  });

  it('lists only active brands in deterministic order', async () => {
    const { service, prisma } = createHarness();

    await service.storefrontBrands({ page: 1, pageSize: 20 });

    expect(prisma.brand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active' },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
  });

  it('applies active visibility and localized substring and slug filters to public product search', async () => {
    const { service, prisma } = createHarness();

    await service.storefrontProducts({
      page: 1,
      pageSize: 20,
      locale: 'en',
      q: 'shirt',
      category: 'tops',
      brand: 'acme',
    });

    const where = prisma.product.findMany.mock.calls[0]?.[0].where ?? {};
    expect(where).toMatchObject({
      status: 'active',
      category: {
        status: 'active',
        translations: { some: { locale: 'en', slug: 'tops' } },
      },
      brand: {
        status: 'active',
        translations: { some: { locale: 'en', slug: 'acme' } },
      },
      translations: {
        some: {
          locale: 'en',
          OR: [
            { name: { contains: 'shirt', mode: 'insensitive' } },
            { description: { contains: 'shirt', mode: 'insensitive' } },
          ],
        },
      },
    });
    expect(where.OR).toEqual([{ brandId: null }, { brand: { status: 'active' } }]);
  });

  it('returns not found rather than falling back when a product translation is missing', async () => {
    const { service } = createHarness();

    await expect(service.storefrontProduct('shirt', 'en')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns an empty page for an unknown category slug', async () => {
    const { service, prisma } = createHarness();

    const result = await service.storefrontProductsByCategory('unknown', 'en', {
      page: 1,
      pageSize: 20,
    });

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(prisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        status: 'active',
        translations: { some: { locale: 'en', slug: 'unknown' } },
      },
      select: { id: true },
    });
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('returns only active variants and maps media without exposing database fields', async () => {
    const { service, prisma } = createHarness();
    prisma.product.findFirst.mockResolvedValue({
      id: 'product-id',
      categoryId: 'category-id',
      brandId: null,
      status: 'active',
      translations: [
        {
          locale: 'en',
          name: 'Shirt',
          slug: 'shirt',
          description: 'Cotton shirt',
          shortDescription: null,
          metaTitle: null,
          metaDescription: null,
        },
      ],
      variants: [
        {
          id: 'active-variant',
          sku: 'SKU-1',
          pricePoisha: 1200,
          compareAtPricePoisha: null,
          status: 'active',
          sortOrder: 0,
          attributes: { color: 'blue' },
        },
        {
          id: 'archived-variant',
          sku: 'SKU-2',
          pricePoisha: 1300,
          compareAtPricePoisha: null,
          status: 'archived',
          sortOrder: 1,
          attributes: {},
        },
      ],
      media: [
        {
          media: {
            id: 'media-id',
            provider: 'r2',
            storageKey: 'catalog/shirt.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 10n,
            width: null,
            height: null,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            altTexts: [{ locale: 'en', altText: 'Blue shirt' }],
          },
        },
      ],
    } as never);

    const product = await service.storefrontProduct('shirt', 'en');

    expect(product.variants).toHaveLength(1);
    expect(product.variants[0]?.id).toBe('active-variant');
    expect(product.media).toEqual([
      {
        id: 'media-id',
        provider: 'r2',
        key: 'catalog/shirt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        createdAt: '2025-01-01T00:00:00.000Z',
        alt: { en: 'Blue shirt' },
      },
    ]);
    expect(product).not.toHaveProperty('stock');
    expect(product).not.toHaveProperty('createdAt');
  });

  it('persists an optional brand description during localized translation updates', async () => {
    const { service, tx } = createHarness();

    const brand = await service.updateBrand('brand-id', {
      content: { bn: { name: 'Brand', slug: 'brand', description: 'Localized brand description' } },
    });

    expect(tx.brandTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ description: 'Localized brand description' }),
      }),
    );
    expect(brand.content.bn?.description).toBe('Localized brand description');
  });

  it('does not delete translations omitted from a localized brand update', async () => {
    const { service, prisma } = createHarness();

    await service.updateBrand('brand-id', {
      content: { bn: { name: 'Brand', slug: 'brand' } },
    });

    expect(prisma.brandTranslation.upsert).not.toHaveBeenCalled();
    expect(prisma.tx.brandTranslation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.tx.brandTranslation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brandId_locale: { brandId: 'brand-id', locale: 'bn' } },
      }),
    );
  });

  it('rejects category parent changes that would create an ancestor cycle', async () => {
    const { service, prisma } = createHarness();
    prisma.category.findUnique.mockResolvedValueOnce({
      id: 'parent-category',
      parentId: 'category-id',
    } as never);

    await expect(
      service.updateCategory('category-id', {
        parentId: 'parent-category',
        content: { bn: { name: 'Category', slug: 'category' } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('validates category existence before creating an attribute definition', async () => {
    const { service, prisma } = createHarness();
    prisma.category.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createCategoryAttribute('missing-category', {
        key: 'size',
        valueType: 'text',
        required: true,
        filterable: false,
        sortOrder: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attributeDefinition.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate select options at request validation', () => {
    const result = attributeDefinitionInputSchema.safeParse({
      key: 'size',
      valueType: 'select',
      required: true,
      filterable: true,
      sortOrder: 0,
      options: ['small', 'small'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects variant attributes that do not match the category definition', async () => {
    const { service, prisma } = createHarness();
    prisma.product.findUnique.mockResolvedValueOnce({ categoryId: 'category-id' } as never);
    prisma.attributeDefinition.findMany.mockResolvedValueOnce([
      {
        attributeKey: 'size',
        valueType: 'select',
        isRequired: true,
        options: ['small', 'large'],
      },
    ] as never);

    await expect(
      service.createVariant('product-id', {
        sku: 'SKU-1',
        price: 100,
        attributes: { size: 'medium' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productVariant.create).not.toHaveBeenCalled();
  });

  it('rejects product category changes that invalidate existing variant attributes', async () => {
    const { service, prisma, tx } = createHarness();
    prisma.category.findUnique.mockResolvedValueOnce({ id: 'new-category' } as never);
    tx.product.findUnique.mockResolvedValueOnce({
      id: 'product-id',
      categoryId: 'old-category',
      variants: [{ attributes: { color: 'red' } }],
    } as never);
    tx.attributeDefinition.findMany.mockResolvedValueOnce([
      {
        attributeKey: 'size',
        valueType: 'select',
        isRequired: true,
        options: ['small', 'large'],
      },
    ] as never);

    await expect(
      service.updateProduct('product-id', {
        categoryId: 'new-category',
        status: 'active',
        content: { en: { name: 'Shirt', slug: 'shirt' } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('maps known uniqueness failures to conflict responses and rethrows unexpected failures', async () => {
    const { service, prisma } = createHarness();
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    prisma.brand.create.mockRejectedValueOnce(duplicate);

    await expect(
      service.createBrand({ content: { en: { name: 'Brand', slug: 'duplicate' } } }),
    ).rejects.toBeInstanceOf(ConflictException);

    const unexpected = new Error('database unavailable');
    prisma.brand.create.mockRejectedValueOnce(unexpected);
    await expect(
      service.createBrand({ content: { en: { name: 'Brand', slug: 'other' } } }),
    ).rejects.toBe(unexpected);
  });
});
