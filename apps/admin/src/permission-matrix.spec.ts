// @vitest-environment jsdom
import '@angular/compiler';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from './app.routes';
import { AuthService } from './auth/auth.service';
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_KEYS,
} from './core/auth/admin-permissions';
import { permissionGuard } from './core/auth/permission.guard';
import {
  DASHBOARD_WIDGETS,
  dashboardWidgetPermission,
  type DashboardWidget,
} from './features/dashboard/dashboard.models';
import { ADMIN_MENU, type AdminMenuItem } from './layout/menu/admin-menu.config';
import { filterMenuByPermission } from './layout/menu/menu.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

const P = ADMIN_PERMISSIONS;

const authKeys = [P.auth.read, P.auth.logout];

const ownerPermissions = new Set<string>(ADMIN_PERMISSION_KEYS);

const managerPermissions = new Set<string>([
  ...authKeys,
  ...ADMIN_PERMISSION_KEYS.filter((key) =>
    /^(catalog|media|inventory|orders|customers|settings|shipping|promotions|cms|notifications|analytics)\./.test(
      key,
    ),
  ),
  'orders_manage',
  P.roles.read,
  P.imageStorage.read,
]);

const staffPermissions = new Set<string>([
  ...authKeys,
  P.catalog.brands.read,
  P.catalog.categories.read,
  P.catalog.products.read,
  P.imageStorage.read,
  P.inventory.read,
  P.orders.read,
]);

const supportPermissions = new Set<string>([...authKeys, P.orders.read, P.customers.read]);

const customRolePermissions = new Set<string>([
  ...authKeys,
  P.orders.read,
  P.orders.statusUpdate,
  P.customers.read,
  P.imageStorage.read,
]);

interface RoleCase {
  name: string;
  granted: Set<string>;
  allowedRoutes: string[];
  menuIds: string[];
  widgets: DashboardWidget[];
  media: boolean;
}

