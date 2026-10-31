import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
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

  private toObservable(response: any): { toPromise: () => Promise<any>; pipe: <R>(fn: (obs: any) => R) => R } {
    return {
      toPromise: () => Promise.resolve(response),
      pipe: <R>(fn: (obs: any) => R) => fn(response),
    };
  }

  post(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method: 'POST', url, body, headers: options?.headers });
    const response = this.responses[url];
    if (response instanceof Error) {
      return { toPromise: () => Promise.reject(response), pipe: (_fn: any) => response as any };
    }
    return this.toObservable(response);
  }

  get(url: string, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method: 'GET', url, headers: options?.headers });
    const response = this.responses[url];
    if (response instanceof Error) {
      return { toPromise: () => Promise.reject(response), pipe: (_fn: any) => response as any };
    }
    return this.toObservable(response);
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
    const lastLogin = http.getLastRequest('POST', `${baseUrl}/admin/auth/login`);
    const lastRefresh = http.getLastRequest('POST', `${baseUrl}/admin/auth/refresh`);
    const lastLogout = http.getLastRequest('POST', `${baseUrl}/admin/auth/logout`);
    const lastMe = http.getLastRequest('GET', `${baseUrl}/admin/auth/me`);
    if (lastLogin) expect(lastLogin.method).toBe('POST');
    if (lastRefresh) expect(lastRefresh.method).toBe('POST');
    if (lastLogout) expect(lastLogout.method).toBe('POST');
    if (lastMe) expect(lastMe.method).toBe('GET');
  });

  it('should login successfully and store tokens', async () => {
    http.setResponse(`${baseUrl}/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: 'owner',
        permissions: ['*'],
      },
    });

    const session = await service.login('admin@example.com', 'password123');

    expect(session.accessToken).toBe('access-token-123');
    expect(service.isAuthenticated).toBe(true);
    expect(service.token).toBe('access-token-123');
    expect(service.user?.email).toBe('admin@example.com');
    expect(localStorage.getItem('admin_access_token')).toBe('access-token-123');
    expect(localStorage.getItem('admin_refresh_token')).toBe('refresh-token-123');
  });

  it('should refresh tokens successfully', async () => {
    // First login to set refresh token
    http.setResponse(`${baseUrl}/admin/auth/login`, {
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: 'owner',
        permissions: ['*'],
      },
    });
    await service.login('admin@example.com', 'password123');

    // Now refresh
    http.setResponse(`${baseUrl}/admin/auth/refresh`, {
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
      expiresIn: 3600,
    });

    const session = await service.refresh();
    expect(session.accessToken).toBe('access-token-2');
    expect(service.token).toBe('access-token-2');
    expect(localStorage.getItem('admin_access_token')).toBe('access-token-2');
  });

  it('should load current user via me endpoint', async () => {
    // Login first
    http.setResponse(`${baseUrl}/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: 'owner',
        permissions: ['*'],
      },
    });
    await service.login('admin@example.com', 'password123');

    // Call me
    http.setResponse(`${baseUrl}/admin/auth/me`, {
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: 'owner',
        permissions: ['admin.roles.read'],
      },
    });

    const user = await service.me();
    expect(user.email).toBe('admin@example.com');
    expect(user.permissions).toContain('admin.roles.read');
  });

  it('should clear tokens on logout', async () => {
    // Login first
    http.setResponse(`${baseUrl}/admin/auth/login`, {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        status: 'active',
        role: 'owner',
        permissions: ['*'],
      },
    });
    await service.login('admin@example.com', 'password123');

    // Logout
    http.setResponse(`${baseUrl}/admin/auth/logout`, null);
    await service.logout();

    expect(service.isAuthenticated).toBe(false);
    expect(service.token).toBeNull();
    expect(service.user).toBeNull();
    expect(localStorage.getItem('admin_access_token')).toBeNull();
    expect(localStorage.getItem('admin_refresh_token')).toBeNull();
  });

  it('should not be authenticated initially', () => {
    expect(service.isAuthenticated).toBe(false);
    expect(service.token).toBeNull();
    expect(service.user).toBeNull();
  });

  it('should throw on login failure', async () => {
    http.setResponse(`${baseUrl}/admin/auth/login`, new Error('Invalid credentials'));

    await expect(service.login('admin@example.com', 'wrong-password')).rejects.toThrow();
  });
});
