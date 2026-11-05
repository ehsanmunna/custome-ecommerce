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

export interface Category {
  id: string;
  parentId?: string;
  status: string;
  sortOrder: number;
  content: Record<
    string,
    {
      name: string;
      slug: string;
      description?: string;
      metaTitle?: string;
      metaDescription?: string;
    }
  >;
  imageId?: string;
}

export interface CategoryPage {
  items: Category[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './category-list.component.html',
})
export class CategoryListComponent implements OnInit {
  categories: Category[] = [];
  rootCategories: Category[] = [];
  expanded: Record<string, boolean> = {};

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingCategory: Category | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      parentId: [''],
      status: ['active'],
      sortOrder: [0],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      nameBn: [''],
      slugBn: [''],
    });
    this.editForm = this.fb.group({
      status: ['active', Validators.required],
      sortOrder: [0],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      nameBn: [''],
      slugBn: [''],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load categories';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.categories = res?.items ?? [];
          this.buildTree();
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load categories');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  buildTree(): void {
    this.rootCategories = this.categories.filter((c) => !c.parentId);
  }

  childCount(parentId: string): number {
    return this.categories.filter((c) => c.parentId === parentId).length;
  }

  childrenOf(parentId: string): Category[] {
    return this.categories.filter((c) => c.parentId === parentId);
  }

  toggleChildren(id: string): void {
    this.expanded[id] = !this.expanded[id];
  }

  openCreateModal(): void {
    this.createForm.reset({
      parentId: '',
      status: 'active',
      sortOrder: 0,
      nameEn: '',
      slugEn: '',
      nameBn: '',
      slugBn: '',
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createCategory(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body: any = {
      status: value.status,
      sortOrder: value.sortOrder,
      content: {
        en: { name: value.nameEn, slug: value.slugEn },
      },
    };
    if (value.parentId) body.parentId = value.parentId;
    if (value.nameBn || value.slugBn) {
      body.content.bn = { name: value.nameBn, slug: value.slugBn };
    }
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/categories`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeCreateModal();
          this.categories = res?.items ?? [];
          this.buildTree();
          this.notification.success(NOTIFICATION_MESSAGES.category.create);
        },
        error: (err) => {
          this.creating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.category.createFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  openEditModal(category: Category): void {
    this.editingCategory = category;
    this.editForm.reset({
      status: category.status,
      sortOrder: category.sortOrder,
      nameEn: category.content?.['en']?.name || '',
      slugEn: category.content?.['en']?.slug || '',
      nameBn: category.content?.['bn']?.name || '',
      slugBn: category.content?.['bn']?.slug || '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingCategory = null;
  }

  updateCategory(): void {
    if (!this.editingCategory || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body: any = {
      status: value.status,
      sortOrder: value.sortOrder,
      content: {
        en: { name: value.nameEn, slug: value.slugEn },
      },
    };
    if (value.nameBn || value.slugBn) {
      body.content.bn = { name: value.nameBn, slug: value.slugBn };
    }
    this.http
      .patch(`${this.config.apiBaseUrl}/v1/admin/categories/${this.editingCategory.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        finalize(() => (this.updating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeEditModal();
          this.categories = res?.items ?? [];
          this.buildTree();
          this.notification.success(NOTIFICATION_MESSAGES.category.update);
        },
        error: (err) => {
          this.updating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.category.updateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  deleteCategory(id: string): void {
    if (!confirm('Delete this category?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.categories = res?.items ?? [];
          this.buildTree();
          this.notification.success(NOTIFICATION_MESSAGES.category.delete);
        },
        error: (err) => {
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.category.deleteFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
