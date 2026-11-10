import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { StorageAdapter, StorageAdapterOptions } from './storage.adapter';

const ALLOWED_VARIANTS = ['original', 'thumb', 'card', 'detail'] as const;
type Variant = (typeof ALLOWED_VARIANTS)[number];

export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly publicBaseUrl: string;

  constructor(options: StorageAdapterOptions) {
    this.root = options.root;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, '');
  }

  async put(key: string, stream: NodeJS.ReadableStream): Promise<void> {
    this.validateKey(key);

    const filePath = join(this.root, key);
    const directory = join(this.root, ...key.split('/').slice(0, -1));
    mkdirSync(directory, { recursive: true });

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
    }
    writeFileSync(filePath, Buffer.concat(chunks));
  }

  async get(key: string): Promise<Readable | null> {
    this.validateKey(key);

    const filePath = join(this.root, key);
    if (!existsSync(filePath)) {
      return null;
    }
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    this.validateKey(key);

    const filePath = join(this.root, key);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    this.validateKey(key);
    return existsSync(join(this.root, key));
  }

  getPublicUrl(key: string): string {
    this.validateKey(key);
    return `${this.publicBaseUrl}?storageKey=${encodeURIComponent(key)}`;
  }

  createKey(variant: Variant, id: string = randomUUID(), now: Date = new Date()): string {
    const year = now.getUTCFullYear().toString().padStart(4, '0');
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${year}/${month}/${id}/${variant}.webp`;
  }

  private validateKey(key: string): void {
    const parts = key.split('/');
    if (parts.length !== 4) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const [year, month, uuidDir, variantFile] = parts;
    if (!/^\d{4}$/.test(year)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    if (!/^\d{2}$/.test(month)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidDir)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const variant = variantFile.replace('.webp', '');
    if (!ALLOWED_VARIANTS.includes(variant as Variant)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
  }
}
