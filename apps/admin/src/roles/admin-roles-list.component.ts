import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';
import {
  extractErrorMessage,
  isGlobalHttpError,
  NOTIFICATION_MESSAGES,
} from '../core/notifications/notification-messages';
import { PageHeaderComponent, type PageBreadcrumb } from '../shared/ui/page-header/page-header.component';
import { ListToolbarComponent } from '../shared/ui/list-toolbar/list-toolbar.component';
import { AdminRoleFormComponent, type RoleFormValue } from './admin-role-form.component';
import {
  pageItems,
  pagePageSize,
  pageTotal,
  type PageResponse,
  type Permission,
  type Role,
  type RoleInput,
} from './roles.models';

const PAGE_SIZE = 100;

type RoleTypeFilter = 'all' | 'system' | 'custom';

@Component({
  selector: 'app-admin-roles-list',
  standalone: true,
  imports: [CommonModule, ButtonModule, PageHeaderComponent, ListToolbarComponent, AdminRoleFormComponent],
  template: `
    <div class="mx-auto max-w-[1200px] p-4">
      <app-page-header title="Roles" [breadcrumbs]="breadcrumbs">
        @if (auth.hasPermission('admin.roles.create')) {
          <p-button
            label="New role"
            severity="primary"
            (onClick)="openCreateModal()"
          ></p-button>
        }
      </app-page-header>

      <app-list-toolbar>
        <input
          type="search"
          class="toolbar-search"
          placeholder="Search by name or key"
          [value]="search"
          (input)="onSearchInput($event)"
        />
        <select class="toolbar-type" [value]="typeFilter" (change)="onTypeChange($event)">
          <option value="all">All roles</option>
          <option value="system">System</option>
          <option value="custom">Custom</option>
        </select>
      </app-list-toolbar>

      @if (error) {
        <div
          class="page-error mb-4 p-3 rounded border border-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm"
        >
          {{ error }}
        </div>
      }

      <table class="roles-table w-full border-collapse">
        <thead>
          <tr class="border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-sm">
            <th class="text-left pb-2">Name</th>
            <th class="text-left pb-2">Key</th>
            <th class="text-left pb-2">Scope</th>
            <th class="text-left pb-2">Type</th>
            <th class="text-left pb-2">Permissions</th>
            <th class="text-left pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          @if (loading) {
            <tr class="loading-row">
              <td class="py-4 text-center text-[var(--color-text-muted)]" colspan="6">Loading roles…</td>
            </tr>
          } @else {
            @for (role of filteredRoles; track role.id) {
              <tr class="role-row border-b border-[var(--color-border)]">
                <td class="py-3 text-[var(--color-text)]">{{ role.name }}</td>
                <td class="py-3 text-[var(--color-text-muted)]">{{ role.key }}</td>
                <td class="py-3 text-[var(--color-text-muted)] text-xs">{{ role.scope }}</td>
                <td class="py-3">
                  <span
                    class="role-type px-2 py-1 rounded text-xs font-medium"
                    [class.system]="role.system"
                    [class.custom]="!role.system"
                  >
                    {{ role.system ? 'System' : 'Custom' }}
                  </span>
                </td>
                <td class="py-3 text-[var(--color-text)]">{{ role.permissions.length }}</td>
                <td class="py-3 text-left">
                  @if (auth.hasPermission('admin.roles.update')) {
                    <button type="button" class="role-edit" (click)="openEditModal(role)">Edit</button>
                  }
                  @if (auth.hasPermission('admin.roles.delete') && !role.system) {
                    <button
                      type="button"
                      class="role-delete"
                      [disabled]="deleting"
                      (click)="deleteRole(role)"
                    >
                      Delete
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td class="py-4 text-center text-[var(--color-text-muted)]" colspan="6">
                  No roles found.
                </td>
              </tr>
            }
          }
        </tbody>
      </table>

      @if (createModal) {
        <app-admin-role-form
          [mode]="editingRole ? 'edit' : 'create'"
          [role]="editingRole"
          [permissions]="permissions"
          [permissionsLoading]="permissionsLoading"
          [permissionsError]="permissionsError"
          [saving]="saving"
          (save)="onSave($event)"
          (cancel)="closeModal()"
          (retryPermissions)="loadPermissions()"
        ></app-admin-role-form>
      }
    </div>
  `,
})
export class AdminRolesListComponent implements OnInit {
  readonly breadcrumbs: PageBreadcrumb[] = [
    { label: 'Dashboard', link: '/' },
    { label: 'Settings', link: '/settings' },
    { label: 'Roles' },
  ];

  roles: Role[] = [];
  permissions: Permission[] = [];
  loading = false;
  error: string | null = null;
  permissionsLoading = false;
  permissionsError: string | null = null;
  deleting = false;

  search = '';
  typeFilter: RoleTypeFilter = 'all';

  createModal = false;
  editingRole: Role | null = null;
  saving = false;

  private readonly http: HttpClient;
  readonly auth: AuthService;
  private readonly config: { apiBaseUrl: string };
  private readonly notification: NotificationService;

