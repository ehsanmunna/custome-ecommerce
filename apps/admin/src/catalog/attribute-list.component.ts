import { Component, DestroyRef, Inject, OnInit, inject, signal } from '@angular/core';

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
import { ADMIN_PERMISSIONS } from '../core/auth/admin-permissions';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

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
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './attribute-list.component.html',
})
export class AttributeListComponent implements OnInit {
  categories = signal<Category[]>([]);
  attributes = signal<AttributeDefinition[]>([]);
  selectedCategoryId = '';

  loading = signal(false);
  error = signal<string | null>(null);

  createModal = false;
  creating = signal(false);

  createForm: FormGroup;

  private readonly destroyRef = inject(DestroyRef);

  protected readonly permissions = ADMIN_PERMISSIONS;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    private readonly notification: NotificationService,
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
    this.http
      .get<CategoryPage>(`${this.config.apiBaseUrl}/v1/admin/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError(() => {
          this.categories.set([]);
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.categories.set(res?.items ?? []);
        },
        error: (err) => {
          this.categories.set([]);
          this.error.set(extractErrorMessage(err, 'Failed to load categories'));
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error()!);
          }
        },
      });
  }

  loadAttributes(): void {
    if (!this.selectedCategoryId) {
      this.attributes.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.token;
    this.http
      .get<AttributeDefinitionPage>(
        `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        catchError((err: any) => {
          this.error.set(err?.message ?? 'Failed to load attributes');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.attributes.set(res?.items ?? []);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(extractErrorMessage(err, 'Failed to load attributes'));
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error()!);
          }
        },
      });
  }

  openCreateModal(): void {
    this.createForm.reset({
      key: '',
      valueType: 'text',
      required: false,
      filterable: false,
      sortOrder: 0,
      options: '',
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createAttribute(): void {
    if (this.createForm.invalid || !this.selectedCategoryId) return;
    this.creating.set(true);
    this.error.set(null);
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
      body.options = value.options
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
    }
    this.http
      .post(
        `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        switchMap(() =>
          this.http.get<AttributeDefinitionPage>(
            `${this.config.apiBaseUrl}/v1/admin/categories/${this.selectedCategoryId}/attributes`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeCreateModal();
          this.attributes.set(res?.items ?? []);
          this.notification.success(NOTIFICATION_MESSAGES.attribute.create);
        },
        error: (err) => {
          this.creating.set(false);
          this.error.set(extractErrorMessage(err, NOTIFICATION_MESSAGES.attribute.createFailed));
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error()!);
          }
        },
      });
  }
}
