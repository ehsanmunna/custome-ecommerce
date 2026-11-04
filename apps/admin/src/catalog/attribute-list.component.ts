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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Attribute Definitions
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Attribute Definitions</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <label class="font-medium text-sm text-[var(--color-text-secondary)]">Category</label>
        <select [(ngModel)]="selectedCategoryId" (change)="loadAttributes()" class="w-auto p-2 border border-[var(--color-border)] rounded-md">
          <option value="">Select a category</option>
          <option *ngFor="let c of categories" [value]="c.id">{{ c.content['en']?.name || c.content['bn']?.name || c.id }}</option>
        </select>
        <button (click)="openCreateModal()" [disabled]="!selectedCategoryId" *ngIf="auth.hasPermission('catalog.attributes.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)] opacity-50:cursor-not-allowed">+ New Attribute</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <div *ngIf="selectedCategoryId && attributes.length; else emptyState" class="w-full border-collapse mb-4">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Key</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Value Type</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Required</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Filterable</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Sort Order</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Options</th>
              <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of attributes">
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.key }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.valueType }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.required ? 'Yes' : 'No' }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.filterable ? 'Yes' : 'No' }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.sortOrder }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left">{{ a.options?.join(', ') || '-' }}</td>
              <td class="border border-[var(--color-border)] p-2 text-left"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <ng-template #emptyState>
        <p *ngIf="selectedCategoryId" class="text-[var(--color-text-muted)]">No attribute definitions for this category.</p>
        <p *ngIf="!selectedCategoryId" class="text-[var(--color-text-muted)]">Select a category to manage its attributes.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Attribute Definition</h2>
          <form [formGroup]="createForm" (ngSubmit)="createAttribute()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Key (e.g., color, size)</label>
              <input formControlName="key" placeholder="color" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
              <small class="block text-[var(--color-text-muted)] text-xs mt-1">Lowercase letters, numbers, underscores. Must start with a letter.</small>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Value Type</label>
              <select formControlName="valueType" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="select">Select</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Required</label>
              <select formControlName="required" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Filterable</label>
              <select formControlName="filterable" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Sort Order</label>
              <input type="number" formControlName="sortOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Options (comma-separated, for select type)</label>
              <input formControlName="options" placeholder="red, green, blue" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class AttributeListComponent implements OnInit {

  categories: Category[] = [];
  attributes: AttributeDefinition[] = [];
  selectedCategoryId = '';

  loading = false;
  error: string | null = null;

  createModal = false;
  creating = false;

  createForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
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
      const res = (await this.http.get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as unknown as CategoryPage;
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
      const res = (await this.http.get<AttributeDefinitionPage>(
        `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
        { headers: { Authorization: `Bearer ${token}` } },
      )) as unknown as AttributeDefinitionPage;
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
        `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      this.closeCreateModal();
      await this.loadAttributes();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create attribute';
    } finally {
      this.creating = false;
    }
  }
}

