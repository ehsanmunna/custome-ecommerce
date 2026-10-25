import { randomUUID } from 'node:crypto';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export const MEDIA_VARIANTS = [
  { name: 'thumbnail', width: 160 },
  { name: 'card', width: 480 },
  { name: 'detail', width: 960 },
  { name: 'large', width: 1600 },
] as const;

export type MediaVariantName = (typeof MEDIA_VARIANTS)[number]['name'];

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface StoredObject {
  sizeBytes: number;
  mimeType: string;
}

export interface MediaStorage {
  isConfigured(): boolean;
  createUpload(key: string, mimeType: string, expiresInSeconds: number): Promise<PresignedUpload>;
  headObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
  publicUrl(key: string): string;
  variantUrl(key: string, width: number): string;
  isImageResizingEnabled(): boolean;
}

export class MediaStorageError extends Error {
  override readonly name = 'MediaStorageError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

const IMAGE_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export function isAllowedImageMime(mimeType: string): boolean {
  return Object.hasOwn(IMAGE_MIME_EXTENSIONS, mimeType);
}

export function createStorageKey(
  mimeType: string,
  now: Date = new Date(),
  id: string = randomUUID(),
): string {
  const extension = IMAGE_MIME_EXTENSIONS[mimeType];
  if (!extension) {
    throw new MediaStorageError('Unsupported media type');
  }

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `media/${year}/${month}/${id}.${extension}`;
}

export function encodeStorageKey(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function normalizePublicBaseUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}
