// @vitest-environment jsdom
import '@angular/compiler';
import { provideZonelessChangeDetection, ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { InventoryAdjustmentComponent } from './inventory-adjustment.component';
import { InventoryReservationComponent } from './inventory-reservation.component';
import { AuthService } from '../auth/auth.service';
import {
  ADMIN_AUTH_CONFIG,
  defaultAdminAuthConfig,
  type AdminAuthConfig,
} from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

Object.defineProperty(globalThis, 'confirm', { value: () => true, writable: true });

const specDir = dirname(fileURLToPath(import.meta.url));

beforeAll(async () => {
  await resolveComponentResources(async (url) => ({
    text: () => readFile(resolve(specDir, url), 'utf8'),
  }));
});

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

const notification = {
  success: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

class MockHttpClient {
  private responses: Record<string, any> = {};
  private errors: Record<string, Error> = {};

  setResponse(method: Method, url: string, response: any) {
    this.responses[`${method} ${url}`] = response;
  }

  setError(method: Method, url: string, error: Error) {
    this.errors[`${method} ${url}`] = error;
  }

  private request(method: Method, url: string): any {
    const key = `${method} ${url}`;
    const error = this.errors[key];
    if (error) {
      return throwError(() => error);
    }
    return of(this.responses[key] ?? { items: [], total: 0, page: 1, pageSize: 20 });
  }

  get(url: string): any {
    return this.request('GET', url);
  }

  post(url: string): any {
    return this.request('POST', url);
  }

  patch(url: string): any {
    return this.request('PATCH', url);
  }

  delete(): any {
    return of(null);
  }
}

const inventoryItem = {
  variantId: 'var-1',
  sku: 'SKU-001',
  onHand: 10,
  reserved: 0,
  available: 10,
  lowStockThreshold: 3,
  lowStock: false,
};

const reservation = {
  id: 'res-1',
  variantId: 'var-1',
  quantity: 2,
  status: 'active',
  source: 'manual',
};

const buttonLabels = (element: HTMLElement): string[] =>
  Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

describe('InventoryAdjustmentComponent action gating', () => {
  let permissions: Set<string>;
  let http: MockHttpClient;

  const createFixture = () => {
    TestBed.configureTestingModule({
      imports: [InventoryAdjustmentComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HttpClient, useValue: http },
        {
          provide: AuthService,
          useValue: {
            token: 'test-token',
            hasPermission: (permission: string) => permissions.has(permission),
          },
        },
        { provide: ADMIN_AUTH_CONFIG, useValue: config },
        { provide: NotificationService, useValue: notification },
      ],
    });

    const fixture = TestBed.createComponent(InventoryAdjustmentComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
    http = new MockHttpClient();
    http.setResponse('GET', `${baseUrl}/v1/admin/inventory`, {
      items: [inventoryItem],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without the adjust permission', () => {
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).not.toContain('Adjust');
    expect(element.querySelectorAll('tbody input')).toHaveLength(0);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows the adjustment inputs and action with inventory.adjust', () => {
    permissions.add('inventory.adjust');
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).toContain('Adjust');
    expect(element.querySelectorAll('tbody input')).toHaveLength(2);
  });

  it('reports a denied adjustment as a failure without success', async () => {
    permissions.add('inventory.adjust');
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.adjustmentForm.patchValue({ 'delta_var-1': '5', 'reason_var-1': 'Restock' });
    http.setError(
      'POST',
      `${baseUrl}/v1/admin/inventory/var-1/adjustments`,
      new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } }),
    );

    component.adjustStock('var-1');
    await fixture.whenStable();

    expect(component.error()).toBe('Forbidden');
    expect(component.success()).toBeNull();
  });
});

describe('InventoryReservationComponent action gating', () => {
  let permissions: Set<string>;
  let http: MockHttpClient;

  const createFixture = () => {
    TestBed.configureTestingModule({
      imports: [InventoryReservationComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: HttpClient, useValue: http },
        {
          provide: AuthService,
          useValue: {
            token: 'test-token',
            hasPermission: (permission: string) => permissions.has(permission),
          },
        },
        { provide: ADMIN_AUTH_CONFIG, useValue: config },
        { provide: NotificationService, useValue: notification },
      ],
    });

    const fixture = TestBed.createComponent(InventoryReservationComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
    http = new MockHttpClient();
    http.setResponse('GET', `${baseUrl}/v1/admin/inventory/reservations`, {
      items: [reservation],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without the adjust permission', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(element.textContent).not.toContain('Create Reservation');
    expect(labels).not.toContain('Release');
    expect(labels).not.toContain('Commit');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows reservation actions with inventory.adjust', () => {
    permissions.add('inventory.adjust');
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(element.textContent).toContain('Create Reservation');
    expect(labels).toContain('Release');
    expect(labels).toContain('Commit');
  });

  it('reports a denied reservation update as a failure without success', async () => {
    permissions.add('inventory.adjust');
    const fixture = createFixture();
    const component = fixture.componentInstance;
    http.setError(
      'PATCH',
      `${baseUrl}/v1/admin/inventory/reservations/res-1/status`,
      new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } }),
    );

    component.releaseReservation('res-1');
    await fixture.whenStable();

    expect(component.error()).toBe('Forbidden');
    expect(component.success()).toBeNull();
  });
});
