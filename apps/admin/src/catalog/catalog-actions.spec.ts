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
import { HttpClient } from '@angular/common/http';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { ProductListComponent } from './product-list.component';
import { VariantListComponent } from './variant-list.component';
import { CategoryListComponent } from './category-list.component';
import { BrandListComponent } from './brand-list.component';
import { AttributeListComponent } from './attribute-list.component';
import { MediaListComponent } from './media-list.component';
import { AuthService } from '../auth/auth.service';
import {
  ADMIN_AUTH_CONFIG,
  defaultAdminAuthConfig,
  type AdminAuthConfig,
} from '../auth/auth.config';
import { NotificationService } from '../core/notifications/notification.service';
import { ImageService } from '../core/image-storage/image-storage.service';

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

const imageService = {
  fetch: () => Promise.resolve(new Blob([])),
  createObjectUrl: () => 'mock-url',
  revokeObjectUrl: () => {},
  deleteMedia: () => Promise.resolve(),
};

class MockHttpClient {
  constructor(private readonly responses: Record<string, any> = {}) {}

  private respond(url: string): any {
    return of(this.responses[url] ?? { items: [], total: 0, page: 1, pageSize: 20 });
  }

  get(url: string): any {
    return this.respond(url);
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

const product = {
  id: 'prod-1',
  categoryId: 'cat-1',
  status: 'active',
  content: { en: { name: 'Test Product', slug: 'test-product' } },
  variants: [{ id: 'var-1', sku: 'SKU-001', price: 1000, status: 'active', attributes: {} }],
  media: [],
};

const variant = {
  id: 'var-1',
  sku: 'SKU-001',
  price: { amount: 100000, currency: 'BDT' },
  status: 'active',
  sortOrder: 0,
  attributes: {},
};

const buttonLabels = (element: HTMLElement): string[] =>
  Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim() ?? '');

describe('ProductListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = (
    setup?: (component: ProductListComponent) => void,
  ): ReturnType<typeof TestBed.createComponent<ProductListComponent>> => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/categories`]: { items: [], total: 0, page: 1, pageSize: 20 },
      [`${baseUrl}/v1/admin/brands`]: { items: [], total: 0, page: 1, pageSize: 20 },
      [`${baseUrl}/v1/admin/products`]: { items: [product], total: 1, page: 1, pageSize: 20 },
      [`${baseUrl}/v1/image-storage/list`]: { items: [] },
    });

    TestBed.configureTestingModule({
      imports: [ProductListComponent],
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
        { provide: ImageService, useValue: imageService },
      ],
    });

    const fixture = TestBed.createComponent(ProductListComponent);
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without product write permissions', () => {
    const fixture = createFixture();
    const element: HTMLElement = fixture.nativeElement;

    expect(buttonLabels(element)).not.toContain('+ New Product');
    expect(buttonLabels(element)).not.toContain('Edit');
    expect(buttonLabels(element)).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with product permissions', () => {
    permissions.add('catalog.products.create');
    permissions.add('catalog.products.update');
    permissions.add('catalog.products.delete');

    const fixture = createFixture();
    const element: HTMLElement = fixture.nativeElement;
    const labels = buttonLabels(element);

    expect(labels).toContain('+ New Product');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });

  it('hides media upload and image delete without media permissions', () => {
    const fixture = createFixture((component) => {
      component.createModal = true;
      component.media.set([
        { id: 'media-1', url: 'https://example.com/one.jpg', mimeType: 'image/jpeg', alt: {} },
      ]);
      component.createForm.patchValue({ mediaIds: ['media-1'] });
    });

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('input[type="file"]')).toBeNull();
    expect(buttonLabels(element)).not.toContain('×');
  });

  it('shows media upload and image delete with media permissions', () => {
    permissions.add('media.create');
    permissions.add('media.delete');

    const fixture = createFixture((component) => {
      component.createModal = true;
      component.media.set([
        { id: 'media-1', url: 'https://example.com/one.jpg', mimeType: 'image/jpeg', alt: {} },
      ]);
      component.createForm.patchValue({ mediaIds: ['media-1'] });
    });

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('input[type="file"]')).not.toBeNull();
    expect(buttonLabels(element)).toContain('×');
  });
});

describe('VariantListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = (): ReturnType<typeof TestBed.createComponent<VariantListComponent>> => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/products/prod-1/variants`]: {
        items: [variant],
        total: 1,
        page: 1,
        pageSize: 20,
      },
      [`${baseUrl}/v1/admin/categories`]: { items: [], total: 0, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [VariantListComponent],
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

    const fixture = TestBed.createComponent(VariantListComponent);
    fixture.componentInstance.productId = 'prod-1';
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without product update permission', () => {
    const fixture = createFixture();
    const element: HTMLElement = fixture.nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Variant');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with product update permission', () => {
    permissions.add('catalog.products.update');

    const fixture = createFixture();
    const labels = buttonLabels(fixture.nativeElement);

    expect(labels).toContain('+ New Variant');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

const category = {
  id: 'cat-1',
  status: 'active',
  sortOrder: 0,
  content: { en: { name: 'Category', slug: 'category' } },
};

const brand = {
  id: 'brand-1',
  status: 'active',
  content: { en: { name: 'Brand', slug: 'brand' } },
};

const mediaAsset = {
  id: 'media-1',
  provider: 'local',
  key: 'image.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  url: '',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('CategoryListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/categories`]: { items: [category], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [CategoryListComponent],
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

    const fixture = TestBed.createComponent(CategoryListComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without category write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Category');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('li')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with category permissions', () => {
    permissions.add('catalog.categories.create');
    permissions.add('catalog.categories.update');
    permissions.add('catalog.categories.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Category');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

describe('BrandListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/brands`]: { items: [brand], total: 1, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [BrandListComponent],
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

    const fixture = TestBed.createComponent(BrandListComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without brand write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ New Brand');
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows create, edit, and delete actions with brand permissions', () => {
    permissions.add('catalog.brands.create');
    permissions.add('catalog.brands.update');
    permissions.add('catalog.brands.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ New Brand');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Delete');
  });
});

