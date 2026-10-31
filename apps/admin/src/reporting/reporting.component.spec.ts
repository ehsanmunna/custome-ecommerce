import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SalesMetricsComponent } from './sales-metrics.component';
import { LowStockIndicatorsComponent } from './low-stock-indicators.component';
import { AuthService } from '../auth/auth.service';
import { defaultAdminAuthConfig, AdminAuthConfig } from '../auth/auth.config';

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

  setError(url: string, error: Error) {
    this.responses[url] = error;
  }

  private request<T>(method: string, url: string, body?: any, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method, url, body, headers: options?.headers });
    const response = this.responses[url];
    if (response instanceof Error) {
      return { toPromise: () => Promise.reject(response), pipe: (_fn: any) => response as any };
    }
    return {
      toPromise: () => Promise.resolve(response),
      pipe: <R>(fn: (obs: T) => R) => fn(response),
    };
  }

  get<T>(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('GET', url, undefined, options);
  }

  getLastRequest(method: string, url: string) {
    return this.requests.find(r => r.method === method && r.url === url);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

function authWithPermissions(auth: AuthService, permissions: string[]) {
  auth.clear();
  localStorageMock.clear();
  (auth as any).currentUser = {
    id: 'admin-id',
    email: 'admin@example.com',
    displayName: 'Admin',
    status: 'active',
    role: 'owner',
    permissions,
  };
}

describe('SalesMetricsComponent', () => {
  let component: SalesMetricsComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    authWithPermissions(auth, ['analytics.read']);
    localStorage.clear();

    component = new SalesMetricsComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load sales metrics successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`, {
      orderCount: 25,
      revenue: { amount: 250000, currency: 'BDT' },
      averageOrderValue: { amount: 10000, currency: 'BDT' },
    });

    component.from = '2026-01-01T00:00:00.000Z';
    component.to = '2026-01-31T23:59:59.000Z';
    await component.loadOverview();

    expect(component.overview).toBeDefined();
    expect(component.overview!.orderCount).toBe(25);
    expect(component.overview!.revenue.amount).toBe(250000);
    expect(component.error).toBeNull();
  });

  it('should show empty state when there are no orders', async () => {
    http.setResponse(`${baseUrl}/v1/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`, {
      orderCount: 0,
      revenue: { amount: 0, currency: 'BDT' },
      averageOrderValue: { amount: 0, currency: 'BDT' },
    });

    component.from = '2026-01-01T00:00:00.000Z';
    component.to = '2026-01-31T23:59:59.000Z';
    await component.loadOverview();

    expect(component.overview!.orderCount).toBe(0);
    expect(component.overview!.revenue.amount).toBe(0);
    expect(component.error).toBeNull();
  });

  it('should handle API error for sales metrics', async () => {
    http.setError(`${baseUrl}/v1/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`, new Error('Forbidden: insufficient permissions'));

    component.from = '2026-01-01T00:00:00.000Z';
    component.to = '2026-01-31T23:59:59.000Z';
    await component.loadOverview();

    expect(component.error).toContain('insufficient permissions');
  });

  it('should call analytics overview API with correct params', async () => {
    http.setResponse(`${baseUrl}/v1/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`, {
      orderCount: 1,
      revenue: { amount: 1000, currency: 'BDT' },
      averageOrderValue: { amount: 1000, currency: 'BDT' },
    });

    component.from = '2026-01-01T00:00:00.000Z';
    component.to = '2026-01-31T23:59:59.000Z';
    await component.loadOverview();

    const req = http.getLastRequest('GET', `${baseUrl}/v1/admin/analytics/overview?from=2026-01-01T00:00:00.000Z&to=2026-01-31T23:59:59.000Z`);
    expect(req).toBeDefined();
    expect(req!.headers!['Authorization']).toContain('Bearer');
  });
});

describe('LowStockIndicatorsComponent', () => {
  let component: LowStockIndicatorsComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    authWithPermissions(auth, ['inventory.read']);
    localStorage.clear();

    component = new LowStockIndicatorsComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load low-stock indicators successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/inventory?lowStock=true`, {
      items: [
        {
          variantId: 'var-1',
          onHand: 2,
          reserved: 0,
          available: 2,
          lowStockThreshold: 5,
          lowStock: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.loadLowStock();

    expect(component.lowStockItems.length).toBe(1);
    expect(component.lowStockItems[0].variantId).toBe('var-1');
    expect(component.lowStockItems[0].lowStock).toBe(true);
    expect(component.error).toBeNull();
  });

  it('should show empty state when no low-stock variants', async () => {
    http.setResponse(`${baseUrl}/v1/admin/inventory?lowStock=true`, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await component.loadLowStock();

    expect(component.lowStockItems.length).toBe(0);
    expect(component.error).toBeNull();
  });

  it('should handle API error for low-stock indicators', async () => {
    http.setError(`${baseUrl}/v1/admin/inventory?lowStock=true`, new Error('Forbidden: insufficient permissions'));

    await component.loadLowStock();

    expect(component.error).toContain('insufficient permissions');
  });

  it('should call inventory API with lowStock param', async () => {
    http.setResponse(`${baseUrl}/v1/admin/inventory?lowStock=true`, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await component.loadLowStock();

    const req = http.getLastRequest('GET', `${baseUrl}/v1/admin/inventory?lowStock=true`);
    expect(req).toBeDefined();
    expect(req!.headers!['Authorization']).toContain('Bearer');
  });
});
