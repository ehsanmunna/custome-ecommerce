// @vitest-environment jsdom
import '@angular/compiler';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { AuthService } from '../../auth/auth.service';
import { ADMIN_MENU, type AdminMenuItem } from './admin-menu.config';
import { MenuService } from './menu.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

function menuFor(permissions: readonly string[]): MenuService {
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { permissionSet: signal(new Set(permissions)) } },
    ],
  });
  return TestBed.inject(MenuService);
}

function flattenMenu(entries: readonly AdminMenuItem[]): AdminMenuItem[] {
  return entries.flatMap((entry) => [
    entry,
    ...(entry.children ? flattenMenu(entry.children) : []),
  ]);
}

interface Requirement {
  permissions: readonly string[];
  permissionMode: 'all' | 'any';
}

function routeRequirements(): Map<string, Requirement> {
  const shellRoute = routes.find((route) => route.path === '' && route.children);
  const result = new Map<string, Requirement>();

  for (const child of shellRoute?.children ?? []) {
    const permissions = child.data?.['permissions'];
    const permissionMode = child.data?.['permissionMode'] ?? 'all';
    if (
      typeof child.path === 'string' &&
      child.path.length > 0 &&
      Array.isArray(permissions)
    ) {
      result.set(`/${child.path}`, { permissions, permissionMode });
    }
  }

  return result;
}

function permissionMismatches(
  entries: readonly AdminMenuItem[] = ADMIN_MENU,
  index: ReadonlyMap<string, Requirement> = routeRequirements(),
): string[] {
  return flattenMenu(entries)
    .filter((entry) => {
      const requirement = index.get(entry.routerLink);
      return (
        !requirement ||
        requirement.permissionMode !== entry.permissionMode ||
        requirement.permissions.length !== entry.permissions.length ||
        requirement.permissions.some(
          (permission, position) => permission !== entry.permissions[position],
        )
      );
    })
    .map((entry) => entry.routerLink);
}

const OWNER_PERMISSIONS = [
  'analytics.read',
  'orders.read',
  'orders.returns.read',
  'inventory.read',
  'inventory.adjust',
  'customers.read',
  'catalog.products.read',
  'catalog.categories.read',
  'catalog.brands.read',
  'image-storage.read',
  'settings.read',
  'shipping.zones.read',
  'promotions.coupons.read',
  'admin.users.read',
  'admin.roles.read',
  'cms.pages.read',
  'cms.banners.read',
];

describe('MenuService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the six top-level entries when every entry is permitted', () => {
    const service = menuFor(OWNER_PERMISSIONS);

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'products',
      'orders',
      'customers',
      'inventory',
      'settings',
    ]);
    expect(flattenMenu(service.menu())).toHaveLength(flattenMenu(ADMIN_MENU).length);
  });

  it('hides entries whose permission requirement is not met', () => {
    const service = menuFor(['orders.read', 'customers.read']);

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'orders',
      'customers',
    ]);
    expect(service.menu().find((entry) => entry.id === 'orders')?.children).toBeUndefined();
  });

  it('filters child entries independently from their parent', () => {
    const service = menuFor([
      'orders.read',
      'inventory.read',
      'catalog.products.read',
      'catalog.categories.read',
      'catalog.brands.read',
      'image-storage.read',
    ]);

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'products',
      'orders',
      'inventory',
      'settings',
    ]);
    expect(
      service.menu().find((entry) => entry.id === 'inventory')?.children?.map((entry) => entry.id),
    ).toEqual(['reservations', 'stock-movements']);
    expect(
      service.menu().find((entry) => entry.id === 'settings')?.children?.map((entry) => entry.id),
    ).toEqual(['low-stock-report']);
    expect(service.menu().find((entry) => entry.id === 'products')?.children).toHaveLength(4);
  });

  it('omits a group when no child and no group permission is held', () => {
    const service = menuFor(['customers.read']);

    expect(service.menu().map((entry) => entry.id)).toEqual(['dashboard', 'customers']);
  });

  it('keeps a linked parent visible when its own route is permitted but children are hidden', () => {
    const service = menuFor(['settings.read']);

    expect(service.menu().map((entry) => entry.id)).toEqual(['settings']);
    expect(service.menu()[0]?.children).toBeUndefined();
  });

  it('returns no entries when the permission snapshot is empty', () => {
    const service = menuFor([]);

    expect(service.menu()).toEqual([]);
  });

  it('keeps every menu router link aligned with its route permission requirement', () => {
    expect(permissionMismatches()).toEqual([]);
  });

  it('reports a mismatch when a menu entry and its route disagree', () => {
    const mismatchedMenu = ADMIN_MENU.map((entry) =>
      entry.id === 'dashboard'
        ? { ...entry, permissions: ['catalog.products.read'], permissionMode: 'all' as const }
        : entry,
    );

    expect(permissionMismatches(mismatchedMenu)).toContain('/dashboard');
  });
});
