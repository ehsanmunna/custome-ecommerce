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
import { AuthService } from '../../auth/auth.service';
import { permissionGuard } from './permission.guard';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

interface AuthMock {
  isAuthenticated: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: readonly string[]) => boolean;
}

describe('permissionGuard', () => {
  let granted: Set<string>;
  let auth: AuthMock;
  let createUrlTree: ReturnType<typeof vi.fn>;

  const route = (data: Record<string, unknown> = {}): ActivatedRouteSnapshot =>
    ({ data }) as unknown as ActivatedRouteSnapshot;
  const state = { url: '/orders' } as RouterStateSnapshot;

  beforeEach(() => {
    granted = new Set();
    auth = {
      isAuthenticated: true,
      hasPermission: vi.fn((permission: string) => granted.has(permission)),
      hasAnyPermission: vi.fn((permissions: readonly string[]) =>
        permissions.some((permission) => granted.has(permission)),
      ),
    };
    createUrlTree = vi.fn((commands: readonly unknown[], extras?: unknown) => ({
      commands,
      extras,
    }));

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: AuthService, useValue: auth },
        {
          provide: Router,
          useValue: { url: '/orders', createUrlTree },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('allows a route when the administrator holds every required permission', () => {
    granted.add('orders.read');
    granted.add('orders.status.update');

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({ permissions: ['orders.read', 'orders.status.update'] }), state),
    );

    expect(result).toBe(true);
    expect(auth.hasPermission).toHaveBeenCalledWith('orders.read');
    expect(auth.hasPermission).toHaveBeenCalledWith('orders.status.update');
  });

  it('allows a route that explicitly requires any of its permissions', () => {
    granted.add('orders.read');

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(
        route({
          permissions: ['analytics.read', 'orders.read'],
          permissionMode: 'any',
        }),
        state,
      ),
    );

    expect(result).toBe(true);
    expect(auth.hasAnyPermission).toHaveBeenCalledWith(['analytics.read', 'orders.read']);
  });

  it('defaults to requiring every permission', () => {
    granted.add('orders.read');

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({ permissions: ['orders.read', 'orders.status.update'] }), state),
    );

    expect(result).toEqual({ commands: ['/forbidden'], extras: undefined });
  });

  it('redirects to the forbidden page when a required permission is missing', () => {
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({ permissions: ['orders.read'] }), state),
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/forbidden']);
    expect(result).toEqual({ commands: ['/forbidden'], extras: undefined });
  });

  it('redirects to the forbidden page when none of an any-of requirement is held', () => {
    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(
        route({
          permissions: ['analytics.read', 'orders.read'],
          permissionMode: 'any',
        }),
        state,
      ),
    );

    expect(result).toEqual({ commands: ['/forbidden'], extras: undefined });
  });

  it('redirects unauthenticated visitors to sign in with a return URL', () => {
    auth.isAuthenticated = false;

    const result = TestBed.runInInjectionContext(() =>
      permissionGuard(route({ permissions: ['orders.read'] }), state),
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/orders' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      extras: { queryParams: { returnUrl: '/orders' } },
    });
    expect(auth.hasPermission).not.toHaveBeenCalled();
    expect(auth.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('allows routes without a permission requirement', () => {
    const result = TestBed.runInInjectionContext(() => permissionGuard(route(), state));

    expect(result).toBe(true);
  });
});
