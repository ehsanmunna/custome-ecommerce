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
  templateUrl: './page-list.component.html',
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

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  readonly localeTitle = localeTitle;
  readonly localeSlug = localeSlug;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
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

  ngOnInit(): void {
    this.loadPages();
  }

  loadPages(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<CmsPagePage>(`${this.config.apiBaseUrl}/v1/admin/pages`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load CMS pages';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.pages = res?.items ?? [];
      }
    });
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

  createPage(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body = { content: this.buildContent(value) };
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/pages`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CmsPagePage>(`${this.config.apiBaseUrl}/v1/admin/pages`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create CMS page';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.pages = res?.items ?? [];
      }
    });
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

  updatePage(): void {
    if (!this.editingPage || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body = { content: this.buildContent(value) };
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/pages/${this.editingPage.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CmsPagePage>(`${this.config.apiBaseUrl}/v1/admin/pages`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update CMS page';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.pages = res?.items ?? [];
      }
    });
  }

  deletePage(id: string): void {
    if (!confirm('Delete this page?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/pages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CmsPagePage>(`${this.config.apiBaseUrl}/v1/admin/pages`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete CMS page';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.pages = res?.items ?? [];
      }
    });
  }
}