describe('AttributeListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/admin/categories`]: { items: [], total: 0, page: 1, pageSize: 20 },
    });

    TestBed.configureTestingModule({
      imports: [AttributeListComponent],
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

    const fixture = TestBed.createComponent(AttributeListComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hides attribute creation without category update permission', () => {
    expect(buttonLabels(createFixture().nativeElement)).not.toContain('+ New Attribute');
  });

  it('does not show attribute creation for category create permission alone', () => {
    permissions.add('catalog.categories.create');

    expect(buttonLabels(createFixture().nativeElement)).not.toContain('+ New Attribute');
  });

  it('shows attribute creation with the API permission', () => {
    permissions.add('catalog.categories.update');

    expect(buttonLabels(createFixture().nativeElement)).toContain('+ New Attribute');
  });
});

describe('MediaListComponent action gating', () => {
  let permissions: Set<string>;

  const createFixture = () => {
    const http = new MockHttpClient({
      [`${baseUrl}/v1/image-storage/list`]: {
        items: [mediaAsset],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });

    TestBed.configureTestingModule({
      imports: [MediaListComponent],
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
        { provide: ImageService, useValue: imageService },
      ],
    });

    const fixture = TestBed.createComponent(MediaListComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders read-only without media write permissions', () => {
    const element: HTMLElement = createFixture().nativeElement;
    const labels = buttonLabels(element);

    expect(labels).not.toContain('+ Upload Media');
    expect(labels).not.toContain('Delete');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('shows upload and delete actions with media permissions', () => {
    permissions.add('media.create');
    permissions.add('media.delete');

    const labels = buttonLabels(createFixture().nativeElement);

    expect(labels).toContain('+ Upload Media');
    expect(labels).toContain('Delete');
  });
});