const roleCases: RoleCase[] = [
  {
    name: 'owner',
    granted: ownerPermissions,
    allowedRoutes: [
      'dashboard',
      'customers',
      'products',
      'categories',
      'brands',
      'attributes',
      'products/:productId/variants',
      'media',
      'inventory',
      'inventory/adjust',
      'inventory/reservations',
      'inventory/movements',
      'orders',
      'orders/:orderId',
      'orders/:orderId/status',
      'returns',
      'returns/:returnId/status',
      'settings',
      'settings/shipping-zones',
      'settings/coupons',
      'settings/users',
      'settings/roles',
      'cms/pages',
      'cms/banners',
      'reports/sales',
      'reports/low-stock',
      'profile',
    ],
    menuIds: [
      'dashboard',
      'products',
      'categories',
      'brands',
      'attributes',
      'media',
      'orders',
      'returns',
      'customers',
      'inventory',
      'adjust-stock',
      'reservations',
      'stock-movements',
      'settings',
      'shipping-zones',
      'coupons',
      'users',
      'roles',
      'cms-pages',
      'cms-banners',
      'sales-report',
      'low-stock-report',
    ],
    widgets: [
      'orders',
      'revenue',
      'revenueChart',
      'topProducts',
      'newCustomers',
      'recentOrders',
      'orderStatus',
      'lowStockCount',
      'lowStockAlerts',
    ],
    media: true,
  },
  {
    name: 'manager',
    granted: managerPermissions,
    allowedRoutes: [
      'dashboard',
      'customers',
      'products',
      'categories',
      'brands',
      'attributes',
      'products/:productId/variants',
      'media',
      'inventory',
      'inventory/adjust',
      'inventory/reservations',
      'inventory/movements',
      'orders',
      'orders/:orderId',
      'orders/:orderId/status',
      'returns',
      'returns/:returnId/status',
      'settings',
      'settings/shipping-zones',
      'settings/coupons',
      'settings/roles',
      'cms/pages',
      'cms/banners',
      'reports/sales',
      'reports/low-stock',
      'profile',
    ],
    menuIds: [
      'dashboard',
      'products',
      'categories',
      'brands',
      'attributes',
      'media',
      'orders',
      'returns',
      'customers',
      'inventory',
      'adjust-stock',
      'reservations',
      'stock-movements',
      'settings',
      'shipping-zones',
      'coupons',
      'roles',
      'cms-pages',
      'cms-banners',
      'sales-report',
      'low-stock-report',
    ],
    widgets: [
      'orders',
      'revenue',
      'revenueChart',
      'topProducts',
      'newCustomers',
      'recentOrders',
      'orderStatus',
      'lowStockCount',
      'lowStockAlerts',
    ],
    media: true,
  },
  {
    name: 'staff',
    granted: staffPermissions,
    allowedRoutes: [
      'dashboard',
      'products',
      'categories',
      'brands',
      'attributes',
      'products/:productId/variants',
      'media',
      'inventory',
      'inventory/reservations',
      'inventory/movements',
      'orders',
      'orders/:orderId',
      'settings',
      'reports/low-stock',
      'profile',
    ],
    menuIds: [
      'dashboard',
      'products',
      'categories',
      'brands',
      'attributes',
      'media',
      'orders',
      'inventory',
      'reservations',
      'stock-movements',
      'settings',
      'low-stock-report',
    ],
    widgets: ['recentOrders', 'orderStatus', 'lowStockCount', 'lowStockAlerts'],
    media: true,
  },
  {
    name: 'support',
    granted: supportPermissions,
    allowedRoutes: ['dashboard', 'customers', 'orders', 'orders/:orderId', 'profile'],
    menuIds: ['dashboard', 'orders', 'customers'],
    widgets: ['newCustomers', 'recentOrders', 'orderStatus'],
    media: false,
  },
  {
    name: 'custom role with orders, customers, and media read',
    granted: customRolePermissions,
    allowedRoutes: [
      'dashboard',
      'customers',
      'media',
      'orders',
      'orders/:orderId',
      'orders/:orderId/status',
      'profile',
    ],
    // The media entry is nested under Products, which this custom role cannot
    // open, so it is reachable by direct navigation only.
    menuIds: ['dashboard', 'orders', 'customers'],
    widgets: ['newCustomers', 'recentOrders', 'orderStatus'],
    media: true,
  },
];

const shellRoute = routes.find((route) => route.path === '' && route.children);
const protectedRoutes = (shellRoute?.children ?? []).filter(
  (route) => typeof route.path === 'string' && route.path.length > 0 && route.data,
);

const flattenMenuIds = (entries: readonly AdminMenuItem[]): string[] =>
  entries.flatMap((entry) => [entry.id, ...flattenMenuIds(entry.children ?? [])]);

const widgetVisibility = (granted: ReadonlySet<string>): DashboardWidget[] =>
  DASHBOARD_WIDGETS.filter((widget) => granted.has(dashboardWidgetPermission(widget)));

const routeSnapshot = (data: Record<string, unknown>): ActivatedRouteSnapshot =>
  ({ data }) as unknown as ActivatedRouteSnapshot;

