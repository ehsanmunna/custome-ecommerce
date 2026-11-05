import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';

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
  upload?: { url: string; method: string; headers: Record<string, string>; expiresAt: string };
  variants?: Record<string, unknown>;
  createdAt: string;
}

export interface MediaPage {
  items: MediaAsset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MediaUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  alt?: { bn?: string; en?: string };
}

export interface MediaUploadCompleteRequest {
  width?: number;
  height?: number;
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

  createModal = false;
  completeModal = false;
  creating = false;
  completing = false;
  pendingMedia: MediaAsset | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  completeForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      fileName: ['', Validators.required],
      mimeType: ['image/jpeg', Validators.required],
      sizeBytes: [0, Validators.required],
      altEn: [''],
    });
    this.completeForm = this.fb.group({
      width: [''],
      height: [''],
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
      .get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
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

  openCreateModal(): void {
    this.createForm.reset({ fileName: '', mimeType: 'image/jpeg', sizeBytes: 0, altEn: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createMediaUpload(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body: MediaUploadRequest = {
      fileName: value.fileName,
      mimeType: value.mimeType,
      sizeBytes: value.sizeBytes,
    };
    if (value.altEn) {
      body.alt = { en: value.altEn };
    }
    this.http
      .post<MediaAsset>(`${this.config.apiBaseUrl}/v1/admin/media`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap((res) => {
          this.pendingMedia = res ?? null;
          this.closeCreateModal();
          this.completeModal = true;
          return this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }),
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.media = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.media.create);
        },
        error: (err) => {
          this.creating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.media.createFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  closeCompleteModal(): void {
    this.completeModal = false;
    this.pendingMedia = null;
  }

  completeMediaUpload(): void {
    if (!this.pendingMedia) return;
    this.completing = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.completeForm.value;
    const body: MediaUploadCompleteRequest = {};
    if (value.width) body.width = Number(value.width);
    if (value.height) body.height = Number(value.height);
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/media/${this.pendingMedia.id}/complete`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        finalize(() => (this.completing = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeCompleteModal();
          this.media = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.media.complete);
        },
        error: (err) => {
          this.completing = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.media.completeFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  deleteMedia(id: string): void {
    if (!confirm('Delete this media?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/media/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.media = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.media.delete);
        },
        error: (err) => {
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.media.deleteFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
