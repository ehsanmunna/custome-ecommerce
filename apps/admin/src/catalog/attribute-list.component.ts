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
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  templateUrl: './attribute-list.component.html',
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

  private readonly destroyRef = inject(DestroyRef);

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

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
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
      }
    });
  }

  loadAttributes(): void {
    if (!this.selectedCategoryId) {
      this.attributes = [];
      return;
    }
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<AttributeDefinitionPage>(
      `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load attributes';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.attributes = res?.items ?? [];
      }
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ key: '', valueType: 'text', required: false, filterable: false, sortOrder: 0, options: '' });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createAttribute(): void {
    if (this.createForm.invalid || !this.selectedCategoryId) return;
    this.creating = true;
    this.error = null;
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
    this.http.post(
      `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<AttributeDefinitionPage>(
        `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create attribute';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.attributes = res?.items ?? [];
      }
    });
  }
}

