import { Inject, Injectable } from '@angular/core';
import { AuthService } from '../../auth/auth.service';
import { ADMIN_AUTH_CONFIG, type AdminAuthConfig } from '../../auth/auth.config';

@Injectable({ providedIn: 'root' })
export class ImageService {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {}

  async fetch(url: string): Promise<Blob> {
    const absolute = url.startsWith('http')
      ? url
      : `${this.config.apiBaseUrl.replace(/\/+$/, '')}${url.startsWith('/') ? url : '/' + url}`;
    const headers: Record<string, string> = {};
    const token = this.auth.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(absolute, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    return response.blob();
  }

  createObjectUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  revokeObjectUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  async deleteMedia(mediaId: string): Promise<void> {
    const absolute = `${this.config.apiBaseUrl.replace(/\/+$/, '')}/v1/image-storage/${mediaId}`;
    const headers: Record<string, string> = {};
    const token = this.auth.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(absolute, { method: 'DELETE', headers });
    if (!response.ok) {
      throw new Error(`Failed to delete image: ${response.status} ${response.statusText}`);
    }
  }
}
