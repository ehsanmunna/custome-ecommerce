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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; CMS Pages
      </nav>

      <h1>CMS Pages</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('cms.pages.create')">+ New Page</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="pages.length; else emptyState">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of pages">
            <td>{{ localeTitle(p) }}</td>
            <td>{{ localeSlug(p) }}</td>
            <td>{{ localeStatus(p) }}</td>
            <td>
              <button (click)="openEditModal(p)" *ngIf="auth.hasPermission('cms.pages.update')">Edit</button>
              <button class="danger" (click)="deletePage(p.id)" *ngIf="auth.hasPermission('cms.pages.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No CMS pages found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create CMS Page</h2>
          <form [formGroup]="createForm" (ngSubmit)="createPage()">
            <div class="field">
              <label>Title (en)</label>
              <input formControlName="titleEn" />
            </div>
            <div class="field">
              <label>Slug (en)</label>
              <input formControlName="slugEn" />
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="statusEn">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field">
              <label>Body (en)</label>
              <textarea formControlName="bodyEn"></textarea>
            </div>
            <div class="field">
              <label>Title (bn)</label>
              <input formControlName="titleBn" />
            </div>
            <div class="field">
              <label>Slug (bn)</label>
              <input formControlName="slugBn" />
            </div>
            <div class="field">
              <label>Body (bn)</label>
              <textarea formControlName="bodyBn"></textarea>
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingPage" class="modal">
        <div class="modal-content">
          <h2>Edit CMS Page</h2>
          <form [formGroup]="editForm" (ngSubmit)="updatePage()">
            <div class="field">
              <label>Title (en)</label>
              <input formControlName="titleEn" />
            </div>
            <div class="field">
              <label>Slug (en)</label>
              <input formControlName="slugEn" />
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="statusEn">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field">
              <label>Body (en)</label>
              <textarea formControlName="bodyEn"></textarea>
            </div>
            <div class="field">
              <label>Title (bn)</label>
              <input formControlName="titleBn" />
            </div>
            <div class="field">
              <label>Slug (bn)</label>
              <input formControlName="slugBn" />
            </div>
            <div class="field">
              <label>Body (bn)</label>
              <textarea formControlName="bodyBn"></textarea>
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
    .field input, .field select, .field textarea { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
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
