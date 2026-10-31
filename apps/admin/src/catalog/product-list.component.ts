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
import { AdminAuthConfig } from '../auth/auth.config';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface Product {
  id: string;
  categoryId: string;
  brandId?: string;
  status: string;
  content: Record<string, { name: string; slug: string; description?: string; metaTitle?: string; metaDescription?: string }>;
  variants: Array<{ id: string; sku: string; price: number; status: string; attributes: Record<string, unknown> }>;
  media: Array<{ id: string; url: string; type: string }>;
}

export interface ProductPage {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

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

export interface Brand {
  id: string;
  status: string;
  content: Record<string, { name: string; slug: string; description?: string; metaTitle?: string; metaDescription?: string }>;
  image?: { id: string; url: string; type: string };
}

export interface BrandPage {
  items: Brand[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Products
      </nav>

      <h1>Products</h1>

      <div class="toolbar">
        <input type="text" placeholder="Search products..." [(ngModel)]="searchQuery" />
        <button (click)="loadProducts()">Search</button>
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.products.create')">+ New Product</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="products.length; else emptyState">
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Brand</th>
            <th>Status</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of products">
            <td>{{ p.content?.['en']?.name || p.content?.['bn']?.name }}</td>
            <td>{{ p.variants?.[0]?.sku || '-' }}</td>
            <td>{{ categoryNames[p.categoryId] || p.categoryId }}</td>
            <td>{{ brandNames[p.brandId || ''] || '-' }}</td>
            <td>{{ p.status }}</td>
            <td>{{ p.variants?.[0]?.price?.toFixed(2) || '-' }}</td>
            <td>
              <button (click)="openEditModal(p)" *ngIf="auth.hasPermission('catalog.products.update')">Edit</button>
              <button class="danger" (click)="deleteProduct(p.id)" *ngIf="auth.hasPermission('catalog.products.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No products found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Product</h2>
          <form [formGroup]="createForm" (ngSubmit)="createProduct()">
            <div class="field">
              <label>Category</label>
              <select formControlName="categoryId">
                <option *ngFor="let c of categories" [value]="c.id">{{ c.content?.['en']?.name || c.content?.['bn']?.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>Brand</label>
              <select formControlName="brandId">
                <option value="">None</option>
                <option *ngFor="let b of brands" [value]="b.id">{{ b.content?.['en']?.name || b.content?.['bn']?.name }}</option>
              </select>
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
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
              <label>Variant SKU</label>
              <input formControlName="variantSku" />
            </div>
            <div class="field">
              <label>Variant Price</label>
              <input type="number" formControlName="variantPrice" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingProduct" class="modal">
        <div class="modal-content">
          <h2>Edit Product</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateProduct()">
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field">
              <label>Name (en)</label>
              <input formControlName="nameEn" />
            </div>
            <div class="field">
              <label>Slug (en)</label>
              <input formControlName="slugEn" />
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating">Save</button>
            <button type="button" (click)="closeEditModal()">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1200px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .toolbar input { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; flex: 1; min-width: 200px; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button.danger { background: #dc3545; color: white; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .error { color: #dc3545; margin-bottom: 1rem; }
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
export class ProductListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: AdminAuthConfig;

  products: Product[] = [];
  categories: Category[] = [];
  brands: Brand[] = [];
  categoryNames: Record<string, string> = {};
  brandNames: Record<string, string> = {};

  searchQuery = '';
  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingProduct: Product | null = null;

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
      categoryId: ['', Validators.required],
      brandId: [''],
      status: ['draft'],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      variantSku: ['', Validators.required],
      variantPrice: [0, Validators.required],
    });
    this.editForm = this.fb.group({
      status: ['draft', Validators.required],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadCategories();
    await this.loadBrands();
    await this.loadProducts();
  }

  async loadProducts(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/admin/products`);
      if (this.searchQuery) url.searchParams.set('search', this.searchQuery);
      const res = await this.http.get<ProductPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.products = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load products';
    } finally {
      this.loading = false;
    }
  }

  async loadCategories(): Promise<void> {
    try {
      const token = this.auth.token;
      const res = await this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.categories = res?.items ?? [];
      this.categoryNames = {};
      for (const c of this.categories) {
        this.categoryNames[c.id] = c.content?.['en']?.name || c.content?.['bn']?.name || c.id;
      }
    } catch {
      this.categories = [];
    }
  }

  async loadBrands(): Promise<void> {
    try {
      const token = this.auth.token;
      const res = await this.http.get<BrandPage>(`${this.config.apiBaseUrl}/admin/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.brands = res?.items ?? [];
      this.brandNames = {};
      for (const b of this.brands) {
        this.brandNames[b.id] = b.content?.['en']?.name || b.content?.['bn']?.name || b.id;
      }
    } catch {
      this.brands = [];
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ categoryId: '', brandId: '', status: 'draft', nameEn: '', slugEn: '', variantSku: '', variantPrice: 0 });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createProduct(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body = {
        categoryId: value.categoryId,
        brandId: value.brandId || undefined,
        status: value.status,
        content: {
          en: {
            name: value.nameEn,
            slug: value.slugEn,
          },
        },
        variants: [
          {
            sku: value.variantSku,
            price: { amount: Math.round(parseFloat(value.variantPrice) * 100), currency: 'BDT' },
            attributes: {},
          },
        ],
      };
      await this.http.post(`${this.config.apiBaseUrl}/admin/products`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadProducts();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create product';
    } finally {
      this.creating = false;
    }
  }

  openEditModal(product: Product): void {
    this.editingProduct = product;
    this.editForm.reset({
      status: product.status,
      nameEn: product.content?.['en']?.name || '',
      slugEn: product.content?.['en']?.slug || '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingProduct = null;
  }

  async updateProduct(): Promise<void> {
    if (!this.editingProduct || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body = {
        status: value.status,
        content: {
          en: {
            name: value.nameEn,
            slug: value.slugEn,
          },
        },
      };
      await this.http.patch(`${this.config.apiBaseUrl}/admin/products/${this.editingProduct.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadProducts();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update product';
    } finally {
      this.updating = false;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    if (!confirm('Delete this product?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/admin/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadProducts();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete product';
    }
  }
}
