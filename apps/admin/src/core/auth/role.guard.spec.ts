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
import { roleGuard } from './role.guard';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

interface AuthMock {
  isAuthenticated: boolean;
  hasAnyRole: (roles: readonly string[]) => boolean;
}

describe('roleGuard', () => {
  let auth: AuthMock;
  let createUrlTree: ReturnType<typeof vi.fn>;

  const route = (roles?: string[]): ActivatedRouteSnapshot =>
    ({ data: roles ? { roles } : {} }) as unknown as ActivatedRouteSnapshot;
  const state = { url: '/orders' } as RouterStateSnapshot;

  beforeEach(() => {
    auth = {
      isAuthenticated: true,
      hasAnyRole: vi.fn(() => true),
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

  it('allows a route when the administrator has one of its roles', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(route(['owner']), state));

    expect(result).toBe(true);
    expect(auth.hasAnyRole).toHaveBeenCalledWith(['owner']);
  });

  it('redirects to the forbidden page when the role is not allowed', () => {
    auth.hasAnyRole = vi.fn(() => false);

    const result = TestBed.runInInjectionContext(() => roleGuard(route(['owner']), state));

    expect(createUrlTree).toHaveBeenCalledWith(['/forbidden']);
    expect(result).toEqual({ commands: ['/forbidden'], extras: undefined });
  });

  it('redirects unauthenticated visitors to sign in with a return URL', () => {
    auth.isAuthenticated = false;

    const result = TestBed.runInInjectionContext(() => roleGuard(route(['owner']), state));

    expect(createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/orders' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      extras: { queryParams: { returnUrl: '/orders' } },
    });
    expect(auth.hasAnyRole).not.toHaveBeenCalled();
  });

  it('allows routes without a role list', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(route(), state));

    expect(result).toBe(true);
  });
});
