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

export interface Category {
  id: string;
  parentId?: string;
  status: string;
  sortOrder: number;
  content: Record<string, { name: string; slug: string; description?: string; metaTitle?: string; metaDescription?: string }>;
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Categories
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Categories</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.categories.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Category</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <ul *ngIf="rootCategories.length; else emptyState" class="list-none p-0">
        <li *ngFor="let c of rootCategories" class="border border-[var(--color-border)] rounded-md p-3 mb-2 bg-[var(--color-surface)]">
          <div class="flex justify-between items-center">
            <span>{{ c.content['en']?.name || c.content['bn']?.name || c.id }}</span>
            <span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ c.status }}</span>
            <div class="flex gap-1">
              <button (click)="openEditModal(c)" *ngIf="auth.hasPermission('catalog.categories.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteCategory(c.id)" *ngIf="auth.hasPermission('catalog.categories.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
              <button (click)="toggleChildren(c.id)" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">Children ({{ childCount(c.id) }})</button>
            </div>
          </div>
          <ul *ngIf="expanded[c.id]" class="ml-6 mt-2 pl-4 border-l-2 border-[var(--color-border)]">
            <li *ngFor="let child of childrenOf(c.id)" class="py-1 text-[var(--color-text-muted)] text-sm">
              {{ child.content['en']?.name || child.content['bn']?.name || child.id }}
            </li>
          </ul>
        </li>
      </ul>

      <ng-template #emptyState>
        <p>No categories found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Category</h2>
          <form [formGroup]="createForm" (ngSubmit)="createCategory()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Parent Category</label>
              <select formControlName="parentId" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="">None (root)</option>
                <option *ngFor="let c of categories" [value]="c.id">{{ c.content['en']?.name || c.content['bn']?.name || c.id }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Sort Order</label>
              <input type="number" formControlName="sortOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name (en)</label>
              <input formControlName="nameEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (en)</label>
              <input formControlName="slugEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name (bn)</label>
              <input formControlName="nameBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (bn)</label>
              <input formControlName="slugBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingCategory" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Category</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateCategory()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Sort Order</label>
              <input type="number" formControlName="sortOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name (en)</label>
              <input formControlName="nameEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (en)</label>
              <input formControlName="slugEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name (bn)</label>
              <input formControlName="nameBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (bn)</label>
              <input formControlName="slugBn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
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
    this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load categories';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.categories = res?.items ?? [];
        this.buildTree();
      }
    });
  }

  buildTree(): void {
    this.rootCategories = this.categories.filter(c => !c.parentId);
  }

  childCount(parentId: string): number {
    return this.categories.filter(c => c.parentId === parentId).length;
  }

  childrenOf(parentId: string): Category[] {
    return this.categories.filter(c => c.parentId === parentId);
  }

  toggleChildren(id: string): void {
    this.expanded[id] = !this.expanded[id];
  }

  openCreateModal(): void {
    this.createForm.reset({ parentId: '', status: 'active', sortOrder: 0, nameEn: '', slugEn: '', nameBn: '', slugBn: '' });
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
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/categories`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create category';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.categories = res?.items ?? [];
        this.buildTree();
      }
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
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/categories/${this.editingCategory.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update category';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.categories = res?.items ?? [];
        this.buildTree();
      }
    });
  }

  deleteCategory(id: string): void {
    if (!confirm('Delete this category?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/categories/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete category';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.categories = res?.items ?? [];
        this.buildTree();
      }
    });
  }
}

