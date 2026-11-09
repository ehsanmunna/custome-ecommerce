import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AppConfigService } from '../src/platform/config/app-config.service';
import type { StructuredLogger } from '../src/platform/logging/structured-logger';
import type { PrismaService } from '../src/platform/database/prisma.service';
import { ImageStorageService } from '../src/image-storage/image-storage.service';
import { LocalStorageAdapter } from '../src/image-storage/local-storage.adapter';
import { storageAdapterOptions } from '../src/image-storage/image-storage.service';

function mockConfig(): AppConfigService {
  return {} as unknown as AppConfigService;
}

function mockLogger(): StructuredLogger {
  return { log: vi.fn(), error: vi.fn() } as unknown as StructuredLogger;
}

function mockPrisma(): PrismaService {
  return {
    mediaAsset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaService;
}

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
  stream: NodeJS.ReadableStream;
}

function createMockFile(originalname: string, buffer: Buffer): MulterFile {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    destination: '',
    filename: originalname,
    path: '',
    buffer,
    stream: (async function* () { yield buffer; })() as unknown as NodeJS.ReadableStream,
  } as unknown as MulterFile;
}

describe('ImageStorageService', () => {
  let assetsRoot: string;
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    assetsRoot = mkdtempSync(join(tmpdir(), 'image-storage-test-'));
    adapter = new LocalStorageAdapter({
      ...storageAdapterOptions,
      root: assetsRoot,
    });
  });

  afterEach(() => {
    rmSync(assetsRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('uploads a file and creates a media_assets row', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('product.png', Buffer.from('fake-png-bytes'));

    const result = await service.upload('products', file, undefined);

    expect(result.mediaId).toBe('media-id-1');
    expect(result.feature).toBe('products');
    expect(result.mimeType).toBe('image/png');
    expect(result.sizeBytes).toBe(14);
    expect(result.url).toContain('image-storage/serve');
    expect(result.url).toContain('storageKey=');
    expect(result.storageKey).toMatch(/\d{4}\/\d{2}\/[0-9a-f-]+\/original\.webp/);

    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: {
        provider: 'local',
        storageKey: result.storageKey,
        mimeType: 'image/png',
        sizeBytes: BigInt(14),
        width: null,
        height: null,
      },
      select: { id: true },
    });

    const filePath = join(assetsRoot, result.storageKey);
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBe(14);
  });

  it('uses separate subfolders for different features', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file1 = createMockFile('a.png', Buffer.from('bytes-a'));
    const file2 = createMockFile('b.png', Buffer.from('bytes-b'));

    await service.upload('products', file1, undefined);
    await service.upload('categories', file2, undefined);

    expect(prisma.mediaAsset.create).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid feature names', async () => {
    const prisma = mockPrisma();
    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('a.png', Buffer.from('bytes'));

    await expect(service.upload('../etc' as never, file, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.upload('products/../secret' as never, file, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects filenames with path traversal', async () => {
    const prisma = mockPrisma();
    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('../../../etc/passwd', Buffer.from('bytes'));

    await expect(service.upload('products', file, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('serves a stored image with correct MIME type', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });
    (prisma.mediaAsset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(15),
    });

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('photo.jpg', Buffer.from('fake-jpeg-bytes'));

    const uploadResult = await service.upload('products', file, undefined);
    const result = await service.serve(uploadResult.storageKey);

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.size).toBe(15);
    expect(result.stream).toBeDefined();
    result.stream.on('error', () => {});
  });

  it('returns 404 for missing images on serve', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);

    await expect(service.serve('nonexistent-key')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a stored image', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });
    (prisma.mediaAsset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });
    (prisma.mediaAsset.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('temp.png', Buffer.from('temp-bytes'));

    const uploadResult = await service.upload('products', file, undefined);
    await service.remove(uploadResult.storageKey);

    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith({ where: { id: 'media-id-1' } });
  });

  it('returns 404 for removing missing images', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);

    await expect(service.remove('missing-key')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sanitizes filenames by replacing unsafe characters', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'media-id-1' });

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('my product photo!.png', Buffer.from('bytes'));

    const result = await service.upload('products', file, undefined);
    expect(result.storageKey).toMatch(/\.webp$/);
    const filePath = join(assetsRoot, result.storageKey);
    expect(existsSync(filePath)).toBe(true);
  });

  it('returns service unavailable when DB write fails', async () => {
    const prisma = mockPrisma();
    (prisma.mediaAsset.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const service = new ImageStorageService(mockConfig(), mockLogger(), prisma, adapter);
    const file = createMockFile('fail.png', Buffer.from('bytes'));

    await expect(service.upload('products', file, undefined)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
