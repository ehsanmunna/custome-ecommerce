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
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Categories
      </nav>

      <h1>Categories</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.categories.create')">+ New Category</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <ul *ngIf="rootCategories.length; else emptyState">
        <li *ngFor="let c of rootCategories" class="category-item">
          <div class="category-header">
            <span>{{ c.content?.['en']?.name || c.content?.['bn']?.name || c.id }}</span>
            <span class="status {{ c.status }}">{{ c.status }}</span>
            <div class="actions">
              <button (click)="openEditModal(c)" *ngIf="auth.hasPermission('catalog.categories.update')">Edit</button>
              <button class="danger" (click)="deleteCategory(c.id)" *ngIf="auth.hasPermission('catalog.categories.delete')">Delete</button>
              <button (click)="toggleChildren(c.id)">Children ({{ childCount(c.id) }})</button>
            </div>
          </div>
          <ul *ngIf="expanded[c.id]" class="children">
            <li *ngFor="let child of childrenOf(c.id)">
              {{ child.content?.['en']?.name || child.content?.['bn']?.name || child.id }}
            </li>
          </ul>
        </li>
      </ul>

      <ng-template #emptyState>
        <p>No categories found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Category</h2>
          <form [formGroup]="createForm" (ngSubmit)="createCategory()">
            <div class="field">
              <label>Parent Category</label>
              <select formControlName="parentId">
                <option value="">None (root)</option>
                <option *ngFor="let c of categories" [value]="c.id">{{ c.content?.['en']?.name || c.content?.['bn']?.name || c.id }}</option>
              </select>
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
            <div class="field">
              <label>Name (en)</label>
              <input formControlName="nameEn" />
            </div>
            <div class="field">
              <label>Slug (en)</label>
              <input formControlName="slugEn" />
            </div>
            <div class="field">
              <label>Name (bn)</label>
              <input formControlName="nameBn" />
            </div>
            <div class="field">
              <label>Slug (bn)</label>
              <input formControlName="slugBn" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingCategory" class="modal">
        <div class="modal-content">
          <h2>Edit Category</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateCategory()">
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
            <div class="field">
              <label>Name (en)</label>
              <input formControlName="nameEn" />
            </div>
            <div class="field">
              <label>Slug (en)</label>
              <input formControlName="slugEn" />
            </div>
            <div class="field">
              <label>Name (bn)</label>
              <input formControlName="nameBn" />
            </div>
            <div class="field">
              <label>Slug (bn)</label>
              <input formControlName="slugBn" />
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
    .error { color: #dc3545; margin-bottom: 1rem; }
    ul { list-style: none; padding: 0; }
    .category-item { border: 1px solid #ddd; border-radius: 4px; padding: 0.75rem; margin-bottom: 0.5rem; background: #fff; }
    .category-header { display: flex; justify-content: space-between; align-items: center; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; background: #e9ecef; color: #495057; }
    .status.active { background: #d4edda; color: #155724; }
    .status.archived { background: #f8d7da; color: #721c24; }
    .actions { display: flex; gap: 0.25rem; }
    .children { margin-left: 1.5rem; margin-top: 0.5rem; padding-left: 1rem; border-left: 2px solid #ddd; }
    .children li { padding: 0.25rem 0; color: #666; font-size: 0.9rem; }
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
  `,
})
export class CategoryListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: AdminAuthConfig;

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

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    fbOrInjector: FormBuilder = inject(FormBuilder),
    configOrInjector: AdminAuthConfig = inject(ADMIN_AUTH_CONFIG),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.fb = fbOrInjector;
    this.config = configOrInjector;
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

  async ngOnInit(): Promise<void> {
    await this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.categories = res?.items ?? [];
      this.buildTree();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load categories';
    } finally {
      this.loading = false;
    }
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

  async createCategory(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
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
      await this.http.post(`${this.config.apiBaseUrl}/admin/categories`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadCategories();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create category';
    } finally {
      this.creating = false;
    }
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

  async updateCategory(): Promise<void> {
    if (!this.editingCategory || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
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
      await this.http.patch(`${this.config.apiBaseUrl}/admin/categories/${this.editingCategory.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadCategories();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update category';
    } finally {
      this.updating = false;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    if (!confirm('Delete this category?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/admin/categories/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadCategories();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete category';
    }
  }
}
