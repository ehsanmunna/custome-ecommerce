import { HeadObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import {
  createStorageKey,
  encodeStorageKey,
  isAllowedImageMime,
  MediaStorageError,
  normalizePublicBaseUrl,
} from '../src/media/media-storage';
import { R2MediaStorage } from '../src/media/media-storage.r2';

const baseSettings = {
  accountId: 'account-id',
  bucket: 'media-bucket',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  publicBaseUrl: 'https://cdn.example.com/',
  uploadTtlSeconds: 600,
  imageResizingEnabled: true,
};

function configuredHarness() {
  const client = { send: vi.fn() };
  const signer = vi.fn(async () => 'https://upload.example.com/signed');
  const storage = new R2MediaStorage(baseSettings, { client, signer });

  return { storage, client, signer };
}

describe('media storage helpers', () => {
  it('generates a dated key from the MIME-derived extension and supplied UUID', () => {
    const key = createStorageKey('image/png', new Date('2026-10-25T12:00:00.000Z'), 'uuid-1');

    expect(key).toBe('media/2026/10/uuid-1.png');
    expect(isAllowedImageMime('image/avif')).toBe(true);
    expect(isAllowedImageMime('image/svg+xml')).toBe(false);
    expect(() => createStorageKey('image/svg+xml')).toThrowError(MediaStorageError);
  });

  it('encodes each key segment and normalizes public base URLs', () => {
    expect(encodeStorageKey('media/2026/10/file name.jpg')).toBe('media/2026/10/file%20name.jpg');
    expect(normalizePublicBaseUrl('https://cdn.example.com/')).toBe('https://cdn.example.com');
    expect(normalizePublicBaseUrl('https://cdn.example.com/base/')).toBe(
      'https://cdn.example.com/base',
    );
    expect(normalizePublicBaseUrl('ftp://cdn.example.com')).toBeNull();
    expect(normalizePublicBaseUrl('not a url')).toBeNull();
  });
});

describe('R2 media storage adapter', () => {
  it('reports unconfigured storage without constructing a client or signing URLs', async () => {
    const storage = new R2MediaStorage({
      ...baseSettings,
      accessKeyId: undefined,
    });

    expect(storage.isConfigured()).toBe(false);
    await expect(storage.createUpload('key', 'image/png', 600)).rejects.toBeInstanceOf(
      MediaStorageError,
    );
  });

  it('signs a PUT instruction with the bucket, key, content type, and lifetime', async () => {
    const { storage, signer } = configuredHarness();

    const upload = await storage.createUpload('media/key.png', 'image/png', 300);

    const [client, command, options] = signer.mock.calls[0] as unknown as [
      unknown,
      PutObjectCommand,
      { expiresIn: number },
    ];
    expect(client).toBeDefined();
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'media-bucket',
      Key: 'media/key.png',
      ContentType: 'image/png',
    });
    expect(options).toEqual({ expiresIn: 300 });
    expect(upload).toMatchObject({
      url: 'https://upload.example.com/signed',
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    });
    expect(Date.parse(upload.expiresAt)).toBeGreaterThan(Date.now());
  });

  it('returns authoritative size and type from head requests', async () => {
    const { storage, client } = configuredHarness();
    client.send.mockResolvedValueOnce({ ContentLength: 2048, ContentType: 'image/webp' });

    const result = await storage.headObject('media/key.webp');

    expect(client.send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(result).toEqual({ sizeBytes: 2048, mimeType: 'image/webp' });
  });

  it('returns null for missing objects and typed errors for provider failures', async () => {
    const { storage, client } = configuredHarness();
    const missing = Object.assign(new Error('missing'), {
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    });
    client.send.mockRejectedValueOnce(missing);

    await expect(storage.headObject('media/missing.png')).resolves.toBeNull();

    client.send.mockRejectedValueOnce(new Error('provider down'));
    await expect(storage.headObject('media/key.png')).rejects.toBeInstanceOf(MediaStorageError);

    client.send.mockRejectedValueOnce(new Error('provider down'));
    await expect(storage.deleteObject('media/key.png')).rejects.toBeInstanceOf(MediaStorageError);
  });

  it('deletes objects through the client', async () => {
    const { storage, client } = configuredHarness();

    await storage.deleteObject('media/key.png');

    const command = client.send.mock.calls[0]?.[0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'media-bucket', Key: 'media/key.png' });
  });

  it('builds public and resizing URLs from a normalized base URL', () => {
    const { storage } = configuredHarness();

    expect(storage.publicUrl('media/2026/10/key.png')).toBe(
      'https://cdn.example.com/media/2026/10/key.png',
    );
    expect(storage.variantUrl('media/2026/10/key.png', 480)).toBe(
      'https://cdn.example.com/cdn-cgi/image/width=480,format=auto/media/2026/10/key.png',
    );
    expect(storage.isImageResizingEnabled()).toBe(true);
  });
});
