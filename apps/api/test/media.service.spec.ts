import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../src/platform/config/app-config.service';
import type { PrismaService } from '../src/platform/database/prisma.service';
import type { StructuredLogger } from '../src/platform/logging/structured-logger';
import type { MediaStorage } from '../src/media/media-storage';
import { MediaService } from '../src/media/media.service';

const upload = {
  url: 'https://upload.example.com/signed',
  method: 'PUT' as const,
  headers: { 'Content-Type': 'image/png' },
  expiresAt: '2026-10-25T12:10:00.000Z',
};

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-id',
    provider: 'r2',
    storageKey: 'media/2026/10/key.png',
    mimeType: 'image/png',
    sizeBytes: 12n,
    width: null,
    height: null,
    createdAt: new Date('2026-10-25T12:00:00.000Z'),
    updatedAt: new Date('2026-10-25T12:00:00.000Z'),
    altTexts: [{ locale: 'en', altText: 'A product image' }],
    ...overrides,
  };
}

function createHarness() {
  const storage = {
    isConfigured: vi.fn(() => true),
    isImageResizingEnabled: vi.fn(() => true),
    createUpload: vi.fn(async () => upload),
    headObject: vi.fn(async (): Promise<{ sizeBytes: number; mimeType: string } | null> => ({
      sizeBytes: 2048,
      mimeType: 'image/webp',
    })),
    deleteObject: vi.fn(async () => undefined),
    publicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
    variantUrl: vi.fn(
      (key: string, width: number) =>
        `https://cdn.example.com/cdn-cgi/image/width=${width},format=auto/${key}`,
    ),
  };
  const prisma = {
    mediaAsset: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      create: vi.fn(),
      findUnique: vi.fn(async () => null),
      update: vi.fn(),
      delete: vi.fn(async () => undefined),
    },
  };
  const config = { r2MaxUploadBytes: 4096, r2UploadTtlSeconds: 600 };
  const logger = { log: vi.fn(), error: vi.fn() };

  return {
    service: new MediaService(
      prisma as unknown as PrismaService,
      storage as unknown as MediaStorage,
      config as unknown as AppConfigService,
      logger as unknown as StructuredLogger,
    ),
    storage,
    prisma,
    config,
    logger,
  };
}

