// @vitest-environment jsdom
import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { ADMIN_PERMISSIONS } from './core/auth/admin-permissions';
import { permissionGuard } from './core/auth/permission.guard';

const P = ADMIN_PERMISSIONS;

const expectedRequirements: Record<string, { permissions: string[]; permissionMode: 'all' | 'any' }> = {
  dashboard: {
    permissions: [P.analytics.read, P.orders.read, P.inventory.read, P.customers.read],
    permissionMode: 'any',
  },
  customers: { permissions: [P.customers.read], permissionMode: 'all' },
  products: { permissions: [P.catalog.products.read], permissionMode: 'all' },
  categories: { permissions: [P.catalog.categories.read], permissionMode: 'all' },
  brands: { permissions: [P.catalog.brands.read], permissionMode: 'all' },
  attributes: { permissions: [P.catalog.categories.read], permissionMode: 'all' },
  'products/:productId/variants': {
    permissions: [P.catalog.products.read],
    permissionMode: 'all',
  },
  media: { permissions: [P.imageStorage.read], permissionMode: 'all' },
  inventory: { permissions: [P.inventory.read], permissionMode: 'all' },
  'inventory/adjust': { permissions: [P.inventory.adjust], permissionMode: 'all' },
  'inventory/reservations': { permissions: [P.inventory.read], permissionMode: 'all' },
  'inventory/movements': { permissions: [P.inventory.read], permissionMode: 'all' },
  orders: { permissions: [P.orders.read], permissionMode: 'all' },
  'orders/:orderId': { permissions: [P.orders.read], permissionMode: 'all' },
  'orders/:orderId/status': { permissions: [P.orders.statusUpdate], permissionMode: 'all' },
  returns: { permissions: [P.orders.returnsRead], permissionMode: 'all' },
  'returns/:returnId/status': { permissions: [P.orders.returnsUpdate], permissionMode: 'all' },
  settings: {
    permissions: [
      P.settings.read,
      P.shipping.zones.read,
      P.promotions.coupons.read,
      P.users.read,
      P.roles.read,
      P.cms.pages.read,
      P.cms.banners.read,
      P.analytics.read,
      P.inventory.read,
    ],
    permissionMode: 'any',
  },
  'settings/shipping-zones': { permissions: [P.shipping.zones.read], permissionMode: 'all' },
  'settings/coupons': { permissions: [P.promotions.coupons.read], permissionMode: 'all' },
  'settings/users': { permissions: [P.users.read], permissionMode: 'all' },
  'settings/roles': { permissions: [P.roles.read], permissionMode: 'all' },
  'cms/pages': { permissions: [P.cms.pages.read], permissionMode: 'all' },
  'cms/banners': { permissions: [P.cms.banners.read], permissionMode: 'all' },
  'reports/sales': { permissions: [P.analytics.read], permissionMode: 'all' },
  'reports/low-stock': { permissions: [P.inventory.read], permissionMode: 'all' },
  profile: { permissions: [P.auth.read], permissionMode: 'all' },
};

const shellRoute = routes.find((route) => route.path === '' && route.children);
const protectedRoutes = (shellRoute?.children ?? []).filter(
  (route) => typeof route.path === 'string' && route.path.length > 0 && route.data,
);

describe('admin route permission requirements', () => {
  it('declares a permission requirement for every protected route', () => {
    expect(protectedRoutes.map((route) => route.path)).toEqual(Object.keys(expectedRequirements));
  });

  it('maps every route to the permissions from the design', () => {
    for (const route of protectedRoutes) {
      const requirement = route.data?.['permissions'];
      const mode = route.data?.['permissionMode'] ?? 'all';
      expect(requirement, `route ${route.path}`).toEqual(
        expectedRequirements[route.path as string]?.permissions,
      );
      expect(mode, `route ${route.path}`).toBe(
        expectedRequirements[route.path as string]?.permissionMode,
      );
    }
  });

  it('no longer declares role-key metadata', () => {
    for (const route of protectedRoutes) {
      expect(route.data?.['roles'], `route ${route.path}`).toBeUndefined();
    }
  });

  it('guards every protected route with the permission guard', () => {
    for (const route of protectedRoutes) {
      expect(route.canActivate, `route ${route.path}`).toEqual([permissionGuard]);
    }
  });

  it('lazy-loads the permission-gated dashboard page', async () => {
    const dashboard = protectedRoutes.find((route) => route.path === 'dashboard');

    expect(dashboard?.loadComponent).toBeTypeOf('function');
    const { DashboardComponent } = await import('./features/dashboard/dashboard.component');
    await expect(dashboard?.loadComponent?.()).resolves.toBe(DashboardComponent);
  });
});
