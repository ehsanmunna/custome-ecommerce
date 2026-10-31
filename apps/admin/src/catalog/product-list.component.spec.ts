import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductListComponent } from './product-list.component';
import { AuthService } from '../auth/auth.service';
import { defaultAdminAuthConfig, AdminAuthConfig } from '../auth/auth.config';
import { FormBuilder } from '@angular/forms';
import { MediaListComponent } from './media-list.component';

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

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new ProductListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load products successfully', async () => {
    http.setResponse(`${baseUrl}/admin/products`, {
      items: [
        {
          id: 'prod-1',
          categoryId: 'cat-1',
          brandId: 'brand-1',
          status: 'active',
          content: { en: { name: 'Test Product', slug: 'test-product' } },
          variants: [{ id: 'var-1', sku: 'SKU-001', price: { amount: 1000, currency: 'BDT' }, status: 'active', attributes: {} }],
          media: [],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    http.setResponse(`${baseUrl}/admin/categories`, { items: [], total: 0, page: 1, pageSize: 20 });
    http.setResponse(`${baseUrl}/admin/brands`, { items: [], total: 0, page: 1, pageSize: 20 });

    await component.ngOnInit();

    expect(component.products.length).toBe(1);
    expect(component.products[0].id).toBe('prod-1');
  });

  it('should create a product successfully', async () => {
    http.setResponse(`${baseUrl}/admin/categories`, { items: [], total: 0, page: 1, pageSize: 20 });
    http.setResponse(`${baseUrl}/admin/brands`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/admin/products`, { id: 'prod-new', categoryId: 'cat-1', status: 'draft', content: {}, variants: [], media: [] });

    component.createForm.setValue({
      categoryId: 'cat-1',
      brandId: '',
      status: 'draft',
      nameEn: 'New Product',
      slugEn: 'new-product',
      variantSku: 'SKU-002',
      variantPrice: 1500,
    });
    await component.createProduct();

    const req = http.getLastRequest('POST', `${baseUrl}/admin/products`);
    expect(req).toBeDefined();
    expect(component.error).toBeNull();
  });

  it('should handle product creation failure', async () => {
    http.setResponse(`${baseUrl}/admin/categories`, { items: [], total: 0, page: 1, pageSize: 20 });
    http.setResponse(`${baseUrl}/admin/brands`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setError(`${baseUrl}/admin/products`, new Error('Validation failed'));

    component.createForm.setValue({
      categoryId: 'cat-1',
      brandId: '',
      status: 'draft',
      nameEn: 'New Product',
      slugEn: 'new-product',
      variantSku: 'SKU-002',
      variantPrice: 1500,
    });
    await component.createProduct();

    expect(component.error).toContain('Validation failed');
  });

  it('should delete a product successfully', async () => {
    http.setResponse(`${baseUrl}/admin/categories`, { items: [], total: 0, page: 1, pageSize: 20 });
    http.setResponse(`${baseUrl}/admin/brands`, { items: [], total: 0, page: 1, pageSize: 20 });
    http.setResponse(`${baseUrl}/admin/products`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/admin/products/prod-1`, null);

    await component.deleteProduct('prod-1');

    const req = http.getLastRequest('DELETE', `${baseUrl}/admin/products/prod-1`);
    expect(req).toBeDefined();
  });
});

