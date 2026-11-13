// @vitest-environment jsdom
import '@angular/compiler';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AdminRolesListComponent } from './admin-roles-list.component';
import { AuthService } from '../auth/auth.service';
import {
  ADMIN_AUTH_CONFIG,
  defaultAdminAuthConfig,
  type AdminAuthConfig,
} from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';
import { NOTIFICATION_MESSAGES } from '../core/notifications/notification-messages';
import type { Permission, Role } from './roles.models';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

Object.defineProperty(globalThis, 'confirm', { value: () => true, writable: true });

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

class MockHttpClient {
  private responses: Record<string, any> = {};
  private errors: Record<string, Error> = {};
  private requests: Array<{ method: string; url: string; body?: any }> = [];

  private key(method: string, url: string): string {
    return `${method} ${url}`;
  }

  setResponse(method: HttpMethod, url: string, response: any) {
    this.responses[this.key(method, url)] = response;
  }

  setError(method: HttpMethod, url: string, error: Error) {
    this.errors[this.key(method, url)] = error;
  }

  private request(method: string, url: string, body?: any): any {
    this.requests.push({ method, url, body });
    const key = this.key(method, url);
    const error = this.errors[key];
    if (error) {
      return throwError(() => error);
    }
    return of(this.responses[key]);
  }

  get<T>(url: string): any {
    return this.request('GET', url);
  }

  post<T>(url: string, body: any): any {
    return this.request('POST', url, body);
  }

  patch<T>(url: string, body: any): any {
    return this.request('PATCH', url, body);
  }

  delete(url: string): any {
    return this.request('DELETE', url);
  }

  getRequests(method: string, path: string) {
    return this.requests.filter(
      (request) => request.method === method && request.url.split('?')[0] === path,
    );
  }

