import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { Routes } from '@angular/router';
import { buildAdminMenu } from './admin-menu';
import { routes as appRoutes } from '../app.routes';

const sampleRoutes: Routes = [
  { path: 'login', component: class {} },
  {
    path: '',
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: class {}, data: { menu: { label: 'Dashboard' } } },
      { path: 'products', component: class {}, data: { menu: { label: 'Products', group: 'Catalog' } } },
      { path: 'products/:productId/variants', component: class {} },
      { path: 'orders', component: class {}, data: { menu: { label: 'Orders', group: 'Orders' } } },
      { path: 'orders/:orderId', component: class {} },
      { path: 'inventory', component: class {}, data: { menu: { label: 'Inventory', group: 'Inventory' } } },
      { path: 'profile', component: class {}, data: { menu: { label: 'Profile' } } },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

describe('buildAdminMenu', () => {
  it('includes only routes marked menu-visible once', () => {
    const paths = buildAdminMenu(sampleRoutes).flatMap((section) => section.entries.map((entry) => entry.path));

    expect(paths).toEqual(['/dashboard', '/profile', '/products', '/orders', '/inventory']);
    expect(paths).not.toContain('/login');
    expect(paths).not.toContain('/products/:productId/variants');
    expect(paths).not.toContain('/orders/:orderId');
  });

  it('composes full paths from nested route definitions', () => {
    const nested: Routes = [
      {
        path: 'settings',
        children: [
          { path: 'shipping-zones', component: class {}, data: { menu: { label: 'Shipping zones', group: 'Settings' } } },
        ],
      },
    ];

    expect(buildAdminMenu(nested)[0]?.entries[0]?.path).toBe('/settings/shipping-zones');
  });

  it('puts ungrouped entries first and keeps declared group and entry order', () => {
    const sections = buildAdminMenu(sampleRoutes);

    expect(sections.map((section) => section.group)).toEqual([null, 'Catalog', 'Orders', 'Inventory']);
    expect(sections[0]?.entries.map((entry) => entry.label)).toEqual(['Dashboard', 'Profile']);
    expect(sections[1]?.entries.map((entry) => entry.label)).toEqual(['Products']);
    expect(sections[2]?.entries.map((entry) => entry.label)).toEqual(['Orders']);
    expect(sections[3]?.entries.map((entry) => entry.label)).toEqual(['Inventory']);
  });

  it('generates unique paths for the application routes', () => {
    const paths = buildAdminMenu(appRoutes).flatMap((section) => section.entries.map((entry) => entry.path));

    expect(paths.length).toBeGreaterThan(0);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('derives the expected admin areas from the application routes', () => {
    const sections = buildAdminMenu(appRoutes);
    const labelsByGroup = new Map(sections.map((section) => [section.group, section.entries.map((entry) => entry.label)]));

    expect(labelsByGroup.get(null)).toEqual(['Dashboard', 'Profile']);
    expect(labelsByGroup.get('Catalog')).toEqual(['Products', 'Categories', 'Brands', 'Attributes', 'Media']);
    expect(labelsByGroup.get('Inventory')).toEqual(['Inventory', 'Adjust stock', 'Reservations', 'Stock movements']);
    expect(labelsByGroup.get('Orders')).toEqual(['Orders']);
    expect(labelsByGroup.get('Returns')).toEqual(['Returns']);
    expect(labelsByGroup.get('Settings')).toEqual(['Shipping zones', 'Coupons']);
    expect(labelsByGroup.get('CMS')).toEqual(['Pages', 'Banners']);
    expect(labelsByGroup.get('Reports')).toEqual(['Sales', 'Low stock']);
  });
});
