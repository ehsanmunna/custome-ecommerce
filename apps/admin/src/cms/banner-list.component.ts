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
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Banners
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Banners</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('cms.banners.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Banner</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="banners.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Placement</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Title</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Sort Order</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Active</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of banners">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ b.placement }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ localeBannerTitle(b) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ b.sortOrder }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ b.active ? 'Yes' : 'No' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(b)" *ngIf="auth.hasPermission('cms.banners.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteBanner(b.id)" *ngIf="auth.hasPermission('cms.banners.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No banners found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Banner</h2>
          <form [formGroup]="createForm" (ngSubmit)="createBanner()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Placement</label>
              <input formControlName="placement" placeholder="e.g. homepage-hero" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Sort Order</label>
              <input type="number" formControlName="sortOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Media ID</label>
              <input formControlName="mediaId" placeholder="optional" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Active</label>
              <select formControlName="active" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (en)</label>
              <input formControlName="titleEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (en)</label>
              <input formControlName="bodyEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Destination URL (en)</label>
              <input formControlName="destinationUrlEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (bn)</label>
              <input formControlName="titleBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (bn)</label>
              <input formControlName="bodyBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Destination URL (bn)</label>
              <input formControlName="destinationUrlBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingBanner" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Banner</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateBanner()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Placement</label>
              <input formControlName="placement" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Sort Order</label>
              <input type="number" formControlName="sortOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Media ID</label>
              <input formControlName="mediaId" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Active</label>
              <select formControlName="active" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (en)</label>
              <input formControlName="titleEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (en)</label>
              <input formControlName="bodyEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Destination URL (en)</label>
              <input formControlName="destinationUrlEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (bn)</label>
              <input formControlName="titleBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (bn)</label>
              <input formControlName="bodyBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Destination URL (bn)</label>
              <input formControlName="destinationUrlBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class BannerListComponent implements OnInit {

  banners: Banner[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingBanner: Banner | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  readonly localeBannerTitle = localeBannerTitle;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {
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

  ngOnInit(): void {
    this.loadBanners();
  }

  loadBanners(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load banners';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.banners = res?.items ?? [];
      }
    });
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

  createBanner(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body = {
      placement: value.placement,
      sortOrder: Math.round(parseFloat(value.sortOrder)),
      active: value.active === true || value.active === 'true',
      ...(value.mediaId ? { mediaId: value.mediaId } : {}),
      content: this.buildContent(value),
    };
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/banners`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create banner';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.banners = res?.items ?? [];
      }
    });
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

  updateBanner(): void {
    if (!this.editingBanner || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body = {
      placement: value.placement,
      sortOrder: Math.round(parseFloat(value.sortOrder)),
      active: value.active === true || value.active === 'true',
      ...(value.mediaId ? { mediaId: value.mediaId } : {}),
      content: this.buildContent(value),
    };
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/banners/${this.editingBanner.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update banner';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.banners = res?.items ?? [];
      }
    });
  }

  deleteBanner(id: string): void {
    if (!confirm('Delete this banner?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/banners/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete banner';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.banners = res?.items ?? [];
      }
    });
  }
}