  constructor(
    @Inject(HttpClient) http: HttpClient,
    @Inject(AuthService) auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) config: { apiBaseUrl: string },
    @Inject(NotificationService) notification: NotificationService,
  ) {
    this.http = http;
    this.auth = auth;
    this.config = config;
    this.notification = notification;
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadPermissions();
  }

  get filteredRoles(): Role[] {
    const term = this.search.trim().toLowerCase();

    return this.roles.filter((role) => {
      if (this.typeFilter === 'system' && !role.system) {
        return false;
      }
      if (this.typeFilter === 'custom' && role.system) {
        return false;
      }
      if (term.length === 0) {
        return true;
      }
      return role.name.toLowerCase().includes(term) || role.key.toLowerCase().includes(term);
    });
  }

  loadRoles(): void {
    this.loading = true;
    this.error = null;

    this.fetchAllPages<Role>('roles').subscribe({
      next: (roles) => {
        this.roles = roles;
        this.loading = false;
      },
      error: (err: unknown) => {
        this.loading = false;
        this.reportError(err, 'Failed to load roles');
      },
    });
  }

  loadPermissions(): void {
    this.permissionsLoading = true;
    this.permissionsError = null;

    this.fetchAllPages<Permission>('permissions').subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.permissionsLoading = false;
      },
      error: (err: unknown) => {
        this.permissions = [];
        this.permissionsLoading = false;
        this.permissionsError = extractErrorMessage(err, 'Failed to load permissions');
        this.reportError(err, 'Failed to load permissions');
      },
    });
  }

  onSearchInput(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
  }

  onTypeChange(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value as RoleTypeFilter;
  }

  openCreateModal(): void {
    this.editingRole = null;
    this.createModal = true;
  }

  openEditModal(role: Role): void {
    this.editingRole = role;
    this.createModal = true;
  }

  closeModal(): void {
    this.createModal = false;
    this.editingRole = null;
    this.saving = false;
  }

  onSave(value: RoleFormValue): void {
    const token = this.auth.token;
    const headers = { Authorization: `Bearer ${token}` };
    this.saving = true;

    if (this.editingRole) {
      const roleId = this.editingRole.id;
      const body: { name: string; description?: string; permissionKeys: string[] } = {
        name: value.name,
        permissionKeys: value.permissionKeys,
      };
      if (value.description !== undefined) {
        body.description = value.description;
      }

      this.http
        .patch(`${this.config.apiBaseUrl}/v1/admin/roles/${roleId}`, body, { headers })
        .subscribe({
          next: () => this.finishSave(NOTIFICATION_MESSAGES.role.update),
          error: (err: unknown) => {
            this.saving = false;
            this.reportError(err, NOTIFICATION_MESSAGES.role.updateFailed);
          },
        });
      return;
    }

    const body: RoleInput = {
      key: value.key,
      name: value.name,
      ...(value.description !== undefined ? { description: value.description } : {}),
      scope: 'store',
      permissionKeys: value.permissionKeys,
    };

    this.http.post(`${this.config.apiBaseUrl}/v1/admin/roles`, body, { headers }).subscribe({
      next: () => this.finishSave(NOTIFICATION_MESSAGES.role.create),
      error: (err: unknown) => {
        this.saving = false;
        this.reportError(err, NOTIFICATION_MESSAGES.role.createFailed);
      },
    });
  }

  private finishSave(message: string): void {
    this.saving = false;
    this.closeModal();
    this.notification.success(message);
    this.loadRoles();
  }

  deleteRole(role: Role): void {
    if (!confirm(`Delete the role "${role.name}"?`)) {
      return;
    }

    this.deleting = true;
    this.error = null;
    const token = this.auth.token;

    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/roles/${role.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: () => {
          this.deleting = false;
          this.notification.success(NOTIFICATION_MESSAGES.role.delete);
          this.loadRoles();
        },
        error: (err: unknown) => {
          this.deleting = false;
          this.reportError(err, NOTIFICATION_MESSAGES.role.deleteFailed);
        },
      });
  }

  private fetchAllPages<T>(resource: 'roles' | 'permissions'): Observable<T[]> {
    return this.fetchPage<T>(resource, 1).pipe(
      switchMap((first) => {
        const items = pageItems(first);
        const total = pageTotal(first);
        const pageSize = pagePageSize(first, PAGE_SIZE);
        const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 1;

        if (pageCount <= 1) {
          return of(items);
        }

        const remaining = Array.from({ length: pageCount - 1 }, (_, index) =>
          this.fetchPage<T>(resource, index + 2),
        );

        return forkJoin(remaining).pipe(
          map((pages) => pages.reduce((all, page) => all.concat(pageItems(page)), items)),
        );
      }),
    );
  }

  private fetchPage<T>(resource: 'roles' | 'permissions', page: number): Observable<PageResponse<T>> {
    const token = this.auth.token;

    return this.http.get<PageResponse<T>>(
      `${this.config.apiBaseUrl}/v1/admin/${resource}?page=${page}&pageSize=${PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  private reportError(error: unknown, fallback: string): void {
    const message = extractErrorMessage(error, fallback);
    this.error = message;

    if (!(error instanceof HttpErrorResponse) || !isGlobalHttpError(error.status)) {
      this.notification.error(message);
    }
  }
}
