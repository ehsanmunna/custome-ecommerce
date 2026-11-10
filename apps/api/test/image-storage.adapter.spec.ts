import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalStorageAdapter } from '../src/image-storage/local-storage.adapter';
import { storageAdapterOptions } from '../src/image-storage/image-storage.service';

describe('LocalStorageAdapter', () => {
  let assetsRoot: string;
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    assetsRoot = mkdtempSync(join(tmpdir(), 'adapter-test-'));
    adapter = new LocalStorageAdapter({
      ...storageAdapterOptions,
      root: assetsRoot,
    });
  });

  afterEach(() => {
    rmSync(assetsRoot, { recursive: true, force: true });
  });

  it('generates keys in <yyyy>/<mm>/<uuid>/<variant>.webp format', () => {
    const key = adapter.createKey('original');
    expect(key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/original\.webp$/);
  });

  it('generates different keys for different variants', () => {
    const original = adapter.createKey('original');
    const thumb = adapter.createKey('thumb');
    const card = adapter.createKey('card');
    const detail = adapter.createKey('detail');

    expect(original).not.toBe(thumb);
    expect(thumb).not.toBe(card);
    expect(card).not.toBe(detail);
    expect(original.split('/')[3]).toBe('original.webp');
    expect(thumb.split('/')[3]).toBe('thumb.webp');
    expect(card.split('/')[3]).toBe('card.webp');
    expect(detail.split('/')[3]).toBe('detail.webp');
  });

  it('uses the same uuid prefix for all variants created at the same time', () => {
    const now = new Date('2026-01-15T10:30:00.000Z');
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const key = adapter.createKey('original', id, now);

    expect(key).toBe('2026/01/a1b2c3d4-e5f6-7890-abcd-ef1234567890/original.webp');
  });

  it('puts, gets, checks existence, and deletes a file', async () => {
    const key = '2026/01/a1b2c3d4-e5f6-7890-abcd-ef1234567890/original.webp';
    const content = Buffer.from('hello world');

    expect(await adapter.exists(key)).toBe(false);
    expect(await adapter.get(key)).toBeNull();

    const stream = (async function* () {
      yield content;
    })() as unknown as NodeJS.ReadableStream;
    await adapter.put(key, stream);

    expect(await adapter.exists(key)).toBe(true);

    const retrieved = await adapter.get(key);
    expect(retrieved).toBeDefined();
    const chunks: Buffer[] = [];
    for await (const chunk of retrieved!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello world');

    await adapter.delete(key);
    expect(await adapter.exists(key)).toBe(false);
  });

  it('builds public URLs from base URL and key', () => {
    const key = '2026/01/a1b2c3d4-e5f6-7890-abcd-ef1234567890/original.webp';
    const url = adapter.getPublicUrl(key);
    expect(url).toContain('image-storage/serve');
    expect(url).toContain('storageKey=');
    expect(url).toContain(encodeURIComponent(key));
  });

  it('rejects invalid storage keys', async () => {
    const stream = (async function* () {
      yield Buffer.from('data');
    })() as unknown as NodeJS.ReadableStream;

    await expect(adapter.put('invalid/key', stream)).rejects.toThrow();
    await expect(adapter.get('invalid/key')).rejects.toThrow();
    await expect(adapter.delete('invalid/key')).rejects.toThrow();
    await expect(adapter.exists('invalid/key')).rejects.toThrow();
    expect(() => adapter.getPublicUrl('invalid/key')).toThrow();
  });

  it('prevents path traversal in keys', async () => {
    const stream = (async function* () {
      yield Buffer.from('data');
    })() as unknown as NodeJS.ReadableStream;

    await expect(adapter.put('../../../etc/passwd', stream)).rejects.toThrow();
    await expect(adapter.get('../../../etc/passwd')).rejects.toThrow();
    await expect(adapter.delete('../../../etc/passwd')).rejects.toThrow();
    await expect(adapter.exists('../../../etc/passwd')).rejects.toThrow();
    expect(() => adapter.getPublicUrl('../../../etc/passwd')).toThrow();
  });

  it('stores files under assets root with correct directory structure', async () => {
    const key = '2026/01/a1b2c3d4-e5f6-7890-abcd-ef1234567890/original.webp';
    const content = Buffer.from('test content');

    const stream = (async function* () {
      yield content;
    })() as unknown as NodeJS.ReadableStream;
    await adapter.put(key, stream);

    const filePath = join(assetsRoot, key);
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBe(content.length);
  });
});
