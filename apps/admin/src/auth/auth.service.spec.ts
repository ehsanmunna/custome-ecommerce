import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { AuthService, type AdminRole, type AdminUser, type AuthSession } from './auth.service';
import { defaultAdminAuthConfig } from './auth.config';

// Mock localStorage and window for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'window', { value: { localStorage: localStorageMock }, writable: true });

class MockHttpClient {
  private responses: Record<string, any> = {};
  private requests: Array<{ method: string; url: string; body?: any; headers?: Record<string, string> }> = [];

  setResponse(url: string, response: any) {
    this.responses[url] = response;
  }

  post(url: string, body: any, options?: { headers?: Record<string, string> }): Observable<any> {
    this.requests.push({ method: 'POST', url, body, headers: options?.headers });
    const response = this.responses[url];
    return response instanceof Error ? throwError(() => response) : of(response);
  }

  get(url: string, options?: { headers?: Record<string, string> }): Observable<any> {
    this.requests.push({ method: 'GET', url, headers: options?.headers });
    const response = this.responses[url];
    return response instanceof Error ? throwError(() => response) : of(response);
  }

  getLastRequest(method: string, url: string) {
    return this.requests.find(r => r.method === method && r.url === url);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

const ownerRole: AdminRole = {
  id: 'role-1',
  key: 'owner',
  name: 'Owner',
  scope: 'store',
  system: true,
  permissions: ['*'],
};

function adminUser(permissions: string[] = ['*']): AdminUser {
  return {
    id: 'user-1',
    email: 'admin@example.com',
    displayName: 'Admin User',
    status: 'active',
    role: ownerRole,
    permissions,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let http: MockHttpClient;

  beforeEach(() => {
    http = new MockHttpClient();
    service = new AuthService(http as any, config);
    service.clear();
    localStorage.clear();
  });

  afterEach(() => {
    const lastLogin = http.getLastRequest('POST', `${baseUrl}/v1/admin/auth/login`);
    const lastRefresh = http.getLastRequest('POST', `${baseUrl}/v1/admin/auth/refresh`);
    const lastLogout = http.getLastRequest('POST', `${baseUrl}/v1/admin/auth/logout`);
    const lastMe = http.getLastRequest('GET', `${baseUrl}/v1/admin/auth/me`);
    if (lastLogin) expect(lastLogin.method).toBe('POST');
    if (lastRefresh) expect(lastRefresh.method).toBe('POST');
    if (lastLogout) expect(lastLogout.method).toBe('POST');
    if (lastMe) expect(lastMe.method).toBe('GET');
  });

  it('should login successfully and store tokens', async () => {
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: ownerRole,
        permissions: ['*'],
      },
    });

    const session: AuthSession = await firstValueFrom(service.login('admin@example.com', 'password123'));

    expect(session.accessToken).toBe('access-token-123');
    expect(service.isAuthenticated).toBe(true);
    expect(service.token).toBe('access-token-123');
    expect(service.user?.email).toBe('admin@example.com');
    expect(localStorage.getItem('admin_access_token')).toBe('access-token-123');
    expect(localStorage.getItem('admin_refresh_token')).toBe('refresh-token-123');
    expect(Number(localStorage.getItem('admin_token_expiry'))).toBeGreaterThan(Date.now());
    expect(JSON.parse(localStorage.getItem('admin_user') ?? '{}')).toMatchObject({
      email: 'admin@example.com',
      role: { key: 'owner' },
    });
  });

  it('should not authenticate a session with an invalid lifetime', async () => {
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 0,
      user: adminUser(),
    });

    await firstValueFrom(service.login('admin@example.com', 'password123'));

