import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import { AppConfigService } from '../platform/config/app-config.service';
import { StructuredLogger } from '../platform/logging/structured-logger';
import { ImageStorageUploadInput } from './image-storage.schemas';
import { StorageAdapter, StorageAdapterOptions } from './storage.adapter';
import { LocalStorageAdapter } from './local-storage.adapter';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
  stream: NodeJS.ReadableStream;
}

const ALLOWED_FEATURES = ['products', 'categories', 'brands', 'banners'] as const;
type Feature = (typeof ALLOWED_FEATURES)[number];

const DEFAULT_ASSETS_ROOT = 'assets';
const DEFAULT_PUBLIC_BASE_URL = '/v1/image-storage/serve';

function sanitizeFeature(feature: string): Feature {
  if (!ALLOWED_FEATURES.includes(feature as Feature)) {
    throw new BadRequestException(`Invalid feature: ${feature}`);
  }
  return feature as Feature;
}

function sanitizeFilename(filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (clean.includes('..') || clean.startsWith('.')) {
    throw new BadRequestException('Invalid filename');
  }
  return clean;
}

interface PageInput {
  page: number;
  pageSize: number;
}

interface MediaAssetView {
  id: string;
  provider: 'local';
  key: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt: Record<string, string>;
  url: string;
  createdAt: string;
}

export interface MediaPage {
  items: MediaAssetView[];
  total: number;
  page: number;
  pageSize: number;
}

const mediaInclude = { altTexts: true } satisfies Prisma.MediaAssetInclude;

type MediaRecord = Prisma.MediaAssetGetPayload<{ include: typeof mediaInclude }>;

@Injectable()
export class ImageStorageService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('STORAGE_ADAPTER') private readonly adapter: StorageAdapter,
  ) {}

  async upload(
    feature: string,
    file: MulterFile,
    alt: ImageStorageUploadInput['alt'],
  ): Promise<{
    mediaId: string;
    url: string;
    feature: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const sanitizedFeature = sanitizeFeature(feature);
    const sanitizedFilename = sanitizeFilename(file.originalname);

    const storageKey = (this.adapter as LocalStorageAdapter).createKey('original');

    const buffer = file.buffer ?? Buffer.from([]);
    const stream = (async function* () {
      yield buffer;
    })() as unknown as NodeJS.ReadableStream;

    try {
      await this.adapter.put(storageKey, stream);
    } catch (error) {
      this.logger.error(
        {
          event: 'image.storage.failed',
          operation: 'put',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        ImageStorageService.name,
      );
      throw new ServiceUnavailableException('Image storage is unavailable');
    }

    let mediaAsset;
    try {
      mediaAsset = await this.prisma.mediaAsset.create({
        data: {
          provider: 'local',
          storageKey,
          mimeType: file.mimetype,
          sizeBytes: BigInt(buffer.length),
          width: null,
          height: null,
        },
        select: { id: true },
      });
    } catch (error) {
      // Clean up the uploaded file if DB write fails
      try {
        await this.adapter.delete(storageKey);
      } catch {
        // Ignore cleanup errors
      }
      this.logger.error(
        {
          event: 'image.storage.failed',
          operation: 'createMediaAsset',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        ImageStorageService.name,
      );
      throw new ServiceUnavailableException('Image storage is unavailable');
    }

    const publicUrl = this.adapter.getPublicUrl(storageKey);

    this.logger.log({
      event: 'image.upload.created',
      feature: sanitizedFeature,
      filename: sanitizedFilename,
      mimeType: file.mimetype,
      sizeBytes: buffer.length,
      storageKey,
      mediaId: mediaAsset.id,
      alt,
    });

    return {
      mediaId: mediaAsset.id,
      url: publicUrl,
      feature: sanitizedFeature,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: buffer.length,
    };
  }

  async serve(
    storageKey: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    size: number;
  }> {
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { provider_storageKey: { provider: 'local', storageKey } },
      select: { mimeType: true, sizeBytes: true },
    });

    if (!mediaAsset) {
      throw new NotFoundException('Image not found');
    }

    const stream = await this.adapter.get(storageKey);
    if (!stream) {
      throw new NotFoundException('Image not found');
    }

    return {
      stream,
      mimeType: mediaAsset.mimeType,
      size: Number(mediaAsset.sizeBytes),
    };
  }

  async remove(storageKey: string): Promise<void> {
    const mediaAsset = await this.prisma.mediaAsset.findUnique({
      where: { provider_storageKey: { provider: 'local', storageKey } },
      select: { id: true },
    });

    if (!mediaAsset) {
      throw new NotFoundException('Image not found');
    }

    try {
      await this.adapter.delete(storageKey);
    } catch (error) {
      this.logger.error(
        {
          event: 'image.storage.failed',
          operation: 'delete',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        ImageStorageService.name,
      );
      throw new ServiceUnavailableException('Image storage is unavailable');
    }

    await this.prisma.mediaAsset.delete({
      where: { id: mediaAsset.id },
    });
  }

  private mapMedia(record: MediaRecord): MediaAssetView {
    return {
      id: record.id,
      provider: 'local' as const,
      key: record.storageKey,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
      width: record.width ?? undefined,
      height: record.height ?? undefined,
      alt: Object.fromEntries(record.altTexts.map(({ locale, altText }) => [locale, altText])),
      url: this.adapter.getPublicUrl(record.storageKey),
      createdAt: record.createdAt.toISOString(),
    };
  }

  async list(input: PageInput): Promise<MediaPage> {
    const [rows, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        include: mediaInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.mediaAsset.count(),
    ]);

    return {
      items: rows.map((row) => this.mapMedia(row)),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}

export const storageAdapterOptions: StorageAdapterOptions = {
  root: DEFAULT_ASSETS_ROOT,
  publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
};
