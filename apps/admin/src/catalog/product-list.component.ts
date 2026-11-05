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
  templateUrl: './product-list.component.html',
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