    expect(service.isAuthenticated).toBe(false);
    expect(service.expiry).toBeNull();
    expect(localStorage.getItem('admin_token_expiry')).toBeNull();
  });

  it('should refresh tokens successfully', async () => {
    // First login to set refresh token
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: ownerRole,
        permissions: ['*'],
      },
    });
    await firstValueFrom(service.login('admin@example.com', 'password123'));

    // Now refresh
    http.setResponse(`${baseUrl}/v1/admin/auth/refresh`, {
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresIn: 3600,
    });

    const session: AuthSession = await firstValueFrom(service.refresh());
    expect(session.accessToken).toBe('access-token-2');
    expect(service.token).toBe('access-token-2');
    expect(localStorage.getItem('admin_access_token')).toBe('access-token-2');
  });

  it('should retain the refresh token when a refresh response omits it', async () => {
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 3600,
      user: adminUser(),
    });
    await firstValueFrom(service.login('admin@example.com', 'password123'));

    http.setResponse(`${baseUrl}/v1/admin/auth/refresh`, {
      accessToken: 'access-token-2',
      expiresIn: 3600,
    });

    await firstValueFrom(service.refresh());

    expect(service.token).toBe('access-token-2');
    expect(service.refreshTokenValue).toBe('refresh-token-1');
    expect(localStorage.getItem('admin_refresh_token')).toBe('refresh-token-1');
    expect(Number(localStorage.getItem('admin_token_expiry'))).toBeGreaterThan(Date.now());
  });

  it('should load current user via me endpoint', async () => {
    // Login first
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: ownerRole,
        permissions: ['*'],
      },
    });
    await firstValueFrom(service.login('admin@example.com', 'password123'));

    // Call me
    http.setResponse(`${baseUrl}/v1/admin/auth/me`, {
      id: 'user-1',
      email: 'admin@example.com',
      displayName: 'Admin User',
      status: 'active',
      role: ownerRole,
      permissions: ['admin.roles.read'],
    });

    const user: AdminUser = await firstValueFrom(service.me());
    expect(user.email).toBe('admin@example.com');
    expect(user.permissions).toContain('admin.roles.read');
    expect(JSON.parse(localStorage.getItem('admin_user') ?? '{}')).toMatchObject({
      email: 'admin@example.com',
      permissions: ['admin.roles.read'],
    });
  });

  it('should clear tokens on logout', async () => {
    // Login first
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: ownerRole,
        permissions: ['*'],
      },
    });
    await firstValueFrom(service.login('admin@example.com', 'password123'));

    // Logout
    http.setResponse(`${baseUrl}/v1/admin/auth/logout`, null);
    await firstValueFrom(service.logout());

    expect(service.isAuthenticated).toBe(false);
    expect(service.token).toBeNull();
    expect(service.user).toBeNull();
    expect(localStorage.getItem('admin_access_token')).toBeNull();
    expect(localStorage.getItem('admin_refresh_token')).toBeNull();
    expect(localStorage.getItem('admin_token_expiry')).toBeNull();
    expect(localStorage.getItem('admin_user')).toBeNull();
  });

  it('should restore the persisted session, expiry, and typed user on startup', () => {
    const expiresAt = Date.now() + 60_000;
    localStorage.setItem('admin_access_token', 'stored-access-token');
    localStorage.setItem('admin_refresh_token', 'stored-refresh-token');
    localStorage.setItem('admin_token_expiry', String(expiresAt));
    localStorage.setItem('admin_user', JSON.stringify(adminUser(['analytics.read'])));

    const restored = new AuthService(http as any, config);

    expect(restored.isAuthenticated).toBe(true);
    expect(restored.token).toBe('stored-access-token');
    expect(restored.refreshTokenValue).toBe('stored-refresh-token');
    expect(restored.expiry).toBe(expiresAt);
    expect(restored.user?.email).toBe('admin@example.com');
    expect(restored.roleKey).toBe('owner');
    expect(restored.role?.name).toBe('Owner');
    expect(restored.hasRole('owner')).toBe(true);
    expect(restored.hasAnyRole(['manager', 'owner'])).toBe(true);
    expect(restored.hasAnyRole(['manager'])).toBe(false);
    expect(restored.hasPermission('analytics.read')).toBe(true);
    expect(restored.hasAnyPermission(['orders.read', 'analytics.read'])).toBe(true);
  });

  it('should treat a persisted session as expired after its expiry passes', () => {
    localStorage.setItem('admin_access_token', 'expired-access-token');
    localStorage.setItem('admin_refresh_token', 'stored-refresh-token');
    localStorage.setItem('admin_token_expiry', String(Date.now() - 1_000));
    localStorage.setItem('admin_user', JSON.stringify(adminUser()));

    const restored = new AuthService(http as any, config);

    expect(restored.isAuthenticated).toBe(false);
    expect(restored.refreshTokenValue).toBe('stored-refresh-token');
  });

  it.each(['', 'not-a-number', '0'])(
    'should treat stored expiry %j as unauthenticated',
    (storedExpiry) => {
      localStorage.setItem('admin_access_token', 'stored-access-token');
      localStorage.setItem('admin_refresh_token', 'stored-refresh-token');
      localStorage.setItem('admin_token_expiry', storedExpiry);
      localStorage.setItem('admin_user', JSON.stringify(adminUser()));

      const restored = new AuthService(http as any, config);

      expect(restored.isAuthenticated).toBe(false);
      expect(restored.expiry).toBeNull();
    },
  );

  it('should not be authenticated initially', () => {
    expect(service.isAuthenticated).toBe(false);
    expect(service.token).toBeNull();
    expect(service.user).toBeNull();
  });

  it('should throw on login failure', async () => {
    http.setResponse(`${baseUrl}/v1/admin/auth/login`, new Error('Invalid credentials'));

    await expect(firstValueFrom(service.login('admin@example.com', 'wrong-password'))).rejects.toThrow();
  });
});
