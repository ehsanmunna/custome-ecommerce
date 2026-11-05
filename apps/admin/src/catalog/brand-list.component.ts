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

@Component({
  selector: 'app-brand-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './brand-list.component.html',
})
export class BrandListComponent implements OnInit {
  brands: Brand[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingBrand: Brand | null = null;

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
      status: ['active'],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      nameBn: [''],
      slugBn: [''],
    });
    this.editForm = this.fb.group({
      status: ['active', Validators.required],
      nameEn: ['', Validators.required],
      slugEn: ['', Validators.required],
      nameBn: [''],
      slugBn: [''],
    });
  }

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load brands';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.brands = res?.items ?? [];
        },
      });
  }

  openCreateModal(): void {
    this.createForm.reset({ status: 'active', nameEn: '', slugEn: '', nameBn: '', slugBn: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createBrand(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body: any = {
      status: value.status,
      content: {
        en: { name: value.nameEn, slug: value.slugEn },
      },
    };
    if (value.nameBn || value.slugBn) {
      body.content.bn = { name: value.nameBn, slug: value.slugBn };
    }
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/brands`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to create brand';
          return EMPTY;
        }),
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeCreateModal();
          this.brands = res?.items ?? [];
        },
      });
  }

  openEditModal(brand: Brand): void {
    this.editingBrand = brand;
    this.editForm.reset({
      status: brand.status,
      nameEn: brand.content?.['en']?.name || '',
      slugEn: brand.content?.['en']?.slug || '',
      nameBn: brand.content?.['bn']?.name || '',
      slugBn: brand.content?.['bn']?.slug || '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingBrand = null;
  }

  updateBrand(): void {
    if (!this.editingBrand || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body: any = {
      status: value.status,
      content: {
        en: { name: value.nameEn, slug: value.slugEn },
      },
    };
    if (value.nameBn || value.slugBn) {
      body.content.bn = { name: value.nameBn, slug: value.slugBn };
    }
    this.http
      .patch(`${this.config.apiBaseUrl}/v1/admin/brands/${this.editingBrand.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to update brand';
          return EMPTY;
        }),
        finalize(() => (this.updating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeEditModal();
          this.brands = res?.items ?? [];
        },
      });
  }

  deleteBrand(id: string): void {
    if (!confirm('Delete this brand?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/brands/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to delete brand';
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.brands = res?.items ?? [];
        },
      });
  }
}
