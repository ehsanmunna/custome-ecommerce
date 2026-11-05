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
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Variant {
  id: string;
  sku: string;
  price: { amount: number; currency: string };
  compareAtPrice?: { amount: number; currency: string };
  status: string;
  sortOrder: number;
  attributes: Record<string, unknown>;
}

export interface VariantInput {
  sku: string;
  price: { amount: number; currency: string };
  compareAtPrice?: { amount: number; currency: string };
  status?: string;
  sortOrder?: number;
  attributes: Record<string, unknown>;
}

export interface AttributeDefinition {
  key: string;
  valueType: string;
  required: boolean;
  filterable: boolean;
  sortOrder: number;
  options?: string[];
}

export interface AttributeDefinitionPage {
  items: AttributeDefinition[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-variant-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './variant-list.component.html',
})
export class VariantListComponent implements OnInit {

  variants: Variant[] = [];
  attributeDefs: AttributeDefinition[] = [];
  productId!: string;

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingVariant: Variant | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
  ) {
    this.createForm = this.fb.group({
      sku: ['', Validators.required],
      price: [0, Validators.required],
      status: ['active'],
    });
    this.editForm = this.fb.group({
      sku: ['', Validators.required],
      price: [0, Validators.required],
      status: ['active'],
    });
  }

  ngOnInit(): void {
    if (!this.productId) {
      this.error = 'No product ID specified';
      return;
    }
    this.loadVariants();
    this.loadAttributeDefs();
  }

  attributeKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  loadVariants(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<{ items: Variant[] }>(
      `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load variants';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.variants = res?.items ?? [];
      }
    });
  }

  loadAttributeDefs(): void {
    const token = this.auth.token;
    this.http.get<{ items: any[] }>(
      `${this.config.apiBaseUrl}/v1/admin/categories`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap((catRes) => {
        const firstCat = catRes?.items?.[0];
        if (firstCat) {
          return this.http.get<AttributeDefinitionPage>(
            `${this.config.apiBaseUrl}/v1/admin/categories/${firstCat.id}/attributes`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }
        return EMPTY;
      }),
      catchError(() => {
        this.attributeDefs = [];
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (attrRes) => {
        this.attributeDefs = attrRes?.items ?? [];
        for (const attr of this.attributeDefs) {
          this.createForm.addControl('attr_' + attr.key, this.fb.control(''));
        }
      }
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ sku: '', price: 0, status: 'active' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createVariant(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const attributes: Record<string, unknown> = {};
    for (const attr of this.attributeDefs) {
      const ctrlValue = value['attr_' + attr.key];
      if (ctrlValue !== undefined && ctrlValue !== '') {
        attributes[attr.key] = attr.valueType === 'number' ? Number(ctrlValue) : ctrlValue;
      }
    }
    const body: VariantInput = {
      sku: value.sku,
      price: { amount: Math.round(parseFloat(value.price) * 100), currency: 'BDT' },
      status: value.status,
      attributes,
    };
    this.http.post(
      `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<{ items: Variant[] }>(
        `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create variant';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.variants = res?.items ?? [];
      }
    });
  }

  openEditModal(variant: Variant): void {
    this.editingVariant = variant;
    this.editForm.reset({
      sku: variant.sku,
      price: variant.price.amount / 100,
      status: variant.status,
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingVariant = null;
  }

  updateVariant(): void {
    if (!this.editingVariant || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body: VariantInput = {
      sku: value.sku,
      price: { amount: Math.round(parseFloat(value.price) * 100), currency: 'BDT' },
      status: value.status,
      attributes: this.editingVariant.attributes,
    };
    this.http.patch(
      `${this.config.apiBaseUrl}/v1/admin/variants/${this.editingVariant.id}`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<{ items: Variant[] }>(
        `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update variant';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.variants = res?.items ?? [];
      }
    });
  }

  deleteVariant(id: string): void {
    if (!confirm('Delete this variant?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/variants/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<{ items: Variant[] }>(
        `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete variant';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.variants = res?.items ?? [];
      }
    });
  }
}

