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
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { OrderStatusComponent } from './order-status.component';
import { ReturnStatusComponent } from '../returns/return-status.component';
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
  const resources: Record<string, string> = {
    './order-status.component.html': resolve(specDir, 'order-status.component.html'),
    './return-status.component.html': resolve(specDir, '..', 'returns', 'return-status.component.html'),
  };

  await resolveComponentResources(async (url) => ({
    text: () => readFile(resources[url] ?? resolve(specDir, url), 'utf8'),
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
    return of(this.responses[key]);
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

const buttonLabels = (element: HTMLElement): string[] =>
  Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

const orderStatusUrl = `${baseUrl}/v1/admin/orders/order-1/status`;
const returnStatusUrl = `${baseUrl}/v1/admin/returns/ret-1/status`;

describe('OrderStatusComponent action gating', () => {
  let permissions: Set<string>;
  let http: MockHttpClient;

  const createFixture = () => {
    TestBed.configureTestingModule({
      imports: [OrderStatusComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'order-1' } } },
        },
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

    const fixture = TestBed.createComponent(OrderStatusComponent);
    fixture.componentInstance.orderId = 'order-1';
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
    http = new MockHttpClient();
    http.setResponse('GET', `${baseUrl}/v1/admin/orders/order-1`, {
      id: 'order-1',
      number: 'ORD-1',
      status: 'pending',
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the read-only state without the status permission', () => {
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).not.toContain('Update Status');
    expect(element.textContent).toContain('You do not have permission to change order status.');
  });

  it('shows the status action with orders.status.update', () => {
    permissions.add('orders.status.update');
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).toContain('Update Status');
  });

  it('reports a denied status change as a failure without success', () => {
    permissions.add('orders.status.update');
    const fixture = createFixture();
    const component = fixture.componentInstance;
    http.setError(
      'PATCH',
      orderStatusUrl,
      new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } }),
    );

    component.changeStatus();

    expect(component.error).toBe('Forbidden');
    expect(component.success).toBeNull();
  });
});

describe('ReturnStatusComponent action gating', () => {
  let permissions: Set<string>;
  let http: MockHttpClient;

  const createFixture = () => {
    TestBed.configureTestingModule({
      imports: [ReturnStatusComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'ret-1' } } },
        },
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

    const fixture = TestBed.createComponent(ReturnStatusComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
    http = new MockHttpClient();
    http.setResponse('GET', `${baseUrl}/v1/admin/returns/ret-1`, {
      id: 'ret-1',
      orderId: 'order-1',
      status: 'requested',
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the read-only state without the return update permission', () => {
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).not.toContain('Update Status');
    expect(element.textContent).toContain('You do not have permission to change return status.');
  });

  it('shows the status action with orders.returns.update', () => {
    permissions.add('orders.returns.update');
    const element: HTMLElement = createFixture().nativeElement;

    expect(buttonLabels(element)).toContain('Update Status');
  });

  it('reports a denied return status change as a failure without success', () => {
    permissions.add('orders.returns.update');
    const fixture = createFixture();
    const component = fixture.componentInstance;
    http.setError(
      'PATCH',
      returnStatusUrl,
      new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } }),
    );

    component.changeStatus();

    expect(component.error).toBe('Forbidden');
    expect(component.success).toBeNull();
  });
});
