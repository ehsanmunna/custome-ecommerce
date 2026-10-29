import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from 'database';
import { AppConfigService } from '../platform/config/app-config.service';
import { PrismaService } from '../platform/database/prisma.service';
import { StructuredLogger } from '../platform/logging/structured-logger';
import { MediaCompleteInput, MediaUploadInput } from './media.schemas';
import {
  createStorageKey,
  isAllowedImageMime,
  MEDIA_STORAGE,
  MEDIA_VARIANTS,
  MediaStorage,
  MediaStorageError,
  MediaVariantName,
  PresignedUpload,
} from './media-storage';

const mediaInclude = { altTexts: true } satisfies Prisma.MediaAssetInclude;

type MediaRecord = Prisma.MediaAssetGetPayload<{ include: typeof mediaInclude }>;

export interface MediaVariants {
  thumbnail: { url: string; width: number };
  card: { url: string; width: number };
  detail: { url: string; width: number };
  large: { url: string; width: number };
}

export interface MediaAssetView {
  id: string;
  provider: 'r2';
  key: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt: Record<string, string>;
  url: string;
  upload?: PresignedUpload;
  variants?: MediaVariants;
  createdAt: string;
}

export interface MediaPage {
  items: MediaAssetView[];
  total: number;
  page: number;
  pageSize: number;
}

interface PageInput {
  page: number;
  pageSize: number;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}

  async list(input: PageInput): Promise<MediaPage> {
    this.assertConfigured();

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

  async createUpload(input: MediaUploadInput): Promise<MediaAssetView> {
    this.assertConfigured();

    if (!isAllowedImageMime(input.mimeType)) {
      throw new BadRequestException('Unsupported media type');
    }
    if (input.sizeBytes > this.config.r2MaxUploadBytes) {
      throw new BadRequestException('Media file exceeds the configured upload limit');
    }

    const storageKey = createStorageKey(input.mimeType);
    const upload = await this.createUploadInstruction(storageKey, input.mimeType);

    let record: MediaRecord;
    try {
      record = await this.prisma.mediaAsset.create({
        data: {
          provider: 'r2',
          storageKey,
          mimeType: input.mimeType,
          sizeBytes: BigInt(input.sizeBytes),
          altTexts: { create: localizedAltRows(input.alt) },
        },
        include: mediaInclude,
      });
    } catch (error) {
      this.mapWriteError(error);
    }

    this.logger.log({
      event: 'media.upload.created',
      mediaId: record.id,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
    });

    return this.mapMedia(record, upload);
  }

  async completeUpload(id: string, input: MediaCompleteInput): Promise<MediaAssetView> {
    this.assertConfigured();

    if ((input.width === undefined) !== (input.height === undefined)) {
      throw new BadRequestException('Width and height must be provided together');
    }

    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: mediaInclude,
    });
    if (!existing) throw new NotFoundException('Media asset not found');

    const stored = await this.headStoredObject(existing.storageKey);
    if (!stored) {
      throw new ConflictException('Media upload has not been received');
    }
    if (!isAllowedImageMime(stored.mimeType)) {
      throw new UnprocessableEntityException('Stored object type is not supported');
    }
    if (stored.sizeBytes > this.config.r2MaxUploadBytes) {
      throw new UnprocessableEntityException('Stored object exceeds the configured upload limit');
    }

    let record: MediaRecord;
    try {
      record = await this.prisma.mediaAsset.update({
        where: { id },
        data: {
          mimeType: stored.mimeType,
          sizeBytes: BigInt(stored.sizeBytes),
          ...(input.width !== undefined && input.height !== undefined
            ? { width: input.width, height: input.height }
            : {}),
        },
        include: mediaInclude,
      });
    } catch (error) {
      this.mapWriteError(error);
    }

    this.logger.log({
      event: 'media.upload.completed',
      mediaId: record.id,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
    });

    return this.mapMedia(record);
  }

  async delete(id: string): Promise<void> {
    this.assertConfigured();

    const existing = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: { id: true, storageKey: true },
    });
    if (!existing) throw new NotFoundException('Media asset not found');

    try {
      await this.prisma.mediaAsset.delete({ where: { id } });
    } catch (error) {
      this.mapWriteError(error);
    }

    try {
      await this.storage.deleteObject(existing.storageKey);
    } catch (error) {
      this.logger.error(
        {
          event: 'media.cleanup.failed',
          mediaId: existing.id,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        MediaService.name,
      );
    }

    this.logger.log({ event: 'media.deleted', mediaId: existing.id });
  }

  private mapMedia(record: MediaRecord, upload?: PresignedUpload): MediaAssetView {
    const sizeBytes = Number(record.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes)) {
      throw new Error('Media size exceeds the safe JSON integer range');
    }

    return {
      id: record.id,
      provider: record.provider,
      key: record.storageKey,
      mimeType: record.mimeType,
      sizeBytes,
      ...(record.width !== null ? { width: record.width } : {}),
      ...(record.height !== null ? { height: record.height } : {}),
      alt: Object.fromEntries(record.altTexts.map(({ locale, altText }) => [locale, altText])),
      url: this.storage.publicUrl(record.storageKey),
      ...(upload ? { upload } : {}),
      ...(this.storage.isImageResizingEnabled() && record.mimeType.startsWith('image/')
        ? { variants: this.mapVariants(record.storageKey) }
        : {}),
      createdAt: record.createdAt.toISOString(),
    };
  }

  private mapVariants(storageKey: string): MediaVariants {
    return Object.fromEntries(
      MEDIA_VARIANTS.map(({ name, width }) => [
        name,
        { url: this.storage.variantUrl(storageKey, width), width },
      ]),
    ) as Record<MediaVariantName, { url: string; width: number }>;
  }

  private async createUploadInstruction(
    storageKey: string,
    mimeType: string,
  ): Promise<PresignedUpload> {
    try {
      return await this.storage.createUpload(storageKey, mimeType, this.config.r2UploadTtlSeconds);
    } catch (error) {
      this.logger.error(
        {
          event: 'media.storage.failed',
          operation: 'createUpload',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        MediaService.name,
      );
      throw new ServiceUnavailableException('Media storage is unavailable');
    }
  }

  private async headStoredObject(storageKey: string) {
    try {
      return await this.storage.headObject(storageKey);
    } catch (error) {
      this.logger.error(
        {
          event: 'media.storage.failed',
          operation: 'headObject',
          errorType: error instanceof Error ? error.name : 'UnknownError',
        },
        undefined,
        MediaService.name,
      );
      throw new ServiceUnavailableException('Media storage is unavailable');
    }
  }

  private assertConfigured() {
    if (!this.storage.isConfigured()) {
      throw new ServiceUnavailableException('Media storage is not configured');
    }
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Media value already exists');
      if (error.code === 'P2003') throw new ConflictException('Media record is still referenced');
      if (error.code === 'P2025') throw new NotFoundException('Media asset not found');
    }
    if (error instanceof MediaStorageError) {
      throw new ServiceUnavailableException('Media storage is unavailable');
    }
    throw error;
  }
}

function localizedAltRows(alt: MediaUploadInput['alt']): Array<{
  locale: 'bn' | 'en';
  altText: string;
}> {
  if (!alt) return [];
  return (['bn', 'en'] as const).flatMap((locale) => {
    const altText = alt[locale];
    return altText === undefined ? [] : [{ locale, altText }];
  });
}
