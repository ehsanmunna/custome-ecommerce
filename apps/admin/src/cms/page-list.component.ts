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
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface CmsPageContent {
  slug: string;
  title?: string;
  body?: string;
  metaTitle?: string;
  metaDescription?: string;
  status: string;
}

export interface CmsPage {
  id: string;
  content: Record<string, CmsPageContent>;
}

export interface CmsPagePage {
  items: CmsPage[];
  total: number;
  page: number;
  pageSize: number;
}

function localeTitle(page: CmsPage): string {
  const content = page.content;
  const entry = content['en'] ?? Object.values(content)[0];
  return entry?.title || entry?.slug || '';
}

function localeSlug(page: CmsPage): string {
  const content = page.content;
  const entry = content['en'] ?? Object.values(content)[0];
  return entry?.slug || '';
}

@Component({
  selector: 'app-page-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; CMS Pages
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">CMS Pages</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('cms.pages.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Page</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="pages.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Title</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Slug</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of pages">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ localeTitle(p) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ localeSlug(p) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ localeStatus(p) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(p)" *ngIf="auth.hasPermission('cms.pages.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deletePage(p.id)" *ngIf="auth.hasPermission('cms.pages.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No CMS pages found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create CMS Page</h2>
          <form [formGroup]="createForm" (ngSubmit)="createPage()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (en)</label>
              <input formControlName="titleEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (en)</label>
              <input formControlName="slugEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="statusEn" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (en)</label>
              <textarea formControlName="bodyEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" rows="3"></textarea>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (bn)</label>
              <input formControlName="titleBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (bn)</label>
              <input formControlName="slugBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (bn)</label>
              <textarea formControlName="bodyBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" rows="3"></textarea>
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingPage" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit CMS Page</h2>
          <form [formGroup]="editForm" (ngSubmit)="updatePage()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (en)</label>
              <input formControlName="titleEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (en)</label>
              <input formControlName="slugEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="statusEn" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (en)</label>
              <textarea formControlName="bodyEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" rows="3"></textarea>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Title (bn)</label>
              <input formControlName="titleBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (bn)</label>
              <input formControlName="slugBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Body (bn)</label>
              <textarea formControlName="bodyBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" rows="3"></textarea>
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class PageListComponent implements OnInit {

  pages: CmsPage[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingPage: CmsPage | null = null;

  createForm: FormGroup;
  editForm: FormGroup;

  readonly localeTitle = localeTitle;
  readonly localeSlug = localeSlug;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {
    this.createForm = this.fb.group({
      titleEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      statusEn: ['draft'],
      bodyEn: [''],
      titleBn: [''],
      slugBn: [''],
      bodyBn: [''],
    });
    this.editForm = this.fb.group({
      titleEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      statusEn: ['draft'],
      bodyEn: [''],
      titleBn: [''],
      slugBn: [''],
      bodyBn: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadPages();
  }

  async loadPages(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<CmsPagePage>(`${this.config.apiBaseUrl}/v1/admin/pages`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.pages = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load CMS pages';
    } finally {
      this.loading = false;
    }
  }

  localeStatus(page: CmsPage): string {
    const content = page.content;
    const entry = content['en'] ?? Object.values(content)[0];
    return entry?.status || '';
  }

  buildContent(value: any): Record<string, CmsPageContent> {
    const content: Record<string, CmsPageContent> = {};
    if (value.slugEn) {
      content['en'] = {
        slug: value.slugEn,
        title: value.titleEn,
        body: value.bodyEn,
        status: value.statusEn || 'draft',
      };
    }
    if (value.slugBn) {
      content['bn'] = {
        slug: value.slugBn,
        title: value.titleBn,
        body: value.bodyBn,
        status: value.statusEn || 'draft',
      };
    }
    return content;
  }

  openCreateModal(): void {
    this.createForm.reset({
      titleEn: '', slugEn: '', statusEn: 'draft', bodyEn: '', titleBn: '', slugBn: '', bodyBn: '',
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createPage(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body = { content: this.buildContent(value) };
      await this.http.post(`${this.config.apiBaseUrl}/v1/admin/pages`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadPages();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create CMS page';
    } finally {
      this.creating = false;
    }
  }

  openEditModal(page: CmsPage): void {
    this.editingPage = page;
    const content = page.content['en'] ?? Object.values(page.content)[0] ?? {};
    this.editForm.reset({
      titleEn: content.title || '',
      slugEn: content.slug || '',
      statusEn: content.status || 'draft',
      bodyEn: content.body || '',
      titleBn: '',
      slugBn: '',
      bodyBn: '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingPage = null;
  }

  async updatePage(): Promise<void> {
    if (!this.editingPage || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body = { content: this.buildContent(value) };
      await this.http.patch(`${this.config.apiBaseUrl}/v1/admin/pages/${this.editingPage.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadPages();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update CMS page';
    } finally {
      this.updating = false;
    }
  }

  async deletePage(id: string): Promise<void> {
    if (!confirm('Delete this page?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/pages/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadPages();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete CMS page';
    }
  }
}