  getLastRequest(method: string, url: string) {
    return this.requests.find((request) => request.method === method && request.url === url);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

const rolesUrl = (page = 1) => `${baseUrl}/v1/admin/roles?page=${page}&pageSize=100`;
const permissionsUrl = (page = 1) => `${baseUrl}/v1/admin/permissions?page=${page}&pageSize=100`;

const notification = {
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

const ownerRole: Role = {
  id: 'role-owner',
  key: 'owner',
  name: 'Owner',
  description: 'Store owner',
  scope: 'store',
  system: true,
  permissions: ['admin.roles.read', 'admin.roles.update'],
};

const staffRole: Role = {
  id: 'role-staff',
  key: 'staff',
  name: 'Staff',
  scope: 'store',
  system: false,
  permissions: ['admin.roles.read'],
};

const permissionCatalog: Permission[] = [
  { key: 'admin.roles.read', description: 'View roles', group: 'admin-roles', sortOrder: 10 },
  { key: 'admin.roles.update', description: 'Update roles', group: 'admin-roles', sortOrder: 20 },
  { key: 'catalog.products.read', description: 'View products', group: 'catalog', sortOrder: 30 },
];

function metaResponse<T>(items: T[], total = items.length, pageSize = 100) {
  return { items, meta: { page: 1, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

function seedCatalog(http: MockHttpClient, page = 1, items: Permission[] = permissionCatalog) {
  http.setResponse('GET', permissionsUrl(page), metaResponse(items));
}

describe('AdminRolesListComponent data loading', () => {
  let component: AdminRolesListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();
    notification.success.mockClear();
    notification.error.mockClear();
    component = new AdminRolesListComponent(http as any, auth, config, notification as any);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('loads roles and the permission catalog with a page size of 100', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);

    component.ngOnInit();

    expect(component.roles).toHaveLength(2);
    expect(component.permissions).toHaveLength(3);
    expect(component.loading).toBe(false);
    expect(http.getLastRequest('GET', rolesUrl())).toBeDefined();
    expect(http.getLastRequest('GET', permissionsUrl())).toBeDefined();
  });

  it('fetches the remaining role pages when the reported total exceeds one page', () => {
    http.setResponse('GET', rolesUrl(1), metaResponse([ownerRole], 150));
    http.setResponse('GET', rolesUrl(2), metaResponse([staffRole], 150));
    seedCatalog(http);

    component.ngOnInit();

    expect(http.getLastRequest('GET', rolesUrl(2))).toBeDefined();
    expect(component.roles).toHaveLength(2);
  });

  it('shows an inline load error and leaves the toast to the interceptor for global failures', () => {
    http.setError(
      'GET',
      rolesUrl(),
      new HttpErrorResponse({ error: { message: 'Roles unavailable' }, status: 500 }),
    );
    seedCatalog(http);

    component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(component.error).toBe('Roles unavailable');
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('reports a permission catalog failure and keeps the catalog empty', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole]));
    http.setError(
      'GET',
      permissionsUrl(),
      new HttpErrorResponse({ error: { message: 'Catalog unavailable' }, status: 400 }),
    );

    component.ngOnInit();

    expect(component.permissions).toEqual([]);
    expect(component.permissionsError).toBe('Catalog unavailable');
    expect(notification.error).toHaveBeenCalledWith('Catalog unavailable');
  });

  it('deletes a custom role, confirms it, and refreshes the list', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);
    http.setResponse('DELETE', `${baseUrl}/v1/admin/roles/role-staff`, {});

    component.ngOnInit();
    http.clearRequests();
    component.deleteRole(staffRole);

    expect(http.getLastRequest('DELETE', `${baseUrl}/v1/admin/roles/role-staff`)).toBeDefined();
    expect(notification.success).toHaveBeenCalledWith(NOTIFICATION_MESSAGES.role.delete);
    expect(http.getRequests('GET', `${baseUrl}/v1/admin/roles`)).toHaveLength(1);
    expect(component.deleting).toBe(false);
  });

  it('keeps the role and reports the conflict when deletion is rejected', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);
    http.setError(
      'DELETE',
      `${baseUrl}/v1/admin/roles/role-staff`,
      new HttpErrorResponse({ error: { message: 'Role is assigned to administrators' }, status: 409 }),
    );

    component.ngOnInit();
    component.deleteRole(staffRole);

    expect(component.roles).toHaveLength(2);
    expect(component.error).toBe('Role is assigned to administrators');
    expect(notification.error).toHaveBeenCalledWith('Role is assigned to administrators');
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('creates a role, confirms the save, and refreshes the list', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);
    http.setResponse('POST', `${baseUrl}/v1/admin/roles`, { id: 'role-auditor' });

    component.ngOnInit();
    component.openCreateModal();
    http.clearRequests();
    component.onSave({
      key: 'auditor',
      name: 'Auditor',
      description: 'Reads everything',
      permissionKeys: ['admin.roles.read'],
    });

    const request = http.getLastRequest('POST', `${baseUrl}/v1/admin/roles`);
    expect(request).toBeDefined();
    expect(request!.body).toEqual({
      key: 'auditor',
      name: 'Auditor',
      description: 'Reads everything',
      scope: 'store',
      permissionKeys: ['admin.roles.read'],
    });
    expect(component.createModal).toBe(false);
    expect(component.saving).toBe(false);
    expect(notification.success).toHaveBeenCalledWith(NOTIFICATION_MESSAGES.role.create);
    expect(http.getRequests('GET', `${baseUrl}/v1/admin/roles`)).toHaveLength(1);
  });

  it('updates only the editable role fields', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);
    http.setResponse('PATCH', `${baseUrl}/v1/admin/roles/role-staff`, {});

    component.ngOnInit();
    component.openEditModal(staffRole);
    http.clearRequests();
    component.onSave({
      key: 'ignored-key',
      name: 'Support staff',
      description: 'Handles tickets',
      permissionKeys: ['admin.roles.read', 'catalog.products.read'],
    });

    const request = http.getLastRequest('PATCH', `${baseUrl}/v1/admin/roles/role-staff`);
    expect(request).toBeDefined();
    expect(request!.body).toEqual({
      name: 'Support staff',
      description: 'Handles tickets',
      permissionKeys: ['admin.roles.read', 'catalog.products.read'],
    });
    expect(request!.body.key).toBeUndefined();
    expect(request!.body.scope).toBeUndefined();
    expect(notification.success).toHaveBeenCalledWith(NOTIFICATION_MESSAGES.role.update);
  });

  it('keeps the form open with the entered values when the save is rejected', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole]));
    seedCatalog(http);
    http.setError(
      'POST',
      `${baseUrl}/v1/admin/roles`,
      new HttpErrorResponse({ error: { message: 'Role key already exists' }, status: 409 }),
    );

    component.ngOnInit();
    component.openCreateModal();
    component.onSave({ key: 'owner', name: 'Owner copy', permissionKeys: ['admin.roles.read'] });

    expect(component.createModal).toBe(true);
    expect(component.saving).toBe(false);
    expect(component.error).toBe('Role key already exists');
    expect(notification.error).toHaveBeenCalledWith('Role key already exists');
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('confirms the save even when the refresh fails', () => {
    http.setResponse('POST', `${baseUrl}/v1/admin/roles`, { id: 'role-auditor' });
    http.setError(
      'GET',
      rolesUrl(),
      new HttpErrorResponse({ error: { message: 'Refresh failed' }, status: 500 }),
    );
    seedCatalog(http);

    component.ngOnInit();
    component.openCreateModal();
    component.onSave({ key: 'auditor', name: 'Auditor', permissionKeys: ['admin.roles.read'] });

    expect(notification.success).toHaveBeenCalledWith(NOTIFICATION_MESSAGES.role.create);
    expect(component.createModal).toBe(false);
    expect(component.error).toBe('Refresh failed');
  });

  it('filters roles by name or key and by type', () => {
    http.setResponse('GET', rolesUrl(), metaResponse([ownerRole, staffRole]));
    seedCatalog(http);
    component.ngOnInit();

    component.search = 'staf';
    expect(component.filteredRoles.map((role) => role.key)).toEqual(['staff']);

    component.search = 'OWN';
    expect(component.filteredRoles.map((role) => role.key)).toEqual(['owner']);

    component.search = '';
    component.typeFilter = 'system';
    expect(component.filteredRoles.map((role) => role.key)).toEqual(['owner']);

    component.typeFilter = 'custom';
    expect(component.filteredRoles.map((role) => role.key)).toEqual(['staff']);
  });
});

