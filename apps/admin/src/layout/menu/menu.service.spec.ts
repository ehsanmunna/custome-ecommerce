// @vitest-environment jsdom
import '@angular/compiler';
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

function menuFor(roleKey: string | null): MenuService {
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: { roleKey } }],
  });
  return TestBed.inject(MenuService);
}

function flattenMenu(entries: readonly AdminMenuItem[]): AdminMenuItem[] {
  return entries.flatMap((entry) => [
    entry,
    ...(entry.children ? flattenMenu(entry.children) : []),
  ]);
}

function isRoleList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((role) => typeof role === 'string');
}

function routeRoles(): Map<string, readonly string[]> {
  const shellRoute = routes.find((route) => route.path === '' && route.children);
  const result = new Map<string, readonly string[]>();

  for (const child of shellRoute?.children ?? []) {
    const roles = child.data?.['roles'];
    if (typeof child.path === 'string' && isRoleList(roles)) {
      result.set(`/${child.path}`, roles);
    }
  }

  return result;
}

function roleMismatches(
  entries: readonly AdminMenuItem[] = ADMIN_MENU,
  index: ReadonlyMap<string, readonly string[]> = routeRoles(),
): string[] {
  return flattenMenu(entries)
    .filter((entry) => {
      const roles = index.get(entry.routerLink);
      return (
        !roles ||
        roles.length !== entry.roles.length ||
        roles.some((role, position) => role !== entry.roles[position])
      );
    })
    .map((entry) => entry.routerLink);
}

describe('MenuService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows the six top-level entries for an owner', () => {
    const service = menuFor('owner');

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'products',
      'orders',
      'customers',
      'inventory',
      'settings',
    ]);
  });

  it('hides entries whose role list excludes the current role', () => {
    const service = menuFor('support');

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'orders',
      'customers',
    ]);
    expect(service.menu().find((entry) => entry.id === 'orders')?.children).toBeUndefined();
  });

  it('filters child entries independently from their parent', () => {
    const service = menuFor('staff');
    const inventory = service.menu().find((entry) => entry.id === 'inventory');

    expect(service.menu().map((entry) => entry.id)).toEqual([
      'dashboard',
      'products',
      'orders',
      'inventory',
    ]);
    expect(inventory?.children?.map((entry) => entry.id)).toEqual([
      'reservations',
      'stock-movements',
    ]);
  });

  it('shows every configured entry for a manager', () => {
    const service = menuFor('manager');
    const flattened = flattenMenu(service.menu());

    expect(service.menu()).toHaveLength(6);
    expect(flattened).toHaveLength(flattenMenu(ADMIN_MENU).length);
  });

  it('returns no entries when no administrator role is available', () => {
    const service = menuFor(null);

    expect(service.menu()).toEqual([]);
  });

  it('keeps every menu router link aligned with its route data roles', () => {
    expect(roleMismatches()).toEqual([]);
  });

  it('reports a mismatch when a menu entry and its route disagree', () => {
    const mismatchedMenu = ADMIN_MENU.map((entry) =>
      entry.id === 'dashboard' ? { ...entry, roles: ['manager'] } : entry,
    );

    expect(roleMismatches(mismatchedMenu)).toContain('/dashboard');
  });
});
