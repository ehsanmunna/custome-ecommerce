import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
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
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';
import { NOTIFICATION_MESSAGES, extractErrorMessage } from '../core/notifications/notification-messages';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: 'active' | 'disabled';
  role: {
    id: string;
    key: string;
    name: string;
    description?: string;
    scope: 'store' | 'platform';
    system: boolean;
    permissions: string[];
  };
  permissions: string[];
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AdminRole {
  id: string;
  key: string;
  name: string;
}

@Component({
  selector: 'app-admin-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonModule],
  template: `
    <div class="modal-overlay" (click)="onBackdropClick($event)">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title">{{ mode === 'create' ? 'Add administrator' : 'Edit administrator' }}</h3>
          <button type="button" class="modal-close" aria-label="Close" (click)="onCancel()">&times;</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="modal-body">
            @if (mode === 'create') {
              <div class="form-field">
                <label class="form-label">Email</label>
                <input type="email" formControlName="email" class="form-input" placeholder="email@example.com" />
                @if (form.get('email')?.invalid && form.get('email')?.touched) {
                  <p class="form-error">Enter a valid email address.</p>
                }
              </div>
              <div class="form-field">
                <label class="form-label">Password</label>
                <input type="password" formControlName="password" class="form-input" placeholder="••••••••" />
                @if (form.get('password')?.invalid && form.get('password')?.touched) {
                  <p class="form-error">Password must be at least 8 characters.</p>
                }
              </div>
            }
            <div class="form-field">
              <label class="form-label">Display name</label>
              <input type="text" formControlName="displayName" class="form-input" />
              @if (form.get('displayName')?.invalid && form.get('displayName')?.touched) {
                <p class="form-error">Display name is required.</p>
              }
            </div>
            <div class="form-field">
              <label class="form-label">Role</label>
              <select formControlName="roleId" class="form-select">
                <option value="">Select a role</option>
                @for (role of roles; track role.id) {
                  <option [value]="role.id">{{ role.name }}</option>
                }
              </select>
              @if (form.get('roleId')?.invalid && form.get('roleId')?.touched) {
                <p class="form-error">Select a role.</p>
              }
            </div>
            @if (mode === 'edit') {
              <div class="form-field">
                <label class="form-label">Status</label>
                <select formControlName="status" class="form-select">
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            }
          </div>
          <div class="modal-footer justify-end">
            <p-button
              type="button"
              label="Cancel"
              severity="secondary"
              [text]="true"
              (onClick)="onCancel()"
            ></p-button>
            <p-button
              type="submit"
              [label]="mode === 'create' ? 'Create' : 'Save'"
              severity="primary"
              [disabled]="form.invalid || saving"
            ></p-button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1200;
      }
      .modal {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        width: 420px;
        max-width: 90vw;
        max-height: 85vh;
        overflow: auto;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
      }
      .modal-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        line-height: 1;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 0 0.25rem;
      }
      .modal-body {
        padding: 1.25rem;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-top: 1px solid var(--color-border);
      }
      .form-field {
        margin-bottom: 1rem;
      }
      .form-label {
        display: block;
        margin-bottom: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text);
      }
      .form-input,
      .form-select {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-secondary);
        color: var(--color-text);
        font-size: 0.9375rem;
        box-sizing: border-box;
      }
      .form-select {
        cursor: pointer;
      }
      .form-error {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--color-danger);
      }
    `,
  ],
})
export class AdminUserFormComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() saving = false;
  @Input() roles: AdminRole[] = [];
  @Input() user: AdminUser | null = null;

  @Output() save = new EventEmitter<{ email?: string; password?: string; displayName: string; status?: 'active' | 'disabled'; roleId: string }>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb: FormBuilder;
  form!: FormGroup;

  constructor(@Inject(FormBuilder) fb: FormBuilder) {
    this.fb = fb;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      email: [this.mode === 'create' ? '' : (this.user?.email ?? ''), [Validators.required, Validators.email]],
      password: [this.mode === 'create' ? '' : '', this.mode === 'create' ? [Validators.required, Validators.minLength(8)] : []],
      displayName: [this.user?.displayName ?? '', Validators.required],
      status: [this.user?.status ?? 'active', Validators.required],
      roleId: [this.user?.role.id ?? '', Validators.required],
    });
    if (this.mode === 'create') {
      this.form.get('email')?.enable();
      this.form.get('password')?.enable();
    } else {
      this.form.get('email')?.disable();
      this.form.get('password')?.disable();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({
      ...(this.mode === 'create' ? { email: value.email, password: value.password } : {}),
      displayName: value.displayName,
      ...(this.mode === 'edit' ? { status: value.status } : {}),
      roleId: value.roleId,
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}

@Component({
  selector: 'app-admin-users-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminUserFormComponent, TranslocoPipe, RouterLink, ButtonModule],
  template: `
    <div class="mx-auto max-w-[1200px] p-4">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Users
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">
        {{ 'menu.users' | transloco }}
      </h1>

      <div class="flex items-center gap-2 mb-4">
        <p-button
          label="Add administrator"
          severity="primary"
          [disabled]="creating || updating || saving"
          (onClick)="openCreateModal()"
        ></p-button>
      </div>

      @if (error) {
        <div class="mb-4 p-3 rounded border border-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm">
          {{ error }}
        </div>
      }

      <table class="w-full border-collapse mb-6">
        <thead>
          <tr class="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-sm">
            <th class="text-left pb-2">Email</th>
            <th class="text-left pb-2">Display name</th>
            <th class="text-left pb-2">Role</th>
            <th class="text-left pb-2">Scope</th>
            <th class="text-left pb-2">Status</th>
            <th class="text-left pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (user of users; track user.id) {
            <tr class="border-b border-[var(--color-border)]">
              <td class="py-3 text-[var(--color-text)]">{{ user.email }}</td>
              <td class="py-3 text-[var(--color-text)]">{{ user.displayName }}</td>
              <td class="py-3 text-[var(--color-text)]">{{ user.role.name }}</td>
              <td class="py-3 text-[var(--color-text-muted)] text-xs">{{ user.role.scope }}</td>
              <td class="py-3">
                <span
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                  [class.bg-[var(--color-success-light)]]="user.status === 'active'"
                  [class.text-[var(--color-success)]]="user.status === 'active'"
                  [class.bg-[var(--color-danger-light)]]="user.status === 'disabled'"
                  [class.text-[var(--color-danger)]]="user.status === 'disabled'"
                >
                  {{ user.status }}
                </span>
              </td>
              <td class="py-3 text-left">
                @if (auth.hasPermission('admin.users.update')) {
                  <button
                    type="button"
                    class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    (click)="openEditModal(user)"
                    [disabled]="creating || updating || saving"
                  >
                    Edit
                  </button>
                }
                @if (user.status === 'active') {
                  @if (auth.hasPermission('admin.users.disable')) {
                    <button
                      type="button"
                      class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]"
                      (click)="toggleStatus(user)"
                      [disabled]="creating || updating || saving"
                    >
                      Disable
                    </button>
                  }
                } @else {
                  @if (auth.hasPermission('admin.users.update')) {
                    <button
                      type="button"
                      class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]"
                      (click)="toggleStatus(user)"
                      [disabled]="creating || updating || saving"
                    >
                      Enable
                    </button>
                  }
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td class="py-4 text-[var(--color-text-muted)] text-center" colspan="6">
                No administrators found.
              </td>
            </tr>
          }
        </tbody>
      </table>

      @if (meta.total > 0) {
        <div class="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
          <span>Showing {{ showingFrom }} to {{ showingTo }} of {{ meta.total }} administrators</span>
          <div class="flex gap-1">
            <button
              type="button"
              class="btn btn-sm btn-outline"
              [disabled]="meta.page === 1 || loading"
              (click)="previousPage()"
            >
              Prev
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline"
              [disabled]="meta.page * meta.pageSize >= meta.total || loading"
              (click)="nextPage()"
            >
              Next
            </button>
          </div>
        </div>
      }

      <app-admin-user-form
        *ngIf="createModal || editModal"
        [mode]="editModal ? 'edit' : 'create'"
        [user]="editingUser"
        [roles]="roles"
        [saving]="creating || updating"
        (save)="onFormSave($event)"
        (cancel)="closeModal()"
      ></app-admin-user-form>
    </div>
  `,
})
export class AdminUsersListComponent implements OnInit {
  users: AdminUser[] = [];
  roles: AdminRole[] = [];
  loading = false;
  error: string | null = null;
  creating = false;
  updating = false;
  saving = false;

  page = 1;
  pageSize = 10;
  meta: { total: number; page: number; pageSize: number } = { total: 0, page: 1, pageSize: 10 };
  showingFrom = 1;
  showingTo = 0;

  editingUser: AdminUser | null = null;
  createModal = false;
  editModal = false;

  private readonly http: HttpClient;
  readonly auth: AuthService;
  private readonly config: { apiBaseUrl: string };
  private readonly notification: NotificationService;
  private readonly fb: FormBuilder;

  constructor(
    @Inject(HttpClient) http: HttpClient,
    @Inject(AuthService) auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) config: { apiBaseUrl: string },
    @Inject(NotificationService) notification: NotificationService,
    @Inject(FormBuilder) fb: FormBuilder,
  ) {
    this.http = http;
    this.auth = auth;
    this.config = config;
    this.notification = notification;
    this.fb = fb;
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<AdminUserPage>(
        `${this.config.apiBaseUrl}/v1/admin/users?page=${this.page}&pageSize=${this.pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.users = res?.items ?? [];
          this.meta = res?.meta ?? { total: 0, page: this.page, pageSize: this.pageSize };
          this.showingFrom = this.meta.total > 0 ? (this.meta.page - 1) * this.meta.pageSize + 1 : 0;
          this.showingTo = this.meta.total > 0 ? Math.min(this.meta.page * this.meta.pageSize, this.meta.total) : 0;
        },
        error: (err: unknown) => {
          this.reportError(err, 'Failed to load administrators');
        },
      });
  }

  loadRoles(): void {
    const token = this.auth.token;
    this.http
      .get<{ items: AdminRole[] }>(
        `${this.config.apiBaseUrl}/v1/admin/roles`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(catchError(() => EMPTY))
      .subscribe({
        next: (res) => {
          this.roles = res?.items ?? [];
        },
      });
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.page * this.pageSize < this.meta.total) {
      this.page++;
      this.loadUsers();
    }
  }

  openCreateModal(): void {
    this.editingUser = null;
    this.editModal = false;
    this.error = null;
    this.createModal = true;
  }

  openEditModal(user: AdminUser): void {
    this.editingUser = user;
    this.createModal = false;
    this.error = null;
    this.editModal = true;
  }

  closeModal(): void {
    this.createModal = false;
    this.editModal = false;
    this.editingUser = null;
    this.saving = false;
    this.creating = false;
    this.updating = false;
  }

  onFormSave(value: { email?: string; password?: string; displayName: string; status?: 'active' | 'disabled'; roleId: string }): void {
    const token = this.auth.token;
    const editingUser = this.editingUser;
    this.error = null;

    if (this.editModal && editingUser) {
      this.updating = true;
      const body = {
        displayName: value.displayName,
        ...(value.status !== undefined && { status: value.status }),
        ...(value.roleId !== undefined && { roleId: value.roleId }),
      };
      this.http
        .patch(`${this.config.apiBaseUrl}/v1/admin/users/${editingUser.id}`, body, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .subscribe({
          next: () => {
            this.updating = false;
            this.closeModal();
            this.notification.success(NOTIFICATION_MESSAGES.adminUser.update);
            this.loadUsers();
          },
          error: (err: unknown) => {
            this.updating = false;
            this.reportError(err, NOTIFICATION_MESSAGES.adminUser.updateFailed);
          },
        });
      return;
    }

    this.creating = true;
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/users`, value, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.creating = false;
          this.closeModal();
          this.notification.success(NOTIFICATION_MESSAGES.adminUser.create);
          this.page = 1;
          this.loadUsers();
        },
        error: (err: unknown) => {
          this.creating = false;
          this.reportError(err, NOTIFICATION_MESSAGES.adminUser.createFailed);
        },
      });
  }

  toggleStatus(user: AdminUser): void {
    const enable = user.status === 'disabled';
    if (!confirm(`${enable ? 'Enable' : 'Disable'} this administrator?`)) return;
    this.error = null;
    const token = this.auth.token;
    const request = enable
      ? this.http.patch(`${this.config.apiBaseUrl}/v1/admin/users/${user.id}`, { status: 'active' }, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : this.http.post(`${this.config.apiBaseUrl}/v1/admin/users/${user.id}/disable`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
    request
      .pipe(
        switchMap(() => this.loadUsersOnce(token)),
        catchError((err: any) => {
          this.error = extractErrorMessage(
            err,
            enable ? NOTIFICATION_MESSAGES.adminUser.enableFailed : NOTIFICATION_MESSAGES.adminUser.disableFailed,
          );
          return EMPTY;
        }),
      )
      .subscribe({
        next: () => {
          this.notification.success(
            enable ? NOTIFICATION_MESSAGES.adminUser.enable : NOTIFICATION_MESSAGES.adminUser.disable,
          );
        },
        error: () => {
          this.notification.error(
            extractErrorMessage(
              null as any,
              enable ? NOTIFICATION_MESSAGES.adminUser.enableFailed : NOTIFICATION_MESSAGES.adminUser.disableFailed,
            ),
          );
        },
      });
  }

  private reportError(error: unknown, fallback: string): void {
    const message = extractErrorMessage(error, fallback);
    this.error = message;
    this.notification.error(message);
  }

  private loadUsersOnce(token: string | null) {
    return this.http.get<AdminUserPage>(
      `${this.config.apiBaseUrl}/v1/admin/users?page=${this.page}&pageSize=${this.pageSize}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }
}
