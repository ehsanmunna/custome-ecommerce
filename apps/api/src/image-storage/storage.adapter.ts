export interface StorageAdapter {
  put(key: string, stream: NodeJS.ReadableStream): Promise<void>;
  get(key: string): Promise<NodeJS.ReadableStream | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
}

export interface StorageAdapterOptions {
  root: string;
  publicBaseUrl: string;
}
