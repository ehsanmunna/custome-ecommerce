import { Component, inject, OnInit } from '@angular/core';
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
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface BannerContent {
  title?: string;
  body?: string;
  destinationUrl?: string;
}

export interface Banner {
  id: string;
  placement: string;
  sortOrder: number;
  active: boolean;
  mediaId?: string;
  content: Record<string, BannerContent>;
}

export interface BannerPage {
  items: Banner[];
  total: number;
  page: number;
  pageSize: number;
}

function localeBannerTitle(banner: Banner): string {
  const entry = banner.content['en'] ?? Object.values(banner.content)[0];
  return entry?.title || '';
}

@Component({
  selector: 'app-banner-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Banners
      </nav>

      <h1>Banners</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('cms.banners.create')">+ New Banner</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="banners.length; else emptyState">
        <thead>
          <tr>
            <th>Placement</th>
            <th>Title</th>
            <th>Sort Order</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of banners">
            <td>{{ b.placement }}</td>
            <td>{{ localeBannerTitle(b) }}</td>
            <td>{{ b.sortOrder }}</td>
            <td>{{ b.active ? 'Yes' : 'No' }}</td>
            <td>
              <button (click)="openEditModal(b)" *ngIf="auth.hasPermission('cms.banners.update')">Edit</button>
              <button class="danger" (click)="deleteBanner(b.id)" *ngIf="auth.hasPermission('cms.banners.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No banners found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Banner</h2>
          <form [formGroup]="createForm" (ngSubmit)="createBanner()">
            <div class="field">
              <label>Placement</label>
              <input formControlName="placement" placeholder="e.g. homepage-hero" />
            </div>
            <div class="field">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
            <div class="field">
              <label>Media ID</label>
              <input formControlName="mediaId" placeholder="optional" />
            </div>
            <div class="field">
              <label>Active</label>
              <select formControlName="active">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="field">
              <label>Title (en)</label>
              <input formControlName="titleEn" />
            </div>
            <div class="field">
              <label>Body (en)</label>
              <input formControlName="bodyEn" />
            </div>
            <div class="field">
              <label>Destination URL (en)</label>
              <input formControlName="destinationUrlEn" />
            </div>
            <div class="field">
              <label>Title (bn)</label>
              <input formControlName="titleBn" />
            </div>
            <div class="field">
              <label>Body (bn)</label>
              <input formControlName="bodyBn" />
            </div>
            <div class="field">
              <label>Destination URL (bn)</label>
              <input formControlName="destinationUrlBn" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingBanner" class="modal">
        <div class="modal-content">
          <h2>Edit Banner</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateBanner()">
            <div class="field">
              <label>Placement</label>
              <input formControlName="placement" />
            </div>
            <div class="field">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
            <div class="field">
              <label>Media ID</label>
              <input formControlName="mediaId" />
            </div>
            <div class="field">
              <label>Active</label>
              <select formControlName="active">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="field">
              <label>Title (en)</label>
              <input formControlName="titleEn" />
            </div>
            <div class="field">
              <label>Body (en)</label>
              <input formControlName="bodyEn" />
            </div>
            <div class="field">
              <label>Destination URL (en)</label>
              <input formControlName="destinationUrlEn" />
            </div>
            <div class="field">
              <label>Title (bn)</label>
              <input formControlName="titleBn" />
            </div>
            <div class="field">
              <label>Body (bn)</label>
              <input formControlName="bodyBn" />
            </div>
            <div class="field">
              <label>Destination URL (bn)</label>
              <input formControlName="destinationUrlBn" />
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating">Save</button>
            <button type="button" (click)="closeEditModal()">Cancel</button>
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
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
  `,
})
export class BannerListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: { apiBaseUrl: string };

  banners: Banner[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingBanner: Banner | null = null;

  createForm: FormGroup;
  editForm: FormGroup;

  readonly localeBannerTitle = localeBannerTitle;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    fbOrInjector: FormBuilder = inject(FormBuilder),
    configOrInjector: { apiBaseUrl: string } = inject(ADMIN_AUTH_CONFIG),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.fb = fbOrInjector;
    this.config = configOrInjector;
    this.createForm = this.fb.group({
      placement: ['', Validators.required],
      sortOrder: [0, Validators.required],
      mediaId: [''],
      active: [true],
      titleEn: [''],
      bodyEn: [''],
      destinationUrlEn: [''],
      titleBn: [''],
      bodyBn: [''],
      destinationUrlBn: [''],
    });
    this.editForm = this.fb.group({
      placement: ['', Validators.required],
      sortOrder: [0, Validators.required],
      mediaId: [''],
      active: [true],
      titleEn: [''],
      bodyEn: [''],
      destinationUrlEn: [''],
      titleBn: [''],
      bodyBn: [''],
      destinationUrlBn: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadBanners();
  }

  async loadBanners(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<BannerPage>(`${this.config.apiBaseUrl}/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.banners = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load banners';
    } finally {
      this.loading = false;
    }
  }

  buildContent(value: any): Record<string, BannerContent> {
    const content: Record<string, BannerContent> = {};
    if (value.titleEn || value.bodyEn || value.destinationUrlEn) {
      content['en'] = {
        title: value.titleEn,
        body: value.bodyEn,
        destinationUrl: value.destinationUrlEn,
      };
    }
    if (value.titleBn || value.bodyBn || value.destinationUrlBn) {
      content['bn'] = {
        title: value.titleBn,
        body: value.bodyBn,
        destinationUrl: value.destinationUrlBn,
      };
    }
    return content;
  }

  openCreateModal(): void {
    this.createForm.reset({
      placement: '', sortOrder: 0, mediaId: '', active: true,
      titleEn: '', bodyEn: '', destinationUrlEn: '', titleBn: '', bodyBn: '', destinationUrlBn: '',
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createBanner(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body = {
        placement: value.placement,
        sortOrder: Math.round(parseFloat(value.sortOrder)),
        active: value.active === true || value.active === 'true',
        ...(value.mediaId ? { mediaId: value.mediaId } : {}),
        content: this.buildContent(value),
      };
      await this.http.post(`${this.config.apiBaseUrl}/admin/banners`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadBanners();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create banner';
    } finally {
      this.creating = false;
    }
  }

  openEditModal(banner: Banner): void {
    this.editingBanner = banner;
    const content = banner.content['en'] ?? Object.values(banner.content)[0] ?? {};
    this.editForm.reset({
      placement: banner.placement,
      sortOrder: banner.sortOrder,
      mediaId: banner.mediaId || '',
      active: banner.active,
      titleEn: content.title || '',
      bodyEn: content.body || '',
      destinationUrlEn: content.destinationUrl || '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingBanner = null;
  }

  async updateBanner(): Promise<void> {
    if (!this.editingBanner || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body = {
        placement: value.placement,
        sortOrder: Math.round(parseFloat(value.sortOrder)),
        active: value.active === true || value.active === 'true',
        ...(value.mediaId ? { mediaId: value.mediaId } : {}),
        content: this.buildContent(value),
      };
      await this.http.patch(`${this.config.apiBaseUrl}/admin/banners/${this.editingBanner.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadBanners();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update banner';
    } finally {
      this.updating = false;
    }
  }

  async deleteBanner(id: string): Promise<void> {
    if (!confirm('Delete this banner?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/admin/banners/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadBanners();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete banner';
    }
  }
}
