import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ShippingZoneListComponent } from './shipping-zone-list.component';
import { CouponListComponent } from './coupon-list.component';
import { AuthService } from '../auth/auth.service';
import { defaultAdminAuthConfig, AdminAuthConfig } from '../auth/auth.config';
import { FormBuilder } from '@angular/forms';

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
Object.defineProperty(globalThis, 'confirm', { value: () => true, writable: true });

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
    return this.requests.find(r => r.method === method && r.url === url);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

describe('ShippingZoneListComponent', () => {
  let component: ShippingZoneListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new ShippingZoneListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load shipping zones successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/shipping/zones`, {
      items: [
        { id: 'zone-1', code: 'DHAKA', name: 'Dhaka Zone', fee: 10000, active: true, districts: ['Dhaka'] },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.zones.length).toBe(1);
    expect(component.zones[0].code).toBe('DHAKA');
  });

  it('should create a shipping zone successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/shipping/zones`, { id: 'zone-new', code: 'CTG', name: 'Chittagong', fee: 15000, active: true, districts: ['Ctg'] });

    component.createForm.setValue({ code: 'CTG', name: 'Chittagong', fee: 150, active: true });
    await component.createZone();

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/shipping/zones`);
    expect(req).toBeDefined();
    expect(req!.body.fee).toBe(15000);
    expect(component.error).toBeNull();
  });

  it('should reject duplicate shipping zone code', async () => {
    http.setError(`${baseUrl}/v1/admin/shipping/zones`, new Error('Zone code already exists'));

    component.createForm.setValue({ code: 'DHAKA', name: 'Dhaka Zone', fee: 100, active: true });
    await component.createZone();

    expect(component.error).toContain('already exists');
  });

  it('should delete a shipping zone successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/shipping/zones`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/v1/admin/shipping/zones/zone-1`, null);
    await component.deleteZone('zone-1');

    const req = http.getLastRequest('DELETE', `${baseUrl}/v1/admin/shipping/zones/zone-1`);
    expect(req).toBeDefined();
  });
});

describe('CouponListComponent', () => {
  let component: CouponListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new CouponListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load coupons successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/coupons`, {
      items: [
        {
          id: 'coupon-1',
          code: 'SAVE10',
          discountType: 'percentage',
          discountValue: 10,
          minimumOrder: 50000,
          startsAt: '2026-01-01T00:00:00Z',
          expiresAt: '2026-12-31T23:59:59Z',
          active: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.coupons.length).toBe(1);
    expect(component.coupons[0].code).toBe('SAVE10');
  });

  it('should create a coupon successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/coupons`, { id: 'coupon-new', code: 'WELCOME', discountType: 'fixed', discountValue: 50, minimumOrder: 50000, startsAt: '2026-01-01T00:00:00Z', expiresAt: '2026-12-31T23:59:59Z', active: true });

    component.createForm.setValue({
      code: 'WELCOME',
      discountType: 'fixed',
      discountValue: 50,
      minimumOrder: 500,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
      active: true,
    });
    await component.createCoupon();

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/coupons`);
    expect(req).toBeDefined();
    expect(req!.body.minimumOrder).toBe(50000);
    expect(component.error).toBeNull();
  });

  it('should reject invalid coupon date range', async () => {
    http.setError(`${baseUrl}/v1/admin/coupons`, new Error('Expiry date must be later than start date'));

    component.createForm.setValue({
      code: 'BAD',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrder: 100,
      startsAt: '2026-12-31T23:59:59.000Z',
      expiresAt: '2026-01-01T00:00:00.000Z',
      active: true,
    });
    await component.createCoupon();

    expect(component.error).toContain('later than start date');
  });

  it('should handle permission-denied coupon creation', async () => {
    http.setError(`${baseUrl}/v1/admin/coupons`, new Error('Forbidden: insufficient permissions'));

    component.createForm.setValue({
      code: 'NOPE',
      discountType: 'percentage',
      discountValue: 10,
      minimumOrder: 100,
      startsAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T23:59:59.000Z',
      active: true,
    });
    await component.createCoupon();

    expect(component.error).toContain('insufficient permissions');
  });

  it('should delete a coupon successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/coupons`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/v1/admin/coupons/coupon-1`, null);
    await component.deleteCoupon('coupon-1');

    const req = http.getLastRequest('DELETE', `${baseUrl}/v1/admin/coupons/coupon-1`);
    expect(req).toBeDefined();
  });
});
