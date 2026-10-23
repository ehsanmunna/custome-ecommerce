import type { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasDatabase,
  resetDatabase,
  runMigrateCommand,
  runtimeUrl,
  withClient,
} from '../helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

const MISSING_ID = '00000000-0000-0000-0000-000000000000';

async function asRuntime<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  if (!runtimeUrl) {
    throw new Error('DATABASE_URL is required for database integration tests');
  }
  return withClient(runtimeUrl, callback);
}

async function createCategory(client: Client, parentId: string | null = null): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO categories (parent_id) VALUES ($1) RETURNING id',
    [parentId],
  );
  return result.rows[0]!.id;
}

async function createBrand(client: Client): Promise<string> {
  const result = await client.query<{ id: string }>('INSERT INTO brands DEFAULT VALUES RETURNING id');
  return result.rows[0]!.id;
}

async function createProduct(
  client: Client,
  categoryId: string,
  brandId: string | null = null,
): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO products (category_id, brand_id) VALUES ($1, $2) RETURNING id',
    [categoryId, brandId],
  );
  return result.rows[0]!.id;
}

async function createVariant(
  client: Client,
  productId: string,
  sku: string,
  pricePoisha = 125000,
  attributes: Record<string, unknown> = {},
): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO product_variants (product_id, sku, price_poisha, attributes)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [productId, sku, pricePoisha, JSON.stringify(attributes)],
  );
  return result.rows[0]!.id;
}

