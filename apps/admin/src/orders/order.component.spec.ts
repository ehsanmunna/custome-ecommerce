import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrderListComponent } from './order-list.component';
import { OrderDetailComponent } from './order-detail.component';
import { OrderStatusComponent } from './order-status.component';
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

  private request(method: string, url: string, body?: any, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method, url, body, headers: options?.headers });
    const response = this.responses[url];
    if (response instanceof Error) {
      return { toPromise: () => Promise.reject(response), pipe: (_fn: any) => response as any };
    }
    return {
      toPromise: () => Promise.resolve(response),
      pipe: <R>(fn: (obs: any) => R) => fn(response),
    };
  }

  get(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request('GET', url, undefined, options);
  }

  patch(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    return this.request('PATCH', url, body, options);
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

describe('OrderListComponent', () => {
  let component: OrderListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new OrderListComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load orders successfully', async () => {
    http.setResponse(`${baseUrl}/admin/orders`, {
      items: [
        {
          id: 'order-1',
          number: 'ORD-001',
          status: 'pending',
          contactName: 'John Doe',
          contactPhone: '+8801712345678',
          total: { amount: 150000, currency: 'BDT' },
          createdAt: '2026-10-01T10:00:00Z',
          items: [],
          history: [],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.orders.length).toBe(1);
    expect(component.orders[0].number).toBe('ORD-001');
    expect(component.orders[0].status).toBe('pending');
  });

  it('should filter orders by status', async () => {
    http.setResponse(`${baseUrl}/admin/orders`, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    component.statusFilter = 'confirmed';
    await component.loadOrders();

    const req = http.getLastRequest('GET', `${baseUrl}/admin/orders?status=confirmed`);
    expect(req).toBeDefined();
  });

  it('should handle load failure', async () => {
    http.setError(`${baseUrl}/admin/orders`, new Error('Server error'));

    await component.loadOrders();

    expect(component.error).toBe('Server error');
  });
});

describe('OrderDetailComponent', () => {
  let component: OrderDetailComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new OrderDetailComponent(http as any, auth, config, { snapshot: { paramMap: { get: () => 'order-1' } } } as any);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load order details successfully', async () => {
    http.setResponse(`${baseUrl}/admin/orders/order-1`, {
      id: 'order-1',
      number: 'ORD-001',
      status: 'confirmed',
      contactName: 'John Doe',
      contactPhone: '+8801712345678',
      contactEmail: 'john@example.com',
      delivery: {
        name: 'John Doe',
        addressLine1: 'House 12, Road 3',
        addressLine2: '',
        area: 'Gulshan',
        district: 'Dhaka',
        division: 'Dhaka',
        postalCode: '1212',
        countryCode: 'BD',
      },
      subtotal: { amount: 150000, currency: 'BDT' },
      discount: { amount: 0, currency: 'BDT' },
      deliveryFee: { amount: 5000, currency: 'BDT' },
      tax: { amount: 0, currency: 'BDT' },
      total: { amount: 155000, currency: 'BDT' },
      items: [
        {
          variantId: 'var-1',
          productName: 'T-Shirt',
          sku: 'TSHIRT-001',
          attributes: {},
          quantity: 2,
          unitPrice: { amount: 75000, currency: 'BDT' },
          lineTotal: { amount: 150000, currency: 'BDT' },
        },
      ],
      history: [
        { previousStatus: 'pending', status: 'confirmed', createdAt: '2026-10-01T10:30:00Z' },
      ],
      createdAt: '2026-10-01T10:00:00Z',
    });

    await component.loadOrder();

    expect(component.order).not.toBeNull();
    expect(component.order?.number).toBe('ORD-001');
    expect(component.order?.status).toBe('confirmed');
    expect(component.order?.items.length).toBe(1);
    expect(component.order?.history.length).toBe(1);
  });

  it('should handle order detail load failure', async () => {
    http.setError(`${baseUrl}/admin/orders/order-1`, new Error('Not found'));

    await component.loadOrder();

    expect(component.error).toBe('Not found');
  });
});

describe('OrderStatusComponent', () => {
  let component: OrderStatusComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new OrderStatusComponent(http as any, auth, new FormBuilder(), config, { snapshot: { paramMap: { get: () => 'order-1' } } } as any, {} as any);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load order and compute allowed transitions', async () => {
    http.setResponse(`${baseUrl}/admin/orders/order-1`, {
      id: 'order-1',
      number: 'ORD-001',
      status: 'pending',
    });

    await component.loadOrder();

    expect(component.order?.status).toBe('pending');
    expect(component.allowedNextStatuses).toContain('confirmed');
    expect(component.allowedNextStatuses).toContain('cancelled');
  });

  it('should change order status successfully', async () => {
    http.setResponse(`${baseUrl}/admin/orders/order-1`, {
      id: 'order-1',
      number: 'ORD-001',
      status: 'pending',
    });
    await component.loadOrder();

    http.setResponse(`${baseUrl}/admin/orders/order-1/status`, {
      id: 'order-1',
      number: 'ORD-001',
      status: 'confirmed',
    });

    component.statusForm.setValue({ status: 'confirmed', note: 'Payment confirmed' });
    await component.changeStatus();

    const req = http.getLastRequest('PATCH', `${baseUrl}/admin/orders/order-1/status`);
    expect(req).toBeDefined();
    expect(req!.body).toEqual({ status: 'confirmed', note: 'Payment confirmed' });
    expect(component.error).toBeNull();
    expect(component.success).toContain('confirmed');
  });

  it('should handle status change failure', async () => {
    http.setResponse(`${baseUrl}/admin/orders/order-1`, {
      id: 'order-1',
      number: 'ORD-001',
      status: 'shipped',
    });
    await component.loadOrder();

    http.setError(`${baseUrl}/admin/orders/order-1/status`, new Error('Invalid transition'));

    component.statusForm.setValue({ status: 'returned', note: '' });
    await component.changeStatus();

    expect(component.error).toBe('Invalid transition');
  });

  it('should not call API when form is invalid', async () => {
    await component.changeStatus();

    const req = http.getLastRequest('PATCH', `${baseUrl}/admin/orders/order-1/status`);
    expect(req).toBeUndefined();
  });
});

