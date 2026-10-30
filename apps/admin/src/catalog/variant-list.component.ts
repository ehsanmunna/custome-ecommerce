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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/products">Products</a> &gt; Variants
      </nav>

      <h1>Variants for Product {{ productId }}</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.products.update')">+ New Variant</button>
        <a routerLink="/products" class="secondary">Back to Products</a>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="variants.length; else emptyState">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Price</th>
            <th>Status</th>
            <th>Attributes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let v of variants">
            <td>{{ v.sku }}</td>
            <td>{{ (v.price.amount / 100).toFixed(2) }} {{ v.price.currency }}</td>
            <td><span class="status {{ v.status }}">{{ v.status }}</span></td>
            <td>
              <span *ngFor="let k of attributeKeys(v.attributes)">{{ k }}: {{ v.attributes[k] }}</span>
            </td>
            <td>
              <button (click)="openEditModal(v)" *ngIf="auth.hasPermission('catalog.products.update')">Edit</button>
              <button class="danger" (click)="deleteVariant(v.id)" *ngIf="auth.hasPermission('catalog.products.update')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No variants found for this product.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Variant</h2>
          <form [formGroup]="createForm" (ngSubmit)="createVariant()">
            <div class="field">
              <label>SKU</label>
              <input formControlName="sku" />
            </div>
            <div class="field">
              <label>Price (BDT)</label>
              <input type="number" formControlName="price" />
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="field" *ngFor="let attr of attributeDefs">
              <label>{{ attr.key }} ({{ attr.valueType }}){{ attr.required ? ' *' : '' }}</label>
              <input [formControlName]="'attr_' + attr.key" [placeholder]="attr.options?.join(', ')" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingVariant" class="modal">
        <div class="modal-content">
          <h2>Edit Variant</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateVariant()">
            <div class="field">
              <label>SKU</label>
              <input formControlName="sku" />
            </div>
            <div class="field">
              <label>Price (BDT)</label>
              <input type="number" formControlName="price" />
            </div>
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
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
    .secondary { background: transparent; color: #007bff; border: 1px solid #007bff; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button.danger { background: #dc3545; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; background: #e9ecef; color: #495057; }
    .status.active { background: #d4edda; color: #155724; }
    .status.archived { background: #f8d7da; color: #721c24; }
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
export class VariantListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: AdminAuthConfig;
  private readonly route: ActivatedRoute;

  productId: string;
  variants: Variant[] = [];
  attributeDefs: AttributeDefinition[] = [];

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
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    fbOrInjector: FormBuilder = inject(FormBuilder),
    configOrInjector: AdminAuthConfig = inject(ADMIN_AUTH_CONFIG),
    routeOrInjector: ActivatedRoute = inject(ActivatedRoute),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.fb = fbOrInjector;
    this.config = configOrInjector;
    this.route = routeOrInjector;
    this.productId = this.route.snapshot.paramMap.get('productId') || '';
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
        `${this.config.apiBaseUrl}/admin/products/${this.productId}/variants`,
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
        `${this.config.apiBaseUrl}/admin/categories`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      const firstCat = catRes?.items?.[0];
      if (firstCat) {
        const attrRes = await this.http.get<AttributeDefinitionPage>(
          `${this.config.apiBaseUrl}/admin/categories/${firstCat.id}/attributes`,
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
        `${this.config.apiBaseUrl}/admin/products/${this.productId}/variants`,
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
        `${this.config.apiBaseUrl}/admin/variants/${this.editingVariant.id}`,
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
      await this.http.delete(`${this.config.apiBaseUrl}/admin/variants/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadVariants();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete variant';
    }
  }
}
