import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/catalog/catalog.service';
import { PrismaService } from '../src/platform/database/prisma.service';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const describeDatabase = hasDatabase ? describe : describe.skip;

describeDatabase('catalog database integration', () => {
  const prisma = new PrismaService();
  const service = new CatalogService(prisma);
  const suffix = randomUUID();
  const categoryIds: string[] = [];
  const brandIds: string[] = [];
  const productIds: string[] = [];
  const mediaIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (productIds.length) {
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    if (brandIds.length) {
      await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
    }
    if (categoryIds.length) {
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    }
    if (mediaIds.length) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
    }
    await prisma.$disconnect();
  });

  it('persists localized descriptions and enforces catalog references and invariants', async () => {
    const root = await service.createCategory({
      content: {
        bn: {
          name: `Category ${suffix}`,
          slug: `category-${suffix}`,
          description: 'বাংলা বিবরণ',
        },
        en: {
          name: `Category ${suffix}`,
          slug: `category-en-${suffix}`,
          description: 'English category description',
        },
      },
    });
    categoryIds.push(root.id);

    const child = await service.createCategory({
      parentId: root.id,
      content: { en: { name: 'Child', slug: `child-${suffix}` } },
    });
    categoryIds.push(child.id);

    await expect(
      service.updateCategory(root.id, {
        parentId: child.id,
        content: { bn: { name: `Category ${suffix}`, slug: `category-${suffix}` } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const updatedCategory = await service.updateCategory(root.id, {
      content: {
        bn: {
          name: `Category ${suffix}`,
          slug: `category-${suffix}`,
          description: 'Updated বাংলা বিবরণ',
        },
      },
    });
    expect(updatedCategory.content.bn?.description).toBe('Updated বাংলা বিবরণ');
    expect(updatedCategory.content.en?.description).toBe('English category description');

    await expect(
      service.createCategory({
        content: { bn: { name: 'Duplicate', slug: `category-${suffix}` } },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const brand = await service.createBrand({
      content: {
        bn: {
          name: `Brand ${suffix}`,
          slug: `brand-${suffix}`,
          description: 'Brand description',
        },
        en: { name: `Brand ${suffix}`, slug: `brand-en-${suffix}` },
      },
    });
    brandIds.push(brand.id);

    const updatedBrand = await service.updateBrand(brand.id, {
      content: {
        bn: {
          name: `Brand ${suffix}`,
          slug: `brand-${suffix}`,
          description: 'Updated brand description',
        },
      },
    });
    expect(updatedBrand.content.bn?.description).toBe('Updated brand description');
    expect(updatedBrand.content.en?.slug).toBe(`brand-en-${suffix}`);
    await expect(service.storefrontBrand(`brand-en-${suffix}`, 'bn')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect((await service.storefrontBrand(`brand-${suffix}`, 'bn')).content.bn?.description).toBe(
      'Updated brand description',
    );

    const attribute = await service.createCategoryAttribute(root.id, {
      key: 'size',
      valueType: 'select',
      required: true,
      filterable: true,
      sortOrder: 0,
      options: ['small', 'large'],
    });
    expect(attribute.options).toEqual(['small', 'large']);
    await expect(
      service.createCategoryAttribute(root.id, {
        key: 'size',
        valueType: 'text',
        required: false,
        filterable: false,
        sortOrder: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const firstMedia = await prisma.mediaAsset.create({
      data: {
        storageKey: `catalog/${suffix}/first.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 10n,
      },
    });
    mediaIds.push(firstMedia.id);
    const secondMedia = await prisma.mediaAsset.create({
      data: {
        storageKey: `catalog/${suffix}/second.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 20n,
      },
    });
    mediaIds.push(secondMedia.id);

    await expect(
      service.createProduct({
        categoryId: root.id,
        brandId: brand.id,
        status: 'active',
        content: { en: { name: 'Invalid media', slug: `invalid-${suffix}` } },
        media: [{ mediaId: randomUUID() }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const product = await service.createProduct({
      categoryId: root.id,
      brandId: brand.id,
      status: 'active',
      content: {
        bn: {
          name: `Product ${suffix}`,
          slug: `product-${suffix}`,
          description: 'Product description',
        },
      },
      media: [
        { mediaId: firstMedia.id, primary: true, sortOrder: 2 },
        { mediaId: secondMedia.id, sortOrder: 1 },
      ],
    });
    productIds.push(product.id);

    const updatedProduct = await service.updateProduct(product.id, {
      categoryId: root.id,
      brandId: brand.id,
      status: 'active',
      content: { bn: { name: `Product ${suffix}`, slug: `product-${suffix}` } },
      media: [
        { mediaId: firstMedia.id, primary: true, sortOrder: 0 },
        { mediaId: secondMedia.id, sortOrder: 1 },
      ],
    });
    expect(updatedProduct.media.map(({ id }) => id)).toEqual([firstMedia.id, secondMedia.id]);

    await expect(
      service.createVariant(product.id, {
        sku: `SKU-${suffix}`,
        price: 1200,
        attributes: { size: 'medium' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const variant = await service.createVariant(product.id, {
      sku: `SKU-${suffix}`,
      price: 1200,
      attributes: { size: 'small' },
    });
    expect(variant.price).toBe(1200);

    await expect(
      service.createVariant(product.id, {
        sku: `SKU-${suffix}`,
        price: 1500,
        attributes: { size: 'large' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const publicProduct = await service.storefrontProduct(`product-${suffix}`, 'bn');
    expect(publicProduct.content.bn?.description).toBe('Product description');
    expect(publicProduct.variants.map(({ id }) => id)).toEqual([variant.id]);
    expect(publicProduct.media.map(({ id }) => id)).toEqual([firstMedia.id, secondMedia.id]);
    expect(publicProduct).not.toHaveProperty('stock');

    const destination = await service.createCategory({
      content: { en: { name: 'Destination', slug: `destination-${suffix}` } },
    });
    categoryIds.push(destination.id);
    await service.createCategoryAttribute(destination.id, {
      key: 'color',
      valueType: 'text',
      required: true,
      filterable: false,
      sortOrder: 0,
    });
    await expect(
      service.updateProduct(product.id, {
        categoryId: destination.id,
        brandId: brand.id,
        status: 'active',
        content: { en: { name: 'Moved product', slug: `product-${suffix}` } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.deleteBrand(brand.id)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.deleteCategory(root.id)).rejects.toBeInstanceOf(ConflictException);
  }, 30_000);
});