async function createMedia(client: Client, storageKey: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO media_assets (storage_key, mime_type, size_bytes, width, height)
     VALUES ($1, 'image/png', 1024, 800, 600) RETURNING id`,
    [storageKey],
  );
  return result.rows[0]!.id;
}

describeDatabase('catalog schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('rejects self-parenting and unknown category parents', async () => {
    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);

      await expect(
        client.query('UPDATE categories SET parent_id = $1 WHERE id = $1', [categoryId]),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(createCategory(client, MISSING_ID)).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('rejects deleting a category with children or products', async () => {
    await asRuntime(async (client) => {
      const parentId = await createCategory(client);
      await createCategory(client, parentId);

      await expect(
        client.query('DELETE FROM categories WHERE id = $1', [parentId]),
      ).rejects.toMatchObject({ code: '23503' });
    });

    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);
      await createProduct(client, categoryId);

      await expect(
        client.query('DELETE FROM categories WHERE id = $1', [categoryId]),
      ).rejects.toMatchObject({ code: '23503' });
    });
  });

  it('keeps bn and en content separate and enforces locale and slug uniqueness', async () => {
    await asRuntime(async (client) => {
      const first = await createCategory(client);
      const second = await createCategory(client);

      await client.query(
        `INSERT INTO category_translations (category_id, locale, name, slug)
         VALUES ($1, 'en', 'Shirts', 'shirts'), ($1, 'bn', 'শার্ট', 'shirts')`,
        [first],
      );

      const translations = await client.query<{ locale: string }>(
        'SELECT locale FROM category_translations WHERE category_id = $1 ORDER BY locale',
        [first],
      );
      expect(translations.rows.map((row) => row.locale)).toEqual(['bn', 'en']);

      await expect(
        client.query(
          `INSERT INTO category_translations (category_id, locale, name, slug)
           VALUES ($1, 'en', 'Other', 'other')`,
          [first],
        ),
      ).rejects.toMatchObject({ code: '23505' });

      await expect(
        client.query(
          `INSERT INTO category_translations (category_id, locale, name, slug)
           VALUES ($1, 'en', 'Duplicate', 'shirts')`,
          [second],
        ),
      ).rejects.toMatchObject({ code: '23505' });

      await expect(
        client.query(
          `INSERT INTO category_translations (category_id, locale, name, slug)
           VALUES ($1, 'fr', 'Chemises', 'chemises')`,
          [second],
        ),
      ).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('requires a product category and validates its brand and status', async () => {
    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);
      const brandId = await createBrand(client);
      const productId = await createProduct(client, categoryId, brandId);

      const product = await client.query<{ brand_id: string }>(
        'SELECT brand_id FROM products WHERE id = $1',
        [productId],
      );
      expect(product.rows[0]?.brand_id).toBe(brandId);

      await expect(
        client.query('INSERT INTO products (brand_id) VALUES ($1)', [brandId]),
      ).rejects.toMatchObject({ code: '23502' });

      await expect(
        client.query('INSERT INTO products (category_id, brand_id) VALUES ($1, $2)', [
          categoryId,
          MISSING_ID,
        ]),
      ).rejects.toMatchObject({ code: '23503' });

      await expect(
        client.query("INSERT INTO products (category_id, status) VALUES ($1, 'discontinued')", [
          categoryId,
        ]),
      ).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('stores integer poisha and JSONB attributes while enforcing SKU and price rules', async () => {
    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);
      const productId = await createProduct(client, categoryId);
      const variantId = await createVariant(client, productId, 'SKU-1', 125000, {
        color: 'red',
        size: 'M',
      });

      const variant = await client.query<{ price_poisha: number; attributes: unknown }>(
        'SELECT price_poisha, attributes FROM product_variants WHERE id = $1',
        [variantId],
      );
      expect(variant.rows[0]?.price_poisha).toBe(125000);
      expect(variant.rows[0]?.attributes).toEqual({ color: 'red', size: 'M' });

      await expect(createVariant(client, productId, 'SKU-1')).rejects.toMatchObject({
        code: '23505',
      });
      await expect(createVariant(client, productId, 'SKU-2', -1)).rejects.toMatchObject({
        code: '23514',
      });
      await expect(createVariant(client, MISSING_ID, 'SKU-3')).rejects.toMatchObject({
        code: '23503',
      });
    });
  });

  it('scopes attribute keys to a category and validates select definitions', async () => {
    await asRuntime(async (client) => {
      const clothes = await createCategory(client);
      const shoes = await createCategory(client);

      await client.query(
        `INSERT INTO attribute_definitions (category_id, attribute_key, value_type)
         VALUES ($1, 'size', 'text'), ($2, 'size', 'text')`,
        [clothes, shoes],
      );

      await expect(
        client.query(
          `INSERT INTO attribute_definitions (category_id, attribute_key, value_type)
           VALUES ($1, 'size', 'text')`,
          [clothes],
        ),
      ).rejects.toMatchObject({ code: '23505' });

      await expect(
        client.query(
          `INSERT INTO attribute_definitions (category_id, attribute_key, value_type, options)
           VALUES ($1, 'color', 'select', ARRAY[]::TEXT[])`,
          [clothes],
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          `INSERT INTO attribute_definitions (category_id, attribute_key, value_type)
           VALUES ($1, 'release', 'date')`,
          [clothes],
        ),
      ).rejects.toMatchObject({ code: '22P02' });
    });
  });

  it('enforces media keys, metadata, dimensions, and alt-text locales', async () => {
    await asRuntime(async (client) => {
      const first = await createMedia(client, 'catalog/first.png');
      await createMedia(client, 'catalog/second.png');

      await expect(createMedia(client, 'catalog/first.png')).rejects.toMatchObject({
        code: '23505',
      });

      await expect(
        client.query(
          `INSERT INTO media_assets (storage_key, mime_type, size_bytes)
           VALUES ('catalog/negative.png', 'image/png', -1)`,
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await expect(
        client.query(
          `INSERT INTO media_assets (storage_key, mime_type, size_bytes, width)
           VALUES ('catalog/half-size.png', 'image/png', 10, 800)`,
        ),
      ).rejects.toMatchObject({ code: '23514' });

      await client.query(
        `INSERT INTO media_alt_texts (media_id, locale, alt_text)
         VALUES ($1, 'en', 'A shirt'), ($1, 'bn', 'একটি শার্ট')`,
        [first],
      );

      await expect(
        client.query(
          `INSERT INTO media_alt_texts (media_id, locale, alt_text)
           VALUES ($1, 'en', 'Duplicate')`,
          [first],
        ),
      ).rejects.toMatchObject({ code: '23505' });
    });
  });

  it('allows one primary image and removes associations when media is deleted', async () => {
    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);
      const productId = await createProduct(client, categoryId);
      const primary = await createMedia(client, 'catalog/primary.png');
      const secondary = await createMedia(client, 'catalog/secondary.png');

      await client.query(
        `INSERT INTO product_media (product_id, media_id, is_primary)
         VALUES ($1, $2, true)`,
        [productId, primary],
      );

      await expect(
        client.query(
          `INSERT INTO product_media (product_id, media_id, is_primary)
           VALUES ($1, $2, true)`,
          [productId, secondary],
        ),
      ).rejects.toMatchObject({ code: '23505' });

      await client.query(
        `INSERT INTO media_alt_texts (media_id, locale, alt_text)
         VALUES ($1, 'en', 'Primary image')`,
        [primary],
      );

      await client.query('DELETE FROM media_assets WHERE id = $1', [primary]);

      const product = await client.query('SELECT 1 FROM products WHERE id = $1', [productId]);
      const linkCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM product_media WHERE product_id = $1',
        [productId],
      );
      const altCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM media_alt_texts WHERE media_id = $1',
        [primary],
      );

      expect(product.rowCount).toBe(1);
      expect(linkCount.rows[0]?.count).toBe('0');
      expect(altCount.rows[0]?.count).toBe('0');
    });
  });

  it('cascades product-owned rows but keeps the media asset', async () => {
    await asRuntime(async (client) => {
      const categoryId = await createCategory(client);
      const productId = await createProduct(client, categoryId);
      const mediaId = await createMedia(client, 'catalog/product.png');
      const variantId = await createVariant(client, productId, 'SKU-CASCADE');

      await client.query(
        `INSERT INTO product_translations (product_id, locale, name, slug)
         VALUES ($1, 'en', 'Shirt', 'shirt')`,
        [productId],
      );
      await client.query(
        'INSERT INTO product_media (product_id, media_id) VALUES ($1, $2)',
        [productId, mediaId],
      );

      await client.query('DELETE FROM products WHERE id = $1', [productId]);

      const variantCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM product_variants WHERE id = $1',
        [variantId],
      );
      const translationCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM product_translations WHERE product_id = $1',
        [productId],
      );
      const linkCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM product_media WHERE product_id = $1',
        [productId],
      );
      const mediaCount = await client.query<{ count: string }>(
        'SELECT count(*) FROM media_assets WHERE id = $1',
        [mediaId],
      );

      expect(variantCount.rows[0]?.count).toBe('0');
      expect(translationCount.rows[0]?.count).toBe('0');
      expect(linkCount.rows[0]?.count).toBe('0');
      expect(mediaCount.rows[0]?.count).toBe('1');
    });
  });

  it('clears category and brand images when the media asset is deleted', async () => {
    await asRuntime(async (client) => {
      const mediaId = await createMedia(client, 'catalog/shared.png');
      const category = await client.query<{ id: string }>(
        'INSERT INTO categories (image_media_id) VALUES ($1) RETURNING id',
        [mediaId],
      );
      const brand = await client.query<{ id: string }>(
        'INSERT INTO brands (image_media_id) VALUES ($1) RETURNING id',
        [mediaId],
      );

      await client.query('DELETE FROM media_assets WHERE id = $1', [mediaId]);

      const categoryImage = await client.query<{ image_media_id: string | null }>(
        'SELECT image_media_id FROM categories WHERE id = $1',
        [category.rows[0]!.id],
      );
      const brandImage = await client.query<{ image_media_id: string | null }>(
        'SELECT image_media_id FROM brands WHERE id = $1',
        [brand.rows[0]!.id],
      );

      expect(categoryImage.rows[0]?.image_media_id).toBeNull();
      expect(brandImage.rows[0]?.image_media_id).toBeNull();
    });
  });
});
