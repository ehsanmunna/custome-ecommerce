import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  encodeStorageKey,
  MediaStorage,
  MediaStorageError,
  normalizePublicBaseUrl,
  PresignedUpload,
  StoredObject,
} from './media-storage';

export interface R2StorageSettings {
  accountId?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  uploadTtlSeconds: number;
  imageResizingEnabled: boolean;
}

interface S3ClientLike {
  send(command: any): Promise<any>;
}

type Signer = (client: any, command: any, options: { expiresIn: number }) => Promise<string>;

export interface R2MediaStorageDependencies {
  client?: S3ClientLike;
  signer?: Signer;
}

export class R2MediaStorage implements MediaStorage {
  private readonly client?: S3ClientLike;
  private readonly signer: Signer;
  private readonly baseUrl: string | null;
  private readonly configured: boolean;

  constructor(
    private readonly settings: R2StorageSettings,
    dependencies: R2MediaStorageDependencies = {},
  ) {
    this.baseUrl = normalizePublicBaseUrl(settings.publicBaseUrl);
    this.configured = Boolean(
      settings.accountId &&
      settings.bucket &&
      settings.accessKeyId &&
      settings.secretAccessKey &&
      this.baseUrl,
    );
    this.signer = dependencies.signer ?? getSignedUrl;

    if (this.configured) {
      this.client =
        dependencies.client ??
        new S3Client({
          region: 'auto',
          endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
          forcePathStyle: true,
          credentials: {
            accessKeyId: settings.accessKeyId!,
            secretAccessKey: settings.secretAccessKey!,
          },
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  isImageResizingEnabled(): boolean {
    return this.settings.imageResizingEnabled;
  }

  async createUpload(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.requireBucket(),
      Key: key,
      ContentType: mimeType,
    });

    try {
      const url = await this.signer(this.requireClient(), command, {
        expiresIn: expiresInSeconds,
      });
      return {
        url,
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      };
    } catch (error) {
      throw new MediaStorageError('Could not create upload instruction', { cause: error });
    }
  }

  async headObject(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.requireClient().send(
        new HeadObjectCommand({ Bucket: this.requireBucket(), Key: key }),
      );
      const sizeBytes = Number(result?.ContentLength ?? 0);
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw new MediaStorageError('Stored object size is invalid');
      }

      return {
        sizeBytes,
        mimeType: typeof result?.ContentType === 'string' ? result.ContentType : '',
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      if (error instanceof MediaStorageError) throw error;
      throw new MediaStorageError('Could not inspect stored object', { cause: error });
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.requireClient().send(
        new DeleteObjectCommand({ Bucket: this.requireBucket(), Key: key }),
      );
    } catch (error) {
      throw new MediaStorageError('Could not delete stored object', { cause: error });
    }
  }

  publicUrl(key: string): string {
    return `${this.requireBaseUrl()}/${encodeStorageKey(key)}`;
  }

  variantUrl(key: string, width: number): string {
    return `${this.requireBaseUrl()}/cdn-cgi/image/width=${width},format=auto/${encodeStorageKey(key)}`;
  }

  private requireClient(): S3ClientLike {
    if (!this.client) {
      throw new MediaStorageError('Media storage is not configured');
    }
    return this.client;
  }

  private requireBucket(): string {
    if (!this.settings.bucket) {
      throw new MediaStorageError('Media storage is not configured');
    }
    return this.settings.bucket;
  }

  private requireBaseUrl(): string {
    if (!this.baseUrl) {
      throw new MediaStorageError('Media storage is not configured');
    }
    return this.baseUrl;
  }
}

function isMissingObject(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return status === 404 || error.name === 'NotFound' || error.name === 'NoSuchKey';
}
