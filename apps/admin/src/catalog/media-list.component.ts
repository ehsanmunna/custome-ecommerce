import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Media
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Media Library</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('media.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ Upload Media</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <div *ngIf="media.length; else emptyState" class="w-full border-collapse mb-4">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">File Name</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">MIME Type</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Size</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">URL</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Uploaded</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of media">
              <td class="border border-[var(--color-border)] p-2 text-left">{{ m.key }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ m.mimeType }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ (m.sizeBytes / 1024).toFixed(1) }} KB</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ m.url || '-' }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ m.createdAt }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">
                <button class="danger" (click)="deleteMedia(m.id)" *ngIf="auth.hasPermission('media.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyState>
        <p>No media assets found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Upload Media</h2>
          <form [formGroup]="createForm" (ngSubmit)="createMediaUpload()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">File Name</label>
              <input formControlName="fileName" placeholder="image.jpg" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">MIME Type</label>
              <select formControlName="mimeType" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="image/jpeg">image/jpeg</option>
                <option value="image/png">image/png</option>
                <option value="image/webp">image/webp</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Size (bytes)</label>
              <input type="number" formControlName="sizeBytes" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Alt Text (en)</label>
              <input formControlName="altEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create Upload</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="completeModal && pendingMedia" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Complete Upload: {{ pendingMedia.key }}</h2>
          <p class="mb-4">Upload URL: <a [href]="pendingMedia.upload?.url" target="_blank" class="text-[var(--color-primary)] underline">{{ pendingMedia.upload?.url }}</a></p>
          <p class="mb-4">Method: {{ pendingMedia.upload?.method }}</p>
          <form [formGroup]="completeForm" (ngSubmit)="completeMediaUpload()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Width (optional)</label>
              <input type="number" formControlName="width" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Height (optional)</label>
              <input type="number" formControlName="height" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="completing" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Complete</button>
            <button type="button" (click)="closeCompleteModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
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
    this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load media';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.media = res?.items ?? [];
      }
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
    this.http.post<MediaAsset>(
      `${this.config.apiBaseUrl}/v1/admin/media`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap((res) => {
        this.pendingMedia = res ?? null;
        this.closeCreateModal();
        this.completeModal = true;
        return this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create media upload';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.media = res?.items ?? [];
      }
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
    this.http.post(
      `${this.config.apiBaseUrl}/v1/admin/media/${this.pendingMedia.id}/complete`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to complete media upload';
        return EMPTY;
      }),
      finalize(() => this.completing = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCompleteModal();
        this.media = res?.items ?? [];
      }
    });
  }

  deleteMedia(id: string): void {
    if (!confirm('Delete this media?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/media/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete media';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.media = res?.items ?? [];
      }
    });
  }
}

