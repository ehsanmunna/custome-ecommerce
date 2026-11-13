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
import { FormBuilder } from '@angular/forms';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AdminUsersListComponent } from './admin-users-list.component';
import { AuthService } from '../auth/auth.service';
import {
  ADMIN_AUTH_CONFIG,
  defaultAdminAuthConfig,
  type AdminAuthConfig,
} from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

Object.defineProperty(globalThis, 'confirm', { value: () => true, writable: true });

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

class MockHttpClient {
  private responses: Record<string, any> = {};
  private errors: Record<string, Error> = {};
  private requests: Array<{ method: string; url: string; body?: any; headers?: Record<string, string> }> = [];

  private key(method: string, url: string): string {
    return `${method} ${url.split('?')[0]}`;
  }

  setResponse(method: HttpMethod, url: string, response: any) {
    this.responses[this.key(method, url)] = response;
  }

  setError(method: HttpMethod, url: string, error: Error) {
    this.errors[this.key(method, url)] = error;
  }

  private request<T>(method: string, url: string, body?: any, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method, url, body, headers: options?.headers });
    const key = this.key(method, url);
    const error = this.errors[key];
    if (error) {
      return throwError(() => error);
    }
    return of(this.responses[key]);
  }

  get<T>(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('GET', url, undefined, options);
  }

  post<T>(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('POST', url, body, options);
  }

  patch<T>(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('PATCH', url, body, options);
  }

  delete(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request('DELETE', url, undefined, options);
  }

  getLastRequest(method: string, url: string) {
    return this.requests.find((r) => r.method === method && r.url === url);
  }

  getRequests(method: string, url: string) {
    return this.requests.filter((r) => r.method === method && r.url.split('?')[0] === url.split('?')[0]);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

const notification = {
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

const userFixture: any = {
  id: 'user-1',
  email: 'admin@example.com',
  displayName: 'Admin User',
  status: 'active',
  role: { id: 'role-1', key: 'manager', name: 'Manager', scope: 'store', system: false, permissions: [] },
  permissions: [],
};

function listResponse(items: any[]) {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 10,
    meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1 },
  };
}

