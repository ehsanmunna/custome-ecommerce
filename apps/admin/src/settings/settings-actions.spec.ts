// @vitest-environment jsdom
import '@angular/compiler';
import {
  provideZonelessChangeDetection,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { ShippingZoneListComponent } from './shipping-zone-list.component';
import { CouponListComponent } from './coupon-list.component';
import { PageListComponent } from '../cms/page-list.component';
import { BannerListComponent } from '../cms/banner-list.component';
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
    './shipping-zone-list.component.html': resolve(specDir, 'shipping-zone-list.component.html'),
    './coupon-list.component.html': resolve(specDir, 'coupon-list.component.html'),
    './page-list.component.html': resolve(specDir, '..', 'cms', 'page-list.component.html'),
    './banner-list.component.html': resolve(specDir, '..', 'cms', 'banner-list.component.html'),
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

class MockHttpClient {
  constructor(private readonly responses: Record<string, any> = {}) {}

  get(url: string): any {
    return of(this.responses[url] ?? { items: [], total: 0, page: 1, pageSize: 20 });
  }

  post(): any {
    return of({});
  }

  patch(): any {
    return of({});
  }

  delete(): any {
    return of(null);
  }
}

const zone = {
  id: 'zone-1',
  code: 'DHK',
  name: 'Dhaka',
  fee: 6000,
  active: true,
  districts: ['Dhaka'],
};

const coupon = {
  id: 'coupon-1',
  code: 'SAVE10',
  discountType: 'percentage',
  discountValue: 10,
  minimumOrder: 0,
  startsAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-12-31T00:00:00Z',
  active: true,
};

const page = {
  id: 'page-1',
  content: { en: { slug: 'about', title: 'About', status: 'published' } },
};

const banner = {
  id: 'banner-1',
  placement: 'home',
  sortOrder: 0,
  active: true,
  content: { en: { title: 'Summer Sale' } },
};

const buttonLabels = (element: HTMLElement): string[] =>
  Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

describe('ShippingZoneListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/shipping/zones`]: { items: [zone], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [ShippingZoneListComponent],
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

    const fixture = TestBed.createComponent(ShippingZoneListComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without shipping zone write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Zone');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with shipping zone permissions', () => {
    permissions.add('shipping.zones.create');
    permissions.add('shipping.zones.update');
    permissions.add('shipping.zones.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Zone');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

describe('CouponListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/coupons`]: { items: [coupon], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [CouponListComponent],
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

    const fixture = TestBed.createComponent(CouponListComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without coupon write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Coupon');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with coupon permissions', () => {
    permissions.add('promotions.coupons.create');
    permissions.add('promotions.coupons.update');
    permissions.add('promotions.coupons.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Coupon');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

describe('PageListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/pages`]: { items: [page], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [PageListComponent],
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

    const fixture = TestBed.createComponent(PageListComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without CMS page write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Page');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with CMS page permissions', () => {
    permissions.add('cms.pages.create');
    permissions.add('cms.pages.update');
    permissions.add('cms.pages.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Page');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

describe('BannerListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/banners`]: { items: [banner], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [BannerListComponent],
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

    const fixture = TestBed.createComponent(BannerListComponent);
    (fixture.componentInstance as any).notification = notification;
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without CMS banner write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Banner');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with CMS banner permissions', () => {
    permissions.add('cms.banners.create');
    permissions.add('cms.banners.update');
    permissions.add('cms.banners.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Banner');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});
