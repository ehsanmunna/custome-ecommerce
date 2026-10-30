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
  content: Record<string, { name: string; slug: string }>;
}

export interface CategoryPage {
  items: Category[];
  total: number;
  page: number;
  pageSize: number;
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
  selector: 'app-attribute-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Attribute Definitions
      </nav>

      <h1>Attribute Definitions</h1>

      <div class="toolbar">
        <label>Category</label>
        <select [(ngModel)]="selectedCategoryId" (change)="loadAttributes()">
          <option value="">Select a category</option>
          <option *ngFor="let c of categories" [value]="c.id">{{ c.content?.['en']?.name || c.content?.['bn']?.name || c.id }}</option>
        </select>
        <button class="primary" (click)="openCreateModal()" [disabled]="!selectedCategoryId" *ngIf="auth.hasPermission('catalog.attributes.create')">+ New Attribute</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="selectedCategoryId && attributes.length; else emptyState">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value Type</th>
              <th>Required</th>
              <th>Filterable</th>
              <th>Sort Order</th>
              <th>Options</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of attributes">
              <td>{{ a.key }}</td>
              <td>{{ a.valueType }}</td>
              <td>{{ a.required ? 'Yes' : 'No' }}</td>
              <td>{{ a.filterable ? 'Yes' : 'No' }}</td>
              <td>{{ a.sortOrder }}</td>
            <td>{{ a.options?.join(', ') || '-' }}</td>
            <td></td>
          </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyState>
        <p *ngIf="selectedCategoryId">No attribute definitions for this category.</p>
        <p *ngIf="!selectedCategoryId">Select a category to manage its attributes.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Attribute Definition</h2>
          <form [formGroup]="createForm" (ngSubmit)="createAttribute()">
            <div class="field">
              <label>Key (e.g., color, size)</label>
              <input formControlName="key" placeholder="color" />
              <small class="hint">Lowercase letters, numbers, underscores. Must start with a letter.</small>
            </div>
            <div class="field">
              <label>Value Type</label>
              <select formControlName="valueType">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div class="field">
              <label>Required</label>
              <select formControlName="required">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="field">
              <label>Filterable</label>
              <select formControlName="filterable">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="field">
              <label>Sort Order</label>
              <input type="number" formControlName="sortOrder" />
            </div>
            <div class="field">
              <label>Options (comma-separated, for select type)</label>
              <input formControlName="options" placeholder="red, green, blue" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
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
    .toolbar label { font-size: 0.9rem; font-weight: 500; }
    .toolbar select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.danger { background: #dc3545; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .hint { font-size: 0.75rem; color: #666; margin-top: 0.125rem; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
  `,
})
export class AttributeListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: AdminAuthConfig;

  categories: Category[] = [];
  attributes: AttributeDefinition[] = [];
  selectedCategoryId = '';

  loading = false;
  error: string | null = null;

  createModal = false;
  creating = false;

  createForm: FormGroup;

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
      key: ['', [Validators.required, Validators.pattern('^[a-z][a-z0-9_]*$')]],
      valueType: ['text', Validators.required],
      required: [false],
      filterable: [false],
      sortOrder: [0],
      options: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadCategories();
  }

  async loadCategories(): Promise<void> {
    try {
      const token = this.auth.token;
      const res = await this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.categories = res?.items ?? [];
    } catch {
      this.categories = [];
    }
  }

  async loadAttributes(): Promise<void> {
    if (!this.selectedCategoryId) {
      this.attributes = [];
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<AttributeDefinitionPage>(
        `${this.config.apiBaseUrl}/admin/categories/${this.selectedCategoryId}/attributes`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.attributes = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load attributes';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ key: '', valueType: 'text', required: false, filterable: false, sortOrder: 0, options: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createAttribute(): Promise<void> {
    if (this.createForm.invalid || !this.selectedCategoryId) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body: any = {
        key: value.key,
        valueType: value.valueType,
        required: value.required === 'true' || value.required === true,
        filterable: value.filterable === 'true' || value.filterable === true,
        sortOrder: value.sortOrder,
      };
      if (value.options) {
        body.options = value.options.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
      }
      await this.http.post(
        `${this.config.apiBaseUrl}/admin/categories/${this.selectedCategoryId}/attributes`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.closeCreateModal();
      await this.loadAttributes();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create attribute';
    } finally {
      this.creating = false;
    }
  }
}