describe('AdminUsersListComponent', () => {
  let component: AdminUsersListComponent;
  let http: MockHttpClient;
  let auth: AuthService;
  let fb: FormBuilder;

  const seedList = (items: any[] = [userFixture]) => {
    http.setResponse('GET', `${baseUrl}/v1/admin/users`, listResponse(items));
    http.setResponse('GET', `${baseUrl}/v1/admin/roles`, { items: [], total: 0, page: 1, pageSize: 20 });
  };

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();
    fb = new FormBuilder();
    notification.success.mockClear();
    notification.error.mockClear();
    component = new AdminUsersListComponent(http as any, auth, config, notification as any, fb);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load administrators successfully', () => {
    seedList();

    component.ngOnInit();

    expect(component.users.length).toBe(1);
    expect(component.users[0].email).toBe('admin@example.com');
    const req = http.getLastRequest('GET', `${baseUrl}/v1/admin/users?page=1&pageSize=10`);
    expect(req).toBeDefined();
  });

  it('should report a failed list load without treating it as a save failure', () => {
    http.setError(
      'GET',
      `${baseUrl}/v1/admin/users`,
      new HttpErrorResponse({ error: { message: 'List unavailable' }, status: 500 }),
    );
    http.setResponse('GET', `${baseUrl}/v1/admin/roles`, { items: [] });

    component.ngOnInit();

    expect(component.error).toBe('List unavailable');
    expect(notification.error).toHaveBeenCalledWith('List unavailable');
  });

  it('should create an administrator, confirm the save, and return to the refreshed list', () => {
    seedList([userFixture]);
    http.setResponse('POST', `${baseUrl}/v1/admin/users`, { id: 'user-new', ...userFixture });
    component.createModal = true;
    component.page = 2;

    component.ngOnInit();
    component.onFormSave({
      email: 'new@example.com',
      password: 'Str0ngPass123',
      displayName: 'New Admin',
      roleId: 'role-1',
    });

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/users`);
    expect(req).toBeDefined();
    expect(req!.body.email).toBe('new@example.com');
    expect(component.createModal).toBe(false);
    expect(component.error).toBeNull();
    expect(notification.success).toHaveBeenCalledWith('Administrator created');
    expect(component.page).toBe(1);
    const refreshes = http.getRequests('GET', `${baseUrl}/v1/admin/users`);
    expect(refreshes[refreshes.length - 1].url).toContain('page=1');
  });

  it('should update an administrator and display the refreshed values', () => {
    const updated = { ...userFixture, displayName: 'Renamed Admin' };
    seedList([updated]);
    http.setResponse('PATCH', `${baseUrl}/v1/admin/users/user-1`, updated);

    component.ngOnInit();
    component.editModal = true;
    component.editingUser = userFixture;
    component.onFormSave({ displayName: 'Renamed Admin', roleId: 'role-1', status: 'active' });

    const req = http.getLastRequest('PATCH', `${baseUrl}/v1/admin/users/user-1`);
    expect(req).toBeDefined();
    expect(req!.body.displayName).toBe('Renamed Admin');
    expect(component.editModal).toBe(false);
    expect(component.users[0].displayName).toBe('Renamed Admin');
    expect(notification.success).toHaveBeenCalledWith('Administrator updated');
  });

  it('should confirm the save even when the refresh fails', () => {
    http.setResponse('POST', `${baseUrl}/v1/admin/users`, { id: 'user-new', ...userFixture });
    http.setError(
      'GET',
      `${baseUrl}/v1/admin/users`,
      new HttpErrorResponse({ error: { message: 'Refresh failed' }, status: 500 }),
    );
    http.setResponse('GET', `${baseUrl}/v1/admin/roles`, { items: [] });

    component.ngOnInit();
    component.createModal = true;
    component.onFormSave({
      email: 'new@example.com',
      password: 'Str0ngPass123',
      displayName: 'New Admin',
      roleId: 'role-1',
    });

    expect(notification.success).toHaveBeenCalledWith('Administrator created');
    expect(component.createModal).toBe(false);
    expect(component.error).toBe('Refresh failed');
    expect(notification.error).toHaveBeenCalledWith('Refresh failed');
  });

  it('should keep the form open and values intact when the save fails', () => {
    seedList([]);
    http.setError(
      'POST',
      `${baseUrl}/v1/admin/users`,
      new HttpErrorResponse({ error: { message: 'Email already exists' }, status: 409 }),
    );

    component.ngOnInit();
    component.createModal = true;
    component.onFormSave({
      email: 'dup@example.com',
      password: 'Str0ngPass123',
      displayName: 'Dup Admin',
      roleId: 'role-1',
    });

    expect(component.createModal).toBe(true);
    expect(component.creating).toBe(false);
    expect(component.error).toBe('Email already exists');
    expect(notification.error).toHaveBeenCalledWith('Email already exists');
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('should keep the edited user available when the update fails', () => {
    seedList([userFixture]);
    http.setError(
      'PATCH',
      `${baseUrl}/v1/admin/users/user-1`,
      new HttpErrorResponse({ error: { message: 'Role is required' }, status: 400 }),
    );

    component.ngOnInit();
    component.editModal = true;
    component.editingUser = userFixture;
    component.onFormSave({ displayName: 'Changed', roleId: '', status: 'disabled' });

    expect(component.editModal).toBe(true);
    expect(component.editingUser).toBe(userFixture);
    expect(component.error).toBe('Role is required');
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('should disable an administrator successfully', () => {
    seedList();
    http.setResponse('POST', `${baseUrl}/v1/admin/users/user-1/disable`, null);
    http.setResponse('GET', `${baseUrl}/v1/admin/users`, listResponse([{ ...userFixture, status: 'disabled' }]));

    component.ngOnInit();
    component.toggleStatus(userFixture);

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/users/user-1/disable`);
    expect(req).toBeDefined();
    expect(component.users[0].status).toBe('disabled');
    expect(notification.success).toHaveBeenCalledWith('Administrator disabled');
  });
});