describe('AdminRolesListComponent rendering', () => {
  let http: MockHttpClient;
  let permissions: Set<string>;

  const authStub = () => ({
    token: 'test-token',
    hasPermission: (permission: string) => permissions.has(permission),
  });

  const createFixture = (items: Role[]) => {
    http.setResponse('GET', rolesUrl(), metaResponse(items));
    seedCatalog(http);

    TestBed.configureTestingModule({
      imports: [AdminRolesListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HttpClient, useValue: http },
        { provide: AuthService, useValue: authStub() },
        { provide: ADMIN_AUTH_CONFIG, useValue: config },
        { provide: NotificationService, useValue: notification },
      ],
    });

    const fixture = TestBed.createComponent(AdminRolesListComponent);
    fixture.detectChanges();
    return fixture;
  };

  const rowText = (fixture: any): string[] =>
    (Array.from(fixture.nativeElement.querySelectorAll('.role-row')) as HTMLElement[]).map(
      (row) => row.textContent?.trim() ?? '',
    );

  const headerButton = (fixture: any, label: string): HTMLButtonElement | undefined =>
    Array.from(fixture.nativeElement.querySelectorAll('app-page-header button') as NodeListOf<HTMLButtonElement>).find(
      (button) => button.textContent?.trim() === label,
    );

  const actionsForRow = (fixture: any, index: number): HTMLButtonElement[] => {
    const rows = Array.from(fixture.nativeElement.querySelectorAll('.role-row')) as HTMLElement[];
    return Array.from(rows[index].querySelectorAll('button')) as HTMLButtonElement[];
  };

  beforeEach(() => {
    http = new MockHttpClient();
    permissions = new Set<string>();
    notification.success.mockClear();
    notification.error.mockClear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders breadcrumb, header, toolbar, and table in the required order', () => {
    permissions.add('admin.roles.create');
    const fixture = createFixture([ownerRole, staffRole]);

    const element: HTMLElement = fixture.nativeElement;
    const breadcrumb = element.querySelector('.page-header-breadcrumb') as HTMLElement;
    const headerRow = element.querySelector('.page-header-row') as HTMLElement;
    const toolbar = element.querySelector('.list-toolbar') as HTMLElement;
    const table = element.querySelector('.roles-table') as HTMLElement;

    expect(breadcrumb).not.toBeNull();
    expect(headerRow).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(table).not.toBeNull();
    expect(
      breadcrumb.compareDocumentPosition(headerRow) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      headerRow.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(toolbar.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the role columns and the New role action in the header row', () => {
    permissions.add('admin.roles.create');
    const fixture = createFixture([ownerRole, staffRole]);

    const newRole = headerButton(fixture, 'New role');
    expect(newRole).toBeDefined();
    expect(newRole!.closest('.page-header-row')).not.toBeNull();

    const rows = rowText(fixture);
    expect(rows[0]).toContain('Owner');
    expect(rows[0]).toContain('owner');
    expect(rows[0]).toContain('store');
    expect(rows[0]).toContain('System');
    expect(rows[0]).toContain('2');
    expect(rows[1]).toContain('Staff');
    expect(rows[1]).toContain('Custom');
  });

  it('hides the New role action without the create permission', () => {
    const fixture = createFixture([ownerRole]);

    expect(headerButton(fixture, 'New role')).toBeUndefined();
  });

  it('offers Edit for both role types but Delete only for custom roles', () => {
    permissions.add('admin.roles.update');
    permissions.add('admin.roles.delete');
    const fixture = createFixture([ownerRole, staffRole]);

    const systemActions = actionsForRow(fixture, 0).map((button) => button.textContent?.trim());
    const customActions = actionsForRow(fixture, 1).map((button) => button.textContent?.trim());

    expect(systemActions).toEqual(['Edit']);
    expect(customActions).toEqual(['Edit', 'Delete']);
  });

  it('hides every mutation action for a read-only administrator', () => {
    const fixture = createFixture([ownerRole, staffRole]);

    expect(headerButton(fixture, 'New role')).toBeUndefined();
    expect(actionsForRow(fixture, 0)).toHaveLength(0);
    expect(actionsForRow(fixture, 1)).toHaveLength(0);
  });

  it('narrows the table from the search field', () => {
    const fixture = createFixture([ownerRole, staffRole]);

    const search = fixture.nativeElement.querySelector('.toolbar-search') as HTMLInputElement;
    search.value = 'staff';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(rowText(fixture)).toHaveLength(1);
    expect(rowText(fixture)[0]).toContain('Staff');
  });

  it('narrows the table from the type filter', () => {
    const fixture = createFixture([ownerRole, staffRole]);

    const filter = fixture.nativeElement.querySelector('.toolbar-type') as HTMLSelectElement;
    filter.value = 'system';
    filter.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(rowText(fixture)).toHaveLength(1);
    expect(rowText(fixture)[0]).toContain('Owner');
  });
});
