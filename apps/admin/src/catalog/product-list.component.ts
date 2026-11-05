import { Component, Inject, OnInit, DestroyRef, inject } from '@angular/core';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

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
    <div class="p-4 max-w-[1200px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Products
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Products</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <input type="text" placeholder="Search products..." [(ngModel)]="searchQuery" class="w-full p-2 border border-[var(--color-border)] rounded-md flex-1 min-w-[200px]" />
        <button (click)="loadProducts()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Search</button>
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.products.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Product</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="products.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Name</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">SKU</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Category</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Brand</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Price</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of products">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ p.content['en']?.name || p.content['bn']?.name }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ p.variants[0].sku || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ categoryNames[p.categoryId] || p.categoryId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ brandNames[p.brandId || ''] || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ p.status }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ p.variants[0].price.toFixed(2) || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(p)" *ngIf="auth.hasPermission('catalog.products.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteProduct(p.id)" *ngIf="auth.hasPermission('catalog.products.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No products found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Product</h2>
          <form [formGroup]="createForm" (ngSubmit)="createProduct()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Category</label>
              <select formControlName="categoryId" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option *ngFor="let c of categories" [value]="c.id">{{ c.content['en']?.name || c.content['bn']?.name }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Brand</label>
              <select formControlName="brandId" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="">None</option>
                <option *ngFor="let b of brands" [value]="b.id">{{ b.content['en']?.name || b.content['bn']?.name }}</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
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
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Variant SKU</label>
              <input formControlName="variantSku" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Variant Price</label>
              <input type="number" formControlName="variantPrice" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingProduct" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Product</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateProduct()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name (en)</label>
              <input formControlName="nameEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Slug (en)</label>
              <input formControlName="slugEn" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class ProductListComponent implements OnInit {

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

  ngOnInit(): void {
    this.loadCategories();
    this.loadBrands();
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/products`);
    if (this.searchQuery) url.searchParams.set('search', this.searchQuery);
    this.http.get<ProductPage>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load products';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.products = res?.items ?? [];
      }
    });
  }

  loadCategories(): void {
    this.error = null;
    const token = this.auth.token;
    this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError(() => {
        this.categories = [];
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.categories = res?.items ?? [];
        this.categoryNames = {};
        for (const c of this.categories) {
          this.categoryNames[c.id] = c.content?.['en']?.name || c.content?.['bn']?.name || c.id;
        }
      }
    });
  }

  loadBrands(): void {
    this.error = null;
    const token = this.auth.token;
    this.http.get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError(() => {
        this.brands = [];
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.brands = res?.items ?? [];
        this.brandNames = {};
        for (const b of this.brands) {
          this.brandNames[b.id] = b.content?.['en']?.name || b.content?.['bn']?.name || b.id;
        }
      }
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ categoryId: '', brandId: '', status: 'draft', nameEn: '', slugEn: '', variantSku: '', variantPrice: 0 });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createProduct(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
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
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/products`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ProductPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create product';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.products = res?.items ?? [];
      }
    });
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

  updateProduct(): void {
    if (!this.editingProduct || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
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
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/products/${this.editingProduct.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ProductPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update product';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.products = res?.items ?? [];
      }
    });
  }

  deleteProduct(id: string): void {
    if (!confirm('Delete this product?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ProductPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete product';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.products = res?.items ?? [];
      }
    });
  }
}

