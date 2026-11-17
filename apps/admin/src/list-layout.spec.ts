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
import { ActivatedRoute, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { ProductListComponent } from './catalog/product-list.component';
import { VariantListComponent } from './catalog/variant-list.component';
import { CategoryListComponent } from './catalog/category-list.component';
import { BrandListComponent } from './catalog/brand-list.component';
import { AttributeListComponent } from './catalog/attribute-list.component';
import { MediaListComponent } from './catalog/media-list.component';
import { InventoryAdjustmentComponent } from './inventory/inventory-adjustment.component';
import { InventoryReservationComponent } from './inventory/inventory-reservation.component';
import { ShippingZoneListComponent } from './settings/shipping-zone-list.component';
import { CouponListComponent } from './settings/coupon-list.component';
import { PageListComponent } from './cms/page-list.component';
import { BannerListComponent } from './cms/banner-list.component';
import { AdminUsersListComponent } from './users/admin-users-list.component';
import { AdminRolesListComponent } from './roles/admin-roles-list.component';
import { AuthService } from './auth/auth.service';
import {
  ADMIN_AUTH_CONFIG,
  defaultAdminAuthConfig,
  type AdminAuthConfig,
} from './auth/auth.config';
import { NotificationService } from './core/notifications/notification.service';
import { ImageService } from './core/image-storage/image-storage.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

const specDir = dirname(fileURLToPath(import.meta.url));

const templateDirs: Record<string, string> = {
  'product-list.component.html': 'catalog',
  'variant-list.component.html': 'catalog',
  'category-list.component.html': 'catalog',
  'brand-list.component.html': 'catalog',
  'attribute-list.component.html': 'catalog',
  'media-list.component.html': 'catalog',
  'inventory-adjustment.component.html': 'inventory',
  'inventory-reservation.component.html': 'inventory',
  'shipping-zone-list.component.html': 'settings',
  'coupon-list.component.html': 'settings',
  'page-list.component.html': 'cms',
  'banner-list.component.html': 'cms',
};

beforeAll(async () => {
  await resolveComponentResources(async (url) => {
    const file = url.substring(url.lastIndexOf('/') + 1);
    const dir = templateDirs[file];
    if (!dir) {
      throw new Error(`Unexpected component resource: ${url}`);
    }
    return { text: () => readFile(resolve(specDir, dir, file), 'utf8') };
  });
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

const pageMeta = (count: number) => ({
  page: 1,
  pageSize: 20,
  total: count,
  totalPages: 1,
});

class MockHttpClient {
  constructor(private readonly responses: Record<string, any[]>) {}

  private listFor(url: string): any[] {
    const path = url.split('?')[0];
    const match = Object.entries(this.responses).find(([suffix]) => path.endsWith(suffix));
    return match?.[1] ?? [];
  }

  get(url: string): any {
    const items = this.listFor(url);
    return of({ items, total: items.length, page: 1, pageSize: 20, meta: pageMeta(items.length) });
  }

  post(): any {
    return of(null);
  }

  patch(): any {
    return of(null);
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
  variants: [{ id: 'var-1', sku: 'SKU-001', price: 100 }],
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

const attribute = {
  key: 'color',
  valueType: 'text',
  required: false,
  filterable: true,
  sortOrder: 0,
  options: [],
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

const cmsPage = {
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

const adminUser = {
  id: 'user-2',
  email: 'admin@example.com',
  displayName: 'Admin User',
  status: 'active',
  role: { id: 'role-1', key: 'manager', name: 'Manager', scope: 'store', system: false, permissions: [] },
  permissions: [],
};

const role = {
  id: 'role-1',
  key: 'manager',
  name: 'Manager',
  description: 'Store manager',
  scope: 'store',
  system: false,
  permissions: [],
};

interface LayoutCase {
  name: string;
  component: unknown;
  responses: Record<string, any[]>;
  writeAction: string;
  writePermission: string;
  content: string;
  toolbar?: string;
  breadcrumb?: string;
  title?: string;
  setup?: (component: any) => void;
}

const layoutCases: LayoutCase[] = [
  {
    name: 'products',
    component: ProductListComponent,
    responses: {
      '/v1/admin/products': [product],
      '/v1/admin/categories': [category],
      '/v1/admin/brands': [brand],
    },
    writeAction: '+ New Product',
    writePermission: 'catalog.products.create',
    content: 'table',
  },
  {
    name: 'variants',
    component: VariantListComponent,
    responses: { '/v1/admin/products/prod-1/variants': [variant] },
    writeAction: '+ New Variant',
    writePermission: 'catalog.products.update',
    content: 'table',
    setup: (component) => {
      component.productId = 'prod-1';
    },
  },
  {
    name: 'categories',
    component: CategoryListComponent,
    responses: { '/v1/admin/categories': [category] },
    writeAction: '+ New Category',
    writePermission: 'catalog.categories.create',
    content: 'ul',
  },
  {
    name: 'brands',
    component: BrandListComponent,
    responses: { '/v1/admin/brands': [brand] },
    writeAction: '+ New Brand',
    writePermission: 'catalog.brands.create',
    content: 'table',
  },
  {
    name: 'attributes',
    component: AttributeListComponent,
    responses: {
      '/v1/admin/categories': [category],
      '/v1/admin/categories/cat-1/attributes': [attribute],
    },
    writeAction: '+ New Attribute',
    writePermission: 'catalog.categories.update',
    content: 'table',
    setup: (component) => {
      component.selectedCategoryId = 'cat-1';
      component.loadAttributes();
    },
  },
  {
    name: 'media',
    component: MediaListComponent,
    responses: { '/v1/image-storage/list': [mediaAsset] },
    writeAction: '+ Upload Media',
    writePermission: 'media.create',
    content: 'table',
  },
  {
    name: 'inventory adjustments',
    component: InventoryAdjustmentComponent,
    responses: { '/v1/admin/inventory': [inventoryItem] },
    writeAction: 'Adjust',
    writePermission: 'inventory.adjust',
    content: 'table',
  },
  {
    name: 'inventory reservations',
    component: InventoryReservationComponent,
    responses: { '/v1/admin/inventory/reservations': [reservation] },
    writeAction: 'Release',
    writePermission: 'inventory.adjust',
    content: 'table',
  },
  {
    name: 'shipping zones',
    component: ShippingZoneListComponent,
    responses: { '/v1/admin/shipping/zones': [zone] },
    writeAction: '+ New Zone',
    writePermission: 'shipping.zones.create',
    content: 'table',
  },
  {
    name: 'coupons',
    component: CouponListComponent,
    responses: { '/v1/admin/coupons': [coupon] },
    writeAction: '+ New Coupon',
    writePermission: 'promotions.coupons.create',
    content: 'table',
  },
  {
    name: 'CMS pages',
    component: PageListComponent,
    responses: { '/v1/admin/pages': [cmsPage] },
    writeAction: '+ New Page',
    writePermission: 'cms.pages.create',
    content: 'table',
  },
  {
    name: 'CMS banners',
    component: BannerListComponent,
    responses: { '/v1/admin/banners': [banner] },
    writeAction: '+ New Banner',
    writePermission: 'cms.banners.create',
    content: 'table',
  },
  {
    name: 'administrators',
    component: AdminUsersListComponent,
    responses: { '/v1/admin/users': [adminUser], '/v1/admin/roles': [] },
    writeAction: 'Add administrator',
    writePermission: 'admin.users.create',
    content: 'table',
  },
  {
    name: 'roles',
    component: AdminRolesListComponent,
    responses: { '/v1/admin/roles': [role], '/v1/admin/permissions': [] },
    writeAction: 'New role',
    writePermission: 'admin.roles.create',
    content: 'table',
    breadcrumb: '.page-header-breadcrumb',
    toolbar: 'app-list-toolbar',
  },
];

const precedes = (first: Element, second: Element): boolean =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('admin list page layout order', () => {
  let permissions: Set<string>;

  const createFixture = (layoutCase: LayoutCase) => {
    TestBed.configureTestingModule({
      imports: [
        layoutCase.component as any,
        TranslocoTestingModule.forRoot({
          langs: { en: { menu: { users: 'Users' } } },
          translocoConfig: { defaultLang: 'en', availableLangs: ['en'] },
        }),
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'prod-1' } } },
        },
        { provide: HttpClient, useValue: new MockHttpClient(layoutCase.responses) },
        {
          provide: AuthService,
          useValue: {
            token: 'test-token',
            currentUser: () => null,
            hasPermission: (permission: string) => permissions.has(permission),
          },
        },
        { provide: ADMIN_AUTH_CONFIG, useValue: config },
        { provide: NotificationService, useValue: notification },
        { provide: ImageService, useValue: imageService },
      ],
    });

    const fixture = TestBed.createComponent(layoutCase.component as any);
    layoutCase.setup?.(fixture.componentInstance);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    permissions = new Set<string>();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  for (const layoutCase of layoutCases) {
    for (const writable of [false, true]) {
      const state = writable ? 'writable' : 'read-only';

      it(`keeps the ${layoutCase.name} layout order in the ${state} state`, () => {
        if (writable) {
          permissions.add(layoutCase.writePermission);
        }

        const element: HTMLElement = createFixture(layoutCase).nativeElement;
        const breadcrumb = element.querySelector(layoutCase.breadcrumb ?? 'nav');
        const title = element.querySelector(layoutCase.title ?? 'h1');
        const toolbar = element.querySelector(layoutCase.toolbar ?? 'div.flex');
        const content = element.querySelector(layoutCase.content);

        expect(breadcrumb).not.toBeNull();
        expect(title?.textContent?.trim()).toBeTruthy();
        expect(toolbar).not.toBeNull();
        expect(content).not.toBeNull();

        expect(precedes(breadcrumb!, title!)).toBe(true);
        expect(precedes(title!, toolbar!)).toBe(true);
        expect(precedes(toolbar!, content!)).toBe(true);

        const hasWriteAction = Array.from(element.querySelectorAll('button')).some(
          (button) => button.textContent?.trim() === layoutCase.writeAction,
        );
        expect(hasWriteAction).toBe(writable);
      });
    }
  }
});
