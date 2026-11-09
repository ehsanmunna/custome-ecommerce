import 'reflect-metadata';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ImageStorageController } from '../src/image-storage/image-storage.controller';
import { ImageStorageService } from '../src/image-storage/image-storage.service';
import { LocalStorageAdapter } from '../src/image-storage/local-storage.adapter';
import { storageAdapterOptions } from '../src/image-storage/image-storage.service';
import { AppConfigService } from '../src/platform/config/app-config.service';
import { StructuredLogger } from '../src/platform/logging/structured-logger';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../src/platform/database/prisma.service';

describe('image-storage integration (controller + service level)', () => {
  const assetsRoot = mkdtempSync(join(tmpdir(), 'image-storage-integration-'));
  const adapter = new LocalStorageAdapter({
    ...storageAdapterOptions,
    root: assetsRoot,
  });
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async () => ({
        id: 'admin-id',
        status: 'active',
        role: {
          scope: 'store',
          permissions: [
            { permission: { key: 'image-storage.read' } },
            { permission: { key: 'image-storage.create' } },
          ],
        },
      })),
    },
    mediaAsset: {
      create: vi.fn(async (args: any) => ({
        id: 'media-id-' + Date.now(),
        ...args.data,
      })),
      findUnique: vi.fn(async (args: any) => {
        const sk = args.where.storageKey ?? args.where.provider_storageKey?.storageKey;
        if (sk === 'missing-key') return null;
        return { id: 'media-id-1', mimeType: 'image/png', sizeBytes: BigInt(100) };
      }),
      delete: vi.fn(async () => ({})),
    },
  };
  const config = {} as unknown as AppConfigService;
  const logger = { log: vi.fn(), error: vi.fn() };
  let controller: ImageStorageController;
  let service: ImageStorageService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImageStorageController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AppConfigService, useValue: config },
        { provide: StructuredLogger, useValue: logger },
        {
          provide: 'STORAGE_ADAPTER',
          useFactory: () => adapter,
        },
        ImageStorageService,
        ImageStorageController,
      ],
    }).compile();

    controller = moduleRef.get(ImageStorageController);
    service = moduleRef.get(ImageStorageService);
  });

  afterAll(async () => {
    rmSync(assetsRoot, { recursive: true, force: true });
  });

  function pngBuffer(): Buffer {
    return Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x04, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0xf8, 0x0f, 0x00, 0x01,
      0x01, 0x00, 0x1a, 0x7b, 0x5d, 0x68, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
      0x60, 0x82,
    ]);
  }

  function createMockFile(originalname: string, buffer: Buffer) {
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
    };
  }

  it('uploads and returns mediaId, stores file under feature subfolder', async () => {
    const file = createMockFile('product.png', pngBuffer());

    const result = await controller.upload(file, { body: { feature: 'products', alt: JSON.stringify({ en: 'Product image' }) } });

    expect(result.mediaId).toBeDefined();
    expect(result.feature).toBe('products');
    expect(result.mimeType).toBe('image/png');
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.storageKey).toMatch(/\d{4}\/\d{2}\/[0-9a-f-]+\/original\.webp/);
    expect(result.url).toContain('image-storage/serve');
    expect(result.url).toContain('storageKey=');

    const filePath = join(assetsRoot, result.storageKey);
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath).length).toBeGreaterThan(0);

    // Verify media_assets row was created
    expect(prisma.mediaAsset.create).toHaveBeenCalledWith({
      data: {
        provider: 'local',
        storageKey: result.storageKey,
        mimeType: 'image/png',
        sizeBytes: expect.any(BigInt),
        width: null,
        height: null,
      },
      select: { id: true },
    });
  });

  it('serves the exact bytes that were uploaded via service', async () => {
    const file = createMockFile('photo.png', pngBuffer());

    const uploadResult = await controller.upload(file, { body: { feature: 'categories' } });

    const serveResult = await service.serve(uploadResult.storageKey);

    expect(serveResult.mimeType).toBe('image/png');
    expect(serveResult.size).toBeGreaterThan(0);
    expect(serveResult.stream).toBeDefined();

    const chunks: Buffer[] = [];
    for await (const chunk of serveResult.stream!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    expect(Buffer.concat(chunks)).toEqual(pngBuffer());
  });

  it('rejects upload without file', async () => {
    await expect(
      controller.upload(undefined as any, { body: { feature: 'products' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid feature', async () => {
    const file = createMockFile('test.png', pngBuffer());

    await expect(
      controller.upload(file, { body: { feature: '../etc' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for serving missing image via service', async () => {
    await expect(
      service.serve('missing-key'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
