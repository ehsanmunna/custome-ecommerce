import { Component, Inject, OnInit } from '@angular/core';
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
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/products" class="text-[var(--color-primary)] underline">Products</a> &gt; Variants
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Variants for Product {{ productId }}</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.products.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Variant</button>
        <a routerLink="/products" class="px-4 py-2 border-none rounded-md cursor-pointer border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">Back to Products</a>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="variants.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">SKU</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Price</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Attributes</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let v of variants">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ v.sku }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ (v.price.amount / 100).toFixed(2) }} {{ v.price.currency }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ v.status }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <span *ngFor="let k of attributeKeys(v.attributes)" class="text-[var(--color-text-secondary)] text-xs">{{ k }}: {{ v.attributes[k] }}</span>
            </td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(v)" *ngIf="auth.hasPermission('catalog.products.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteVariant(v.id)" *ngIf="auth.hasPermission('catalog.products.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No variants found for this product.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Variant</h2>
          <form [formGroup]="createForm" (ngSubmit)="createVariant()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">SKU</label>
              <input formControlName="sku" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Price (BDT)</label>
              <input type="number" formControlName="price" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="mb-3" *ngFor="let attr of attributeDefs">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">{{ attr.key }} ({{ attr.valueType }}){{ attr.required ? ' *' : '' }}</label>
              <input [formControlName]="'attr_' + attr.key" [placeholder]="attr.options?.join(', ')" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingVariant" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Variant</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateVariant()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">SKU</label>
              <input formControlName="sku" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Price (BDT)</label>
              <input type="number" formControlName="price" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Status</label>
              <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
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

  async ngOnInit(): Promise<void> {
    if (!this.productId) {
      this.error = 'No product ID specified';
      return;
    }
    await this.loadVariants();
    await this.loadAttributeDefs();
  }

  attributeKeys(obj: Record<string, unknown>): string[] {
    return Object.keys(obj);
  }

  async loadVariants(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<{ items: Variant[] }>(
        `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.variants = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load variants';
    } finally {
      this.loading = false;
    }
  }

  async loadAttributeDefs(): Promise<void> {
    // We need the category ID to load attribute definitions.
    // For now, we'll load from the first category that has attributes.
    // In a full implementation, we'd get the category from the product detail.
    try {
      const token = this.auth.token;
      const catRes = await this.http.get<{ items: any[] }>(
        `${this.config.apiBaseUrl}/v1/admin/categories`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      const firstCat = catRes?.items?.[0];
      if (firstCat) {
        const attrRes = await this.http.get<AttributeDefinitionPage>(
          `${this.config.apiBaseUrl}/v1/admin/categories/${firstCat.id}/attributes`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).toPromise();
        this.attributeDefs = attrRes?.items ?? [];
        // Add dynamic form controls for each attribute
        for (const attr of this.attributeDefs) {
          this.createForm.addControl('attr_' + attr.key, this.fb.control(''));
        }
      }
    } catch {
      this.attributeDefs = [];
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ sku: '', price: 0, status: 'active' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createVariant(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
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
      await this.http.post(
        `${this.config.apiBaseUrl}/v1/admin/products/${this.productId}/variants`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.closeCreateModal();
      await this.loadVariants();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create variant';
    } finally {
      this.creating = false;
    }
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

  async updateVariant(): Promise<void> {
    if (!this.editingVariant || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body: VariantInput = {
        sku: value.sku,
        price: { amount: Math.round(parseFloat(value.price) * 100), currency: 'BDT' },
        status: value.status,
        attributes: this.editingVariant.attributes,
      };
      await this.http.patch(
        `${this.config.apiBaseUrl}/v1/admin/variants/${this.editingVariant.id}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.closeEditModal();
      await this.loadVariants();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update variant';
    } finally {
      this.updating = false;
    }
  }

  async deleteVariant(id: string): Promise<void> {
    if (!confirm('Delete this variant?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/variants/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadVariants();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete variant';
    }
  }
}

