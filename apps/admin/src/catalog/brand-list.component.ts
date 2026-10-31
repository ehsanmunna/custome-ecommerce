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
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

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
  selector: 'app-brand-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Brands
      </nav>

      <h1>Brands</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('catalog.brands.create')">+ New Brand</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="brands.length; else emptyState">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let b of brands">
            <td>{{ b.content['en']?.name || b.content['bn']?.name || b.id }}</td>
            <td><span class="status {{ b.status }}">{{ b.status }}</span></td>
            <td>
              <button (click)="openEditModal(b)" *ngIf="auth.hasPermission('catalog.brands.update')">Edit</button>
              <button class="danger" (click)="deleteBrand(b.id)" *ngIf="auth.hasPermission('catalog.brands.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No brands found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Brand</h2>
          <form [formGroup]="createForm" (ngSubmit)="createBrand()">
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
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

      <div *ngIf="editModal && editingBrand" class="modal">
        <div class="modal-content">
          <h2>Edit Brand</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateBrand()">
            <div class="field">
              <label>Status</label>
              <select formControlName="status">
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
export class BrandListComponent implements OnInit {

  brands: Brand[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingBrand: Brand | null = null;

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
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

  async ngOnInit(): Promise<void> {
    await this.loadBrands();
  }

  async loadBrands(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<BrandPage>(`${this.config.apiBaseUrl}/v1/admin/brands`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.brands = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load brands';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ status: 'active', nameEn: '', slugEn: '', nameBn: '', slugBn: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createBrand(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
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
      await this.http.post(`${this.config.apiBaseUrl}/v1/admin/brands`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadBrands();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create brand';
    } finally {
      this.creating = false;
    }
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

  async updateBrand(): Promise<void> {
    if (!this.editingBrand || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
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
      await this.http.patch(`${this.config.apiBaseUrl}/v1/admin/brands/${this.editingBrand.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadBrands();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update brand';
    } finally {
      this.updating = false;
    }
  }

  async deleteBrand(id: string): Promise<void> {
    if (!confirm('Delete this brand?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/brands/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadBrands();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete brand';
    }
  }
}