describe('AdminUsersListComponent row actions', () => {
  let http: MockHttpClient;
  let permissions: Set<string>;

  const authStub = () => ({
    token: 'test-token',
    hasPermission: (permission: string) => permissions.has(permission),
  });

  const createFixture = (items: any[]) => {
    http.setResponse('GET', `${baseUrl}/v1/admin/users`, listResponse(items));
    http.setResponse('GET', `${baseUrl}/v1/admin/roles`, { items: [], total: 0, page: 1, pageSize: 20 });

    TestBed.configureTestingModule({
      imports: [
        AdminUsersListComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: { menu: { users: 'Users' } } },
          translocoConfig: { defaultLang: 'en', availableLangs: ['en'] },
        }),
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HttpClient, useValue: http },
        { provide: AuthService, useValue: authStub() },
        { provide: ADMIN_AUTH_CONFIG, useValue: config },
        { provide: NotificationService, useValue: notification },
        { provide: FormBuilder, useValue: new FormBuilder() },
      ],
    });

    const fixture = TestBed.createComponent(AdminUsersListComponent);
    fixture.detectChanges();
    return fixture;
  };

  const actionButtons = (fixture: any): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('tbody button')) as HTMLButtonElement[];

  const findButton = (fixture: any, label: string): HTMLButtonElement | undefined =>
    actionButtons(fixture).find((button) => button.textContent?.trim() === label);

  beforeEach(() => {
    http = new MockHttpClient();
    permissions = new Set<string>();
    notification.success.mockClear();
    notification.error.mockClear();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render Products-style Edit and Disable actions with a left-aligned Actions column', () => {
    permissions.add('admin.users.update');
    permissions.add('admin.users.disable');

    const fixture = createFixture([userFixture]);
    const edit = findButton(fixture, 'Edit');
    const disable = findButton(fixture, 'Disable');

    expect(edit).toBeDefined();
    expect(disable).toBeDefined();
    expect(edit!.className).toContain('px-4');
    expect(edit!.className).toContain('py-2');
    expect(edit!.className).toContain('border-none');
    expect(edit!.className).toContain('rounded-md');
    expect(edit!.className).toContain('bg-[var(--color-primary)]');
    expect(disable!.className).toContain('bg-[var(--color-danger)]');
    expect(edit!.closest('td')!.className).toContain('text-left');
    expect(edit!.closest('td')!.className).not.toContain('text-right');

    const actionsHeader = (Array.from(fixture.nativeElement.querySelectorAll('th')) as HTMLElement[]).find(
      (header) => header.textContent?.trim() === 'Actions',
    );
    expect(actionsHeader).toBeDefined();
    expect(actionsHeader!.className).toContain('text-left');
    expect(actionsHeader!.className).not.toContain('text-right');
  });

  it('should show Edit and Enable for a disabled user when update is permitted', () => {
    permissions.add('admin.users.update');

    const fixture = createFixture([{ ...userFixture, status: 'disabled' }]);

    expect(findButton(fixture, 'Edit')).toBeDefined();
    expect(findButton(fixture, 'Enable')).toBeDefined();
    expect(findButton(fixture, 'Disable')).toBeUndefined();
  });

  it('should hide the Disable action without the disable permission', () => {
    permissions.add('admin.users.update');

    const fixture = createFixture([userFixture]);

    expect(findButton(fixture, 'Edit')).toBeDefined();
    expect(findButton(fixture, 'Disable')).toBeUndefined();
  });

  it('should hide all row actions without update or disable permissions', () => {
    const fixture = createFixture([userFixture]);

    expect(actionButtons(fixture).length).toBe(0);
  });
});