import { ReturnListComponent } from '../returns/return-list.component';
import { ReturnStatusComponent } from '../returns/return-status.component';

describe('ReturnListComponent', () => {
  let component: ReturnListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new ReturnListComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load returns successfully', async () => {
    http.setResponse(`${baseUrl}/admin/returns`, {
      items: [
        {
          id: 'ret-1',
          orderId: 'order-1',
          status: 'requested',
          reason: 'Defective item',
          refundTotal: { amount: 5000, currency: 'BDT' },
          items: [],
          history: [],
          createdAt: '2026-10-01T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.returns.length).toBe(1);
    expect(component.returns[0].id).toBe('ret-1');
    expect(component.returns[0].status).toBe('requested');
  });

  it('should filter returns by status', async () => {
    http.setResponse(`${baseUrl}/admin/returns`, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    component.statusFilter = 'approved';
    await component.loadReturns();

    const req = http.getLastRequest('GET', `${baseUrl}/admin/returns?status=approved`);
    expect(req).toBeDefined();
  });

  it('should handle load failure', async () => {
    http.setError(`${baseUrl}/admin/returns`, new Error('Server error'));

    await component.loadReturns();

    expect(component.error).toBe('Server error');
  });
});

describe('ReturnStatusComponent', () => {
  let component: ReturnStatusComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new ReturnStatusComponent(http as any, auth, new FormBuilder(), config, { snapshot: { paramMap: { get: () => 'ret-1' } } } as any, {} as any);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load return and compute allowed transitions', async () => {
    http.setResponse(`${baseUrl}/admin/returns/ret-1`, {
      id: 'ret-1',
      orderId: 'order-1',
      status: 'requested',
    });

    await component.loadReturn();

    expect(component.ret?.status).toBe('requested');
    expect(component.allowedNextStatuses).toContain('approved');
    expect(component.allowedNextStatuses).toContain('rejected');
    expect(component.allowedNextStatuses).toContain('cancelled');
  });

  it('should change return status successfully', async () => {
    http.setResponse(`${baseUrl}/admin/returns/ret-1`, {
      id: 'ret-1',
      orderId: 'order-1',
      status: 'requested',
    });
    await component.loadReturn();

    http.setResponse(`${baseUrl}/admin/returns/ret-1/status`, {
      id: 'ret-1',
      orderId: 'order-1',
      status: 'approved',
    });

    component.statusForm.setValue({ status: 'approved', note: 'Verified defect' });
    await component.changeStatus();

    const req = http.getLastRequest('PATCH', `${baseUrl}/admin/returns/ret-1/status`);
    expect(req).toBeDefined();
    expect(req!.body).toEqual({ status: 'approved', note: 'Verified defect' });
    expect(component.error).toBeNull();
    expect(component.success).toContain('approved');
  });

  it('should handle return status change failure', async () => {
    http.setResponse(`${baseUrl}/admin/returns/ret-1`, {
      id: 'ret-1',
      orderId: 'order-1',
      status: 'rejected',
    });
    await component.loadReturn();

    http.setError(`${baseUrl}/admin/returns/ret-1/status`, new Error('Invalid transition'));

    component.statusForm.setValue({ status: 'refunded', note: '' });
    await component.changeStatus();

    expect(component.error).toBe('Invalid transition');
  });

  it('should not call API when form is invalid', async () => {
    await component.changeStatus();

    const req = http.getLastRequest('PATCH', `${baseUrl}/admin/returns/ret-1/status`);
    expect(req).toBeUndefined();
  });
});