describe('media service', () => {
  it('lists media with deterministic ordering, safe sizes, localized alt text, and variants', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.mediaAsset.findMany.mockResolvedValueOnce([mediaRow()] as never);
    prisma.mediaAsset.count.mockResolvedValueOnce(1);

    const result = await service.list({ page: 2, pageSize: 10 });

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      include: { altTexts: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.items[0]).toEqual({
      id: 'media-id',
      provider: 'r2',
      key: 'media/2026/10/key.png',
      mimeType: 'image/png',
      sizeBytes: 12,
      alt: { en: 'A product image' },
      url: 'https://cdn.example.com/media/2026/10/key.png',
      variants: {
        thumbnail: {
          url: 'https://cdn.example.com/cdn-cgi/image/width=160,format=auto/media/2026/10/key.png',
          width: 160,
        },
        card: {
          url: 'https://cdn.example.com/cdn-cgi/image/width=480,format=auto/media/2026/10/key.png',
          width: 480,
        },
        detail: {
          url: 'https://cdn.example.com/cdn-cgi/image/width=960,format=auto/media/2026/10/key.png',
          width: 960,
        },
        large: {
          url: 'https://cdn.example.com/cdn-cgi/image/width=1600,format=auto/media/2026/10/key.png',
          width: 1600,
        },
      },
      createdAt: '2026-10-25T12:00:00.000Z',
    });
    expect(result.items[0]).not.toHaveProperty('upload');
    expect(storage.variantUrl).toHaveBeenCalledTimes(4);
  });

  it('omits variants when image resizing is disabled', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.mediaAsset.findMany.mockResolvedValueOnce([mediaRow()] as never);
    storage.isImageResizingEnabled.mockReturnValueOnce(false);

    const result = await service.list({ page: 1, pageSize: 20 });

    expect(result.items[0]).not.toHaveProperty('variants');
  });

  it('rejects unsafe database sizes instead of losing precision', async () => {
    const { service, prisma } = createHarness();
    prisma.mediaAsset.findMany.mockResolvedValueOnce([
      mediaRow({ sizeBytes: BigInt(Number.MAX_SAFE_INTEGER) + 1n }),
    ] as never);

    await expect(service.list({ page: 1, pageSize: 20 })).rejects.toThrowError(
      /safe JSON integer range/,
    );
  });

  it('creates an upload intent with a server-generated key, alt text, and presigned instruction', async () => {
    const { service, prisma, storage, logger } = createHarness();
    prisma.mediaAsset.create.mockImplementationOnce(async (args: { data: unknown }) => {
      const input = args.data as {
        storageKey: string;
        mimeType: string;
        sizeBytes: bigint;
        altTexts: { create: Array<{ locale: string; altText: string }> };
      };
      return mediaRow({
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        altTexts: input.altTexts.create,
      });
    });

    const result = await service.createUpload({
      fileName: 'product.png',
      mimeType: 'image/png',
      sizeBytes: 512,
      alt: { en: 'A product image', bn: 'পণ্যের ছবি' },
    });

    const createData = prisma.mediaAsset.create.mock.calls[0]?.[0]?.data as {
      provider: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: bigint;
      altTexts: { create: Array<{ locale: string; altText: string }> };
    };
    expect(createData.provider).toBe('r2');
    expect(createData.storageKey).toMatch(/^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(createData.mimeType).toBe('image/png');
    expect(createData.sizeBytes).toBe(512n);
    expect(createData.altTexts.create).toEqual([
      { locale: 'bn', altText: 'পণ্যের ছবি' },
      { locale: 'en', altText: 'A product image' },
    ]);
    expect(storage.createUpload).toHaveBeenCalledWith(createData.storageKey, 'image/png', 600);
    expect(result.upload).toEqual(upload);
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'media.upload.created', mediaId: 'media-id' }),
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(upload.url);
  });

  it('rejects unsupported types and oversized uploads before creating metadata', async () => {
    const { service, prisma, storage } = createHarness();

    await expect(
      service.createUpload({ fileName: 'vector.svg', mimeType: 'image/svg+xml', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createUpload({ fileName: 'large.png', mimeType: 'image/png', sizeBytes: 4097 }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(storage.createUpload).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
  });

  it('returns service unavailable and skips metadata when presigning fails', async () => {
    const { service, prisma, storage, logger } = createHarness();
    storage.createUpload.mockRejectedValueOnce(new Error('provider down'));

    await expect(
      service.createUpload({ fileName: 'product.png', mimeType: 'image/png', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'media.storage.failed', operation: 'createUpload' }),
      undefined,
      'MediaService',
    );
  });

  it('completes an upload using authoritative object metadata and remains idempotent', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.mediaAsset.findUnique.mockResolvedValue(mediaRow() as never);
    prisma.mediaAsset.update.mockResolvedValue(
      mediaRow({ mimeType: 'image/webp', sizeBytes: 2048n, width: 800, height: 600 }) as never,
    );

    const first = await service.completeUpload('media-id', { width: 800, height: 600 });
    const second = await service.completeUpload('media-id', { width: 800, height: 600 });

    expect(storage.headObject).toHaveBeenCalledWith('media/2026/10/key.png');
    expect(prisma.mediaAsset.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'media-id' },
      data: { mimeType: 'image/webp', sizeBytes: 2048n, width: 800, height: 600 },
      include: { altTexts: true },
    });
    expect(prisma.mediaAsset.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'media-id' },
      data: { mimeType: 'image/webp', sizeBytes: 2048n, width: 800, height: 600 },
      include: { altTexts: true },
    });
    expect(first).toMatchObject({
      mimeType: 'image/webp',
      sizeBytes: 2048,
      width: 800,
      height: 600,
    });
    expect(second).toMatchObject({ mimeType: 'image/webp', sizeBytes: 2048 });
  });

  it('conflicts when the object has not been uploaded and rejects unsupported stored objects', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.mediaAsset.findUnique.mockResolvedValue(mediaRow() as never);
    storage.headObject.mockResolvedValueOnce(null);

    await expect(service.completeUpload('media-id', {})).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.mediaAsset.update).not.toHaveBeenCalled();

    storage.headObject.mockResolvedValueOnce({ sizeBytes: 10, mimeType: 'image/svg+xml' });
    await expect(service.completeUpload('media-id', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    storage.headObject.mockResolvedValueOnce({ sizeBytes: 4097, mimeType: 'image/png' });
    await expect(service.completeUpload('media-id', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects incomplete dimensions and unknown media before checking storage', async () => {
    const { service, prisma, storage } = createHarness();

    await expect(service.completeUpload('media-id', { width: 10 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();

    prisma.mediaAsset.findUnique.mockResolvedValueOnce(null);
    await expect(service.completeUpload('missing', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.headObject).not.toHaveBeenCalled();
  });

  it('deletes metadata before attempting best-effort object cleanup', async () => {
    const { service, prisma, storage, logger } = createHarness();
    prisma.mediaAsset.findUnique.mockResolvedValueOnce({
      id: 'media-id',
      storageKey: 'media/2026/10/key.png',
    } as never);

    await service.delete('media-id');

    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-id' } });
    expect(storage.deleteObject).toHaveBeenCalledWith('media/2026/10/key.png');
    expect(prisma.mediaAsset.delete.mock.invocationCallOrder[0]!).toBeLessThan(
      storage.deleteObject.mock.invocationCallOrder[0]!,
    );
    expect(logger.log).toHaveBeenCalledWith({ event: 'media.deleted', mediaId: 'media-id' });
  });

  it('logs cleanup failures without failing deletion or leaking the storage key', async () => {
    const { service, prisma, storage, logger } = createHarness();
    prisma.mediaAsset.findUnique.mockResolvedValueOnce({
      id: 'media-id',
      storageKey: 'media/secret-path/key.png',
    } as never);
    storage.deleteObject.mockRejectedValueOnce(new Error('cleanup failed'));

    await expect(service.delete('media-id')).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: 'media.cleanup.failed',
        mediaId: 'media-id',
        errorType: 'Error',
      },
      undefined,
      'MediaService',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret-path');
  });

  it('returns not found when deleting an unknown media record', async () => {
    const { service, prisma, storage } = createHarness();
    prisma.mediaAsset.findUnique.mockResolvedValueOnce(null);

    await expect(service.delete('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('returns service unavailable from every operation when storage is not configured', async () => {
    const { service, storage, prisma } = createHarness();
    storage.isConfigured.mockReturnValue(false);

    await expect(service.list({ page: 1, pageSize: 20 })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      service.createUpload({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.completeUpload('media-id', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.delete('media-id')).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(prisma.mediaAsset.findMany).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.create).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.findUnique).not.toHaveBeenCalled();
    expect(prisma.mediaAsset.delete).not.toHaveBeenCalled();
  });

  it('maps known write conflicts and rethrows unexpected database errors', async () => {
    const { service, prisma } = createHarness();
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    prisma.mediaAsset.create.mockRejectedValueOnce(duplicate);

    await expect(
      service.createUpload({ fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(ConflictException);

    const unexpected = new Error('database unavailable');
    prisma.mediaAsset.create.mockRejectedValueOnce(unexpected);
    await expect(
      service.createUpload({ fileName: 'b.png', mimeType: 'image/png', sizeBytes: 10 }),
    ).rejects.toBe(unexpected);
  });
});
