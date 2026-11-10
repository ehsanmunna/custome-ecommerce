import { Component, Inject, OnInit, DestroyRef, inject } from '@angular/core';

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
import { finalize } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

export interface Product {
  id: string;
  categoryId: string;
  brandId?: string;
  status: string;
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
  variants: Array<{
    id: string;
    sku: string;
    price: number;
    status: string;
    attributes: Record<string, unknown>;
  }>;
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

export interface Brand {
  id: string;
  status: string;
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
  image?: { id: string; url: string; type: string };
}

export interface BrandPage {
  items: Brand[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MediaAsset {
  id: string;
  url: string;
  mimeType: string;
  alt: Record<string, string>;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  categories: Category[] = [];
  brands: Brand[] = [];
  media: MediaAsset[] = [];
  categoryNames: Record<string, string> = {};
  brandNames: Record<string, string> = {};

  searchQuery = '';
  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  uploadingMedia = false;
  editingProduct: Product | null = null;

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
      categoryId: ['', Validators.required],
      brandId: [''],
      status: ['draft'],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      variantSku: ['', Validators.required],
      variantPrice: [0, Validators.required],
      mediaIds: [[]],
      primaryMediaId: [''],
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

  loadCategories(): void {
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.categories = res?.items ?? [];
          this.categoryNames = {};
          for (const c of this.categories) {
            this.categoryNames[c.id] = c.content?.['en']?.name || c.content?.['bn']?.name || c.id;
          }
        },
        error: (err) => {
          this.error = extractErrorMessage(err, 'Failed to load categories');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  loadBrands(): void {
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.brands = res?.items ?? [];
          this.brandNames = {};
          for (const b of this.brands) {
            this.brandNames[b.id] = b.content?.['en']?.name || b.content?.['bn']?.name || b.id;
          }
        },
        error: (err) => {
          this.error = extractErrorMessage(err, 'Failed to load brands');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  mediaName(id: string): string {
    const m = this.media.find((x) => x.id === id);
    return m ? m.url : id;
  }

  loadMedia(): void {
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<{ items: MediaAsset[] }>(`${this.config.apiBaseUrl}/v1/image-storage/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.media = res?.items ?? [];
        },
        error: (err) => {
          this.error = extractErrorMessage(err, 'Failed to load media');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  loadProducts(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/products`);
    if (this.searchQuery) url.searchParams.set('search', this.searchQuery);
    this.http
      .get<ProductPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.products = res?.items ?? [];
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load products');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  onMediaFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    this.uploadingMedia = true;
    this.error = null;
    const token = this.auth.token;
    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }
    formData.append('feature', 'products');

    this.http
      .post<{ mediaId: string; url: string; key: string; mimeType: string; sizeBytes: number }[]>(
        `${this.config.apiBaseUrl}/v1/image-storage/upload`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (results) => {
          const newMedia: MediaAsset[] = results.map((res) => ({
            id: res.mediaId,
            url: res.url,
            mimeType: res.mimeType,
            alt: {},
          }));
          this.media = [...this.media, ...newMedia];
          const currentMediaIds = this.createForm.get('mediaIds')?.value || [];
          this.createForm.patchValue({
            mediaIds: [...currentMediaIds, ...results.map((res) => res.mediaId)],
          });
          this.uploadingMedia = false;
          this.notification.success(NOTIFICATION_MESSAGES.media.create);
        },
        error: (err) => {
          this.uploadingMedia = false;
          this.error = extractErrorMessage(err, 'Failed to upload media');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  openCreateModal(): void {
    this.createForm.reset({
      categoryId: '',
      brandId: '',
      status: 'draft',
      nameEn: '',
      slugEn: '',
      variantSku: '',
      variantPrice: 0,
      mediaIds: [],
    });
    this.loadMedia();
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
          price: Math.round(parseFloat(value.variantPrice)),
          attributes: {},
        },
      ],
      media: (value.mediaIds || []).map((mediaId: string, index: number) => ({
        mediaId,
        primary: mediaId === (value.primaryMediaId || ''),
        sortOrder: index,
      })),
    };
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/products`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closeCreateModal();
          this.notification.success(NOTIFICATION_MESSAGES.product.create);
        },
        error: (err) => {
          this.creating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.product.createFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
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
    this.http
      .patch(`${this.config.apiBaseUrl}/v1/admin/products/${this.editingProduct.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        finalize(() => (this.updating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closeEditModal();
          this.notification.success(NOTIFICATION_MESSAGES.product.update);
        },
        error: (err) => {
          this.updating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.product.updateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  deleteProduct(id: string): void {
    if (!confirm('Delete this product?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.notification.success(NOTIFICATION_MESSAGES.product.delete);
        },
        error: (err) => {
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.product.deleteFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
