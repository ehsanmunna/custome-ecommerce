import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';

import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';
import { ImageService } from '../core/image-storage/image-storage.service';

export interface MediaAsset {
  id: string;
  provider: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  alt?: { bn?: string; en?: string };
  url?: string;
  createdAt: string;
}

export interface MediaPage {
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-media-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './media-list.component.html',
})
export class MediaListComponent implements OnInit {
  media: MediaAsset[] = [];

  loading = false;
  error: string | null = null;

  uploadModal = false;
  uploading = false;

  deleting = false;

  imageUrls: Record<string, string> = {};

  private readonly destroyRef = inject(DestroyRef);

  uploadForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    private readonly notification: NotificationService,
    private readonly imageService: ImageService,
  ) {
    this.uploadForm = this.fb.group({
      file: [null, Validators.required],
      altEn: [''],
    });

    this.destroyRef.onDestroy(() => {
      for (const url of Object.values(this.imageUrls)) {
        this.imageService.revokeObjectUrl(url);
      }
      this.imageUrls = {};
    });
  }

  ngOnInit(): void {
    this.loadMedia();
  }

  loadMedia(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<MediaPage>(`${this.config.apiBaseUrl}/v1/image-storage/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load media';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.media = res?.items ?? [];
          this.prefetchImages();
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load media');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  openUploadModal(): void {
    this.uploadForm.reset({ altEn: '' });
    this.uploadModal = true;
  }

  closeUploadModal(): void {
    this.uploadModal = false;
  }

  uploadFile(): void {
    if (this.uploadForm.invalid) return;
    this.uploading = true;
    this.error = null;
    const token = this.auth.token;
    const formData = new FormData();
    formData.append('file', this.uploadForm.value.file);
    formData.append('feature', 'products');
    if (this.uploadForm.value.altEn) {
      formData.append('alt', JSON.stringify({ en: this.uploadForm.value.altEn }));
    }
    this.http
      .post<MediaAsset>(`${this.config.apiBaseUrl}/v1/image-storage/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap((_res) => {
          this.closeUploadModal();
          return this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/image-storage/list`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }),
        finalize(() => (this.uploading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.media = res?.items ?? [];
          this.prefetchImages();
          this.notification.success(NOTIFICATION_MESSAGES.media.create);
        },
        error: (err) => {
          this.uploading = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.media.createFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  deleteMedia(m: MediaAsset): void {
    if (!confirm(`Delete "${m.key}"?`)) return;
    this.deleting = true;
    this.error = null;
    this.imageService
      .deleteMedia(m.id)
      .then(() => {
        this.media = this.media.filter((x) => x.id !== m.id);
        const url = this.imageUrls[m.id];
        if (url) {
          this.imageService.revokeObjectUrl(url);
          delete this.imageUrls[m.id];
        }
        this.deleting = false;
        this.notification.success(NOTIFICATION_MESSAGES.media.delete);
      })
      .catch((err) => {
        this.deleting = false;
        this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.media.deleteFailed);
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      });
  }

  private getImageUrl(m: MediaAsset): void {
    if (!m.url || this.imageUrls[m.id]) return;
    this.imageService
      .fetch(m.url)
      .then((blob) => {
        this.imageUrls[m.id] = this.imageService.createObjectUrl(blob);
      })
      .catch(() => {
        // silently ignore failed image fetches
      });
  }

  private prefetchImages(): void {
    for (const m of this.media) {
      this.getImageUrl(m);
    }
  }
}