describe('permission matrix per role', () => {
  let granted: Set<string>;
  let createUrlTree: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    granted = new Set();
    createUrlTree = vi.fn((commands: readonly unknown[]) => ({ commands }));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: true,
            hasPermission: (permission: string) => granted.has(permission),
            hasAnyPermission: (permissions: readonly string[]) =>
              permissions.some((permission) => granted.has(permission)),
          },
        },
        { provide: Router, useValue: { url: '/', createUrlTree } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  for (const role of roleCases) {
    describe(role.name, () => {
      beforeEach(() => {
        for (const permission of role.granted) granted.add(permission);
      });

      it('permits exactly the expected routes and denies direct navigation to the rest', () => {
        const allowed: string[] = [];
        const denied: string[] = [];

        for (const route of protectedRoutes) {
          const result = TestBed.runInInjectionContext(() =>
            permissionGuard(
              routeSnapshot(route.data ?? {}),
              { url: `/${route.path}` } as RouterStateSnapshot,
            ),
          );

          if (result === true) allowed.push(route.path as string);
          else denied.push(route.path as string);
        }

        expect(allowed).toEqual(role.allowedRoutes);
        for (const path of denied) {
          expect(role.allowedRoutes, `denied route ${path}`).not.toContain(path);
        }

        const expectedDenied = protectedRoutes
          .map((route) => route.path as string)
          .filter((path) => !role.allowedRoutes.includes(path));
        expect(denied).toEqual(expectedDenied);
        expect(createUrlTree).toHaveBeenCalledTimes(denied.length);
        for (const _ of denied) {
          expect(createUrlTree).toHaveBeenCalledWith(['/forbidden']);
        }
      });

      it('shows exactly the expected menu entries', () => {
        const menu = filterMenuByPermission(ADMIN_MENU, role.granted);

        expect(flattenMenuIds(menu)).toEqual(role.menuIds);
      });

      it('shows exactly the expected dashboard widgets', () => {
        expect(widgetVisibility(role.granted)).toEqual(role.widgets);
      });

      it(`resolves media access to ${role.media}`, () => {
        expect(role.granted.has(P.imageStorage.read)).toBe(role.media);
        expect(role.allowedRoutes.includes('media')).toBe(role.media);
      });
    });
  }
});

interface ActionCase {
  permission: string;
  owner: boolean;
  manager: boolean;
  staff: boolean;
  support: boolean;
  custom: boolean;
}

const actionCases: ActionCase[] = [
  { permission: P.users.read, owner: true, manager: false, staff: false, support: false, custom: false },
  { permission: P.users.create, owner: true, manager: false, staff: false, support: false, custom: false },
  { permission: P.users.disable, owner: true, manager: false, staff: false, support: false, custom: false },
  { permission: P.roles.read, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.roles.update, owner: true, manager: false, staff: false, support: false, custom: false },
  { permission: P.catalog.products.update, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.catalog.categories.update, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.imageStorage.read, owner: true, manager: true, staff: true, support: false, custom: true },
  { permission: P.media.create, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.media.delete, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.inventory.adjust, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.orders.statusUpdate, owner: true, manager: true, staff: false, support: false, custom: true },
  { permission: P.orders.returnsUpdate, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.settings.update, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.shipping.zones.delete, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.promotions.coupons.create, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.cms.pages.delete, owner: true, manager: true, staff: false, support: false, custom: false },
  { permission: P.analytics.read, owner: true, manager: true, staff: false, support: false, custom: false },
];

describe('action visibility matrix', () => {
  it('hides every writable action that the role cannot perform', () => {
    for (const action of actionCases) {
      expect(ownerPermissions.has(action.permission), `owner ${action.permission}`).toBe(
        action.owner,
      );
      expect(managerPermissions.has(action.permission), `manager ${action.permission}`).toBe(
        action.manager,
      );
      expect(staffPermissions.has(action.permission), `staff ${action.permission}`).toBe(
        action.staff,
      );
      expect(supportPermissions.has(action.permission), `support ${action.permission}`).toBe(
        action.support,
      );
      expect(
        customRolePermissions.has(action.permission),
        `custom ${action.permission}`,
      ).toBe(action.custom);
    }
  });

  it('grants the owner every canonical permission', () => {
    expect([...ownerPermissions].sort()).toEqual([...ADMIN_PERMISSION_KEYS].sort());
  });

  it('does not depend on a baseline role key for the custom role', () => {
    expect(customRolePermissions.has(P.orders.statusUpdate)).toBe(true);
    expect(customRolePermissions.has(P.roles.read)).toBe(false);
    expect(widgetVisibility(customRolePermissions)).toEqual([
      'newCustomers',
      'recentOrders',
      'orderStatus',
    ]);
  });
});
