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

async function createPage(client: Client): Promise<string> {
  const result = await client.query<{ id: string }>(
    'INSERT INTO cms_pages DEFAULT VALUES RETURNING id',
  );
  return result.rows[0]!.id;
}

async function createBanner(client: Client, mediaAssetId: string | null = null): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO cms_banners (placement_key, media_asset_id)
     VALUES ('home-hero', $1) RETURNING id`,
    [mediaAssetId],
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

describeDatabase('settings and CMS schema', () => {
  beforeEach(async () => {
    await resetDatabase();
    const result = runMigrateCommand();
    expect(result.status, result.stderr).toBe(0);
  });

  it('stores unique structured settings and external provider secret references', async () => {
    await asRuntime(async (client) => {
      const setting = await client.query<{ key: string; value: Record<string, unknown> }>(
        `INSERT INTO store_settings (key, value)
         VALUES ('tax.rate', '{"percent": 5}'::jsonb) RETURNING key, value`,
      );
      expect(setting.rows[0]).toMatchObject({ key: 'tax.rate', value: { percent: 5 } });

      await expect(
        client.query(`INSERT INTO store_settings (key) VALUES ('tax.rate')`),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        client.query(`INSERT INTO store_settings (key) VALUES ('   ')`),
      ).rejects.toMatchObject({
        code: '23514',
      });
      await expect(
        client.query(
          `INSERT INTO store_settings (key, value) VALUES ('invalid.shape', '[]'::jsonb)`,
        ),
      ).rejects.toMatchObject({ code: '23514' });

      const secret = await client.query<{ secret_reference: string }>(
        `INSERT INTO provider_secret_references (provider, credential_name, secret_reference)
         VALUES ('bkash', 'app-key', 'secret-manager://store/bkash/app-key')
         RETURNING secret_reference`,
      );
      expect(secret.rows[0]?.secret_reference).toBe('secret-manager://store/bkash/app-key');
      await expect(
        client.query(
          `INSERT INTO provider_secret_references (provider, credential_name, secret_reference)
           VALUES ('bkash', 'app-key', 'secret-manager://duplicate')`,
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        client.query(
          `INSERT INTO provider_secret_references (provider, credential_name, secret_reference)
           VALUES ('bkash', 'empty', '  ')`,
        ),
      ).rejects.toMatchObject({ code: '23514' });

      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'provider_secret_references'`,
      );
      const columnNames = columns.rows.map((row) => row.column_name);
      expect(columnNames).toContain('secret_reference');
      expect(columnNames).not.toContain('secret_value');
      expect(columnNames).not.toContain('credential_value');
    });
  });

  it('stores localized page translations with independent draft and publication states', async () => {
    await asRuntime(async (client) => {
      const pageId = await createPage(client);
      await client.query(
        `INSERT INTO cms_page_translations (page_id, locale, slug, title, content, seo_title)
         VALUES
           ($1, 'bn', 'about', 'আমাদের সম্পর্কে', '{"blocks":[]}'::jsonb, 'আমাদের সম্পর্কে'),
           ($1, 'en', 'about', 'About us', '{"blocks":[]}'::jsonb, 'About us')`,
        [pageId],
      );

      const translations = await client.query<{
        locale: string;
        slug: string;
        status: string;
        content: Record<string, unknown>;
      }>(
        `SELECT locale, slug, status, content FROM cms_page_translations
         WHERE page_id = $1 ORDER BY locale`,
        [pageId],
      );
      expect(translations.rows).toEqual([
        { locale: 'bn', slug: 'about', status: 'draft', content: { blocks: [] } },
        { locale: 'en', slug: 'about', status: 'draft', content: { blocks: [] } },
      ]);

      await client.query(
        `UPDATE cms_page_translations SET status = 'published'
         WHERE page_id = $1 AND locale = 'bn'`,
        [pageId],
      );
      const states = await client.query<{ locale: string; status: string }>(
        `SELECT locale, status FROM cms_page_translations WHERE page_id = $1 ORDER BY locale`,
        [pageId],
      );
      expect(states.rows).toEqual([
        { locale: 'bn', status: 'published' },
        { locale: 'en', status: 'draft' },
      ]);

      const otherPageId = await createPage(client);
      await expect(
        client.query(
          `INSERT INTO cms_page_translations (page_id, locale, slug, title)
           VALUES ($1, 'en', 'about', 'Different page')`,
          [otherPageId],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        client.query(
          `INSERT INTO cms_page_translations (page_id, locale, slug, title)
           VALUES ($1, 'bn', '   ', 'Invalid page')`,
          [otherPageId],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        client.query(
          `INSERT INTO cms_page_translations (page_id, locale, slug, title)
           VALUES ($1, 'fr', 'french', 'Unsupported')`,
          [otherPageId],
        ),
      ).rejects.toMatchObject({ code: '22P02' });
      await expect(
        client.query(
          `INSERT INTO cms_page_translations (page_id, locale, slug, title, status)
           VALUES ($1, 'en', 'status', 'Unsupported', 'live')`,
          [otherPageId],
        ),
      ).rejects.toMatchObject({ code: '22P02' });

      await client.query('DELETE FROM cms_pages WHERE id = $1', [pageId]);
      const remainingTranslations = await client.query<{ count: string }>(
        'SELECT count(*) FROM cms_page_translations WHERE page_id = $1',
        [pageId],
      );
      expect(remainingTranslations.rows[0]?.count).toBe('0');
    });
  });

  it('stores partial banner translations and clears deleted media references', async () => {
    await asRuntime(async (client) => {
      const mediaAssetId = await createMedia(client, 'cms-banner.png');
      const bannerId = await createBanner(client, mediaAssetId);
      await client.query(
        `INSERT INTO cms_banner_translations (banner_id, locale, title, body, destination_url)
         VALUES ($1, 'en', 'Summer sale', 'Shop new arrivals', '/collections/summer')`,
        [bannerId],
      );
      await expect(
        client.query(
          `INSERT INTO cms_banners (placement_key, media_asset_id)
           VALUES ('invalid-media', $1)`,
          [MISSING_ID],
        ),
      ).rejects.toMatchObject({ code: '23503' });

      await client.query('DELETE FROM media_assets WHERE id = $1', [mediaAssetId]);
      const banner = await client.query<{ media_asset_id: string | null }>(
        'SELECT media_asset_id FROM cms_banners WHERE id = $1',
        [bannerId],
      );
      expect(banner.rows[0]?.media_asset_id).toBeNull();

      const translation = await client.query<{
        locale: string;
        title: string;
        destination_url: string;
      }>(
        'SELECT locale, title, destination_url FROM cms_banner_translations WHERE banner_id = $1',
        [bannerId],
      );
      expect(translation.rows).toEqual([
        { locale: 'en', title: 'Summer sale', destination_url: '/collections/summer' },
      ]);

      const unrelatedBannerId = await createBanner(client);
      const unrelatedPageId = await createPage(client);
      await client.query(
        `INSERT INTO cms_banner_translations (banner_id, locale, title)
         VALUES ($1, 'bn', 'ផ្សព្វազាយ')`,
        [unrelatedBannerId],
      );
      await client.query('DELETE FROM cms_banners WHERE id = $1', [bannerId]);
      const deletedBannerTranslations = await client.query<{ count: string }>(
        'SELECT count(*) FROM cms_banner_translations WHERE banner_id = $1',
        [bannerId],
      );
      expect(deletedBannerTranslations.rows[0]?.count).toBe('0');

      const remaining = await client.query<{ banners: string; pages: string }>(
        `SELECT
           (SELECT count(*) FROM cms_banners WHERE id = $1) AS banners,
           (SELECT count(*) FROM cms_pages WHERE id = $2) AS pages`,
        [unrelatedBannerId, unrelatedPageId],
      );
      expect(remaining.rows[0]).toEqual({ banners: '1', pages: '1' });
    });
  });
});