describe('MediaListComponent', () => {
  let component: MediaListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new MediaListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load media assets successfully', async () => {
    http.setResponse(`${baseUrl}/admin/media`, {
      items: [
        {
          id: 'media-1',
          provider: 'r2',
          key: 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          url: 'https://example.com/image.jpg',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.media.length).toBe(1);
    expect(component.media[0].key).toBe('image.jpg');
  });

  it('should handle media upload creation failure', async () => {
    http.setError(`${baseUrl}/admin/media`, new Error('Upload failed'));

    component.createForm.setValue({
      fileName: 'image.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      altEn: 'test image',
    });
    await component.createMediaUpload();

    expect(component.error).toBe('Upload failed');
  });

  it('should handle media completion failure', async () => {
    http.setResponse(`${baseUrl}/admin/media`, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    await component.loadMedia();

    http.setResponse(`${baseUrl}/admin/media`, {
      items: [
        {
          id: 'media-1',
          provider: 'r2',
          key: 'image.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          upload: {
            url: 'https://upload.example.com/image.jpg',
            method: 'PUT',
            headers: {},
            expiresAt: '2026-01-02T00:00:00Z',
          },
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    await component.loadMedia();

    component.pendingMedia = component.media[0];
    http.setError(`${baseUrl}/admin/media/media-1/complete`, new Error('Completion failed'));

    await component.completeMediaUpload();

    expect(component.error).toBe('Completion failed');
  });
});

import { InventoryAdjustmentComponent } from '../inventory/inventory-adjustment.component';
import { InventoryListComponent } from '../inventory/inventory-list.component';
import { InventoryReservationComponent } from '../inventory/inventory-reservation.component';
import { StockMovementsComponent } from '../inventory/stock-movements.component';

describe('InventoryListComponent', () => {
  let component: InventoryListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new InventoryListComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load inventory items successfully', async () => {
    http.setResponse(`${baseUrl}/admin/inventory`, {
      items: [
        {
          variantId: 'var-1',
          onHand: 100,
          reserved: 10,
          available: 90,
          lowStockThreshold: 5,
          lowStock: false,
        },
        {
          variantId: 'var-2',
          onHand: 3,
          reserved: 0,
          available: 3,
          lowStockThreshold: 5,
          lowStock: true,
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.inventory.length).toBe(2);
    expect(component.inventory[0].lowStock).toBe(false);
    expect(component.inventory[1].lowStock).toBe(true);
  });

  it('should filter to low stock items only', async () => {
    http.setResponse(`${baseUrl}/admin/inventory`, {
      items: [
        {
          variantId: 'var-1',
          onHand: 100,
          reserved: 10,
          available: 90,
          lowStockThreshold: 5,
          lowStock: false,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    component.lowStockFilter = true;
    await component.loadInventory();

    const req = http.getLastRequest('GET', `${baseUrl}/admin/inventory?lowStock=true`);
    expect(req).toBeDefined();
    expect(req!.url).toContain('lowStock=true');
  });
});

describe('InventoryAdjustmentComponent', () => {
  let component: InventoryAdjustmentComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new InventoryAdjustmentComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should reject adjustment that would drop stock below zero', async () => {
    component.inventory = [
      {
        variantId: 'var-1',
        sku: 'SKU-001',
        onHand: 5,
        reserved: 0,
        available: 5,
        lowStockThreshold: 3,
        lowStock: false,
      },
    ];

    // Initialize form controls like loadInventory() does
    const fb = new FormBuilder();
    component.adjustmentForm.addControl('delta_var-1', fb.control('-10'));
    component.adjustmentForm.addControl('reason_var-1', fb.control('Test removal'));

    await component.adjustStock('var-1');

    expect(component.error).toContain('below zero');
    expect(component.inventory[0].available).toBe(5);
  });

  it('should apply successful adjustment and update available stock', async () => {
    component.inventory = [
      {
        variantId: 'var-1',
        sku: 'SKU-001',
        onHand: 5,
        reserved: 0,
        available: 5,
        lowStockThreshold: 3,
        lowStock: false,
      },
    ];

    http.setResponse(`${baseUrl}/admin/inventory/var-1/adjustments`, {
      variantId: 'var-1',
      onHand: 15,
      reserved: 0,
      available: 15,
      lowStockThreshold: 3,
      lowStock: false,
    });

    // Initialize form controls like loadInventory() does
    const fb = new FormBuilder();
    component.adjustmentForm.addControl('delta_var-1', fb.control('10'));
    component.adjustmentForm.addControl('reason_var-1', fb.control('Restock'));

    await component.adjustStock('var-1');

    expect(component.error).toBeNull();
    expect(component.success).toContain('Stock adjusted');
  });

  it('should not call API when delta or reason is missing', async () => {
    component.inventory = [
      {
        variantId: 'var-1',
        sku: 'SKU-001',
        onHand: 5,
        reserved: 0,
        available: 5,
        lowStockThreshold: 3,
        lowStock: false,
      },
    ];

    await component.adjustStock('var-1');

    const req = http.getLastRequest('POST', `${baseUrl}/admin/inventory/var-1/adjustments`);
    expect(req).toBeUndefined();
  });
});

describe('InventoryReservationComponent', () => {
  let component: InventoryReservationComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new InventoryReservationComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load reservations successfully', async () => {
    http.setResponse(`${baseUrl}/admin/inventory/reservations`, {
      items: [
        {
          id: 'res-1',
          variantId: 'var-1',
          quantity: 5,
          status: 'active',
          source: 'manual',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.reservations.length).toBe(1);
    expect(component.reservations[0].status).toBe('active');
  });

  it('should create a reservation successfully', async () => {
    http.setResponse(`${baseUrl}/admin/inventory/reservations`, {
      id: 'res-new',
      variantId: 'var-1',
      quantity: 3,
      status: 'active',
      source: 'manual',
    });

    component.createForm.setValue({
      variantId: 'var-1',
      quantity: 3,
      expiresAt: '',
    });

    await component.createReservation();

    expect(component.success).toContain('Reservation created');
  });
});

describe('StockMovementsComponent', () => {
  let component: StockMovementsComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new StockMovementsComponent(http as any, auth, config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load movements from reservations successfully', async () => {
    http.setResponse(`${baseUrl}/admin/inventory/reservations`, {
      items: [
        {
          id: 'res-1',
          variantId: 'var-1',
          quantity: 5,
          status: 'active',
          source: 'manual',
        },
        {
          id: 'res-2',
          variantId: 'var-2',
          quantity: 3,
          status: 'released',
          source: 'cart',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.movements.length).toBe(2);
    expect(component.movements[0].type).toBe('reservation');
    expect(component.movements[1].type).toBe('release');
  });
});
