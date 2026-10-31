import { Component, Inject, OnInit } from '@angular/core';
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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Media
      </nav>

      <h1>Media Library</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('media.create')">+ Upload Media</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="media.length; else emptyState">
        <table>
          <thead>
            <tr>
              <th>File Name</th>
              <th>MIME Type</th>
              <th>Size</th>
              <th>URL</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let m of media">
              <td>{{ m.key }}</td>
              <td>{{ m.mimeType }}</td>
              <td>{{ (m.sizeBytes / 1024).toFixed(1) }} KB</td>
              <td>{{ m.url || '-' }}</td>
              <td>{{ m.createdAt }}</td>
              <td>
                <button class="danger" (click)="deleteMedia(m.id)" *ngIf="auth.hasPermission('media.delete')">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyState>
        <p>No media assets found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Upload Media</h2>
          <form [formGroup]="createForm" (ngSubmit)="createMediaUpload()">
            <div class="field">
              <label>File Name</label>
              <input formControlName="fileName" placeholder="image.jpg" />
            </div>
            <div class="field">
              <label>MIME Type</label>
              <select formControlName="mimeType">
                <option value="image/jpeg">image/jpeg</option>
                <option value="image/png">image/png</option>
                <option value="image/webp">image/webp</option>
              </select>
            </div>
            <div class="field">
              <label>Size (bytes)</label>
              <input type="number" formControlName="sizeBytes" />
            </div>
            <div class="field">
              <label>Alt Text (en)</label>
              <input formControlName="altEn" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create Upload</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="completeModal && pendingMedia" class="modal">
        <div class="modal-content">
          <h2>Complete Upload: {{ pendingMedia.key }}</h2>
          <p>Upload URL: <a [href]="pendingMedia.upload?.url" target="_blank">{{ pendingMedia.upload?.url }}</a></p>
          <p>Method: {{ pendingMedia.upload?.method }}</p>
          <form [formGroup]="completeForm" (ngSubmit)="completeMediaUpload()">
            <div class="field">
              <label>Width (optional)</label>
              <input type="number" formControlName="width" />
            </div>
            <div class="field">
              <label>Height (optional)</label>
              <input type="number" formControlName="height" />
            </div>
            <button type="submit" [disabled]="completing">Complete</button>
            <button type="button" (click)="closeCompleteModal()">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button.danger { background: #dc3545; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
    a { color: #007bff; word-break: break-all; }
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

  createForm: FormGroup;
  completeForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
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

  async ngOnInit(): Promise<void> {
    await this.loadMedia();
  }

  async loadMedia(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<MediaPage>(`${this.config.apiBaseUrl}/v1/admin/media`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.media = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load media';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ fileName: '', mimeType: 'image/jpeg', sizeBytes: 0, altEn: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createMediaUpload(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
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
      const res = await this.http.post<MediaAsset>(
        `${this.config.apiBaseUrl}/v1/admin/media`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.pendingMedia = res ?? null;
      this.closeCreateModal();
      this.completeModal = true;
      await this.loadMedia();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create media upload';
    } finally {
      this.creating = false;
    }
  }

  closeCompleteModal(): void {
    this.completeModal = false;
    this.pendingMedia = null;
  }

  async completeMediaUpload(): Promise<void> {
    if (!this.pendingMedia) return;
    this.completing = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.completeForm.value;
      const body: MediaUploadCompleteRequest = {};
      if (value.width) body.width = Number(value.width);
      if (value.height) body.height = Number(value.height);
      await this.http.post(
        `${this.config.apiBaseUrl}/v1/admin/media/${this.pendingMedia.id}/complete`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.closeCompleteModal();
      await this.loadMedia();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to complete media upload';
    } finally {
      this.completing = false;
    }
  }

  async deleteMedia(id: string): Promise<void> {
    if (!confirm('Delete this media?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/media/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadMedia();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete media';
    }
  }
}
