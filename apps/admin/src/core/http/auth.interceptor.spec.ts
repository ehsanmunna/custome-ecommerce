// @vitest-environment jsdom
import '@angular/compiler';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, Subject, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_AUTH_CONFIG, defaultAdminAuthConfig } from '../../auth/auth.config';
import type { AuthSession } from '../../auth/auth.service';
import { AuthService } from '../../auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { MessageService } from 'primeng/api';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

interface AuthMock {
  token: string | null;
  refreshTokenValue: string | null;
  refresh: () => Observable<AuthSession>;
  clear: () => void;
}

interface RouterMock {
  url: string;
  navigate: (commands: readonly unknown[], extras?: unknown) => Promise<boolean>;
}

const baseUrl = 'http://localhost:4000';
const ordersUrl = `${baseUrl}/v1/admin/orders`;
const refreshedSession: AuthSession = {
  accessToken: 'token-2',
  expiresIn: 3600,
};

describe('authInterceptor', () => {
  let auth: AuthMock;
  let router: RouterMock;
  let http: HttpClient;
  let httpController: HttpTestingController;

  beforeEach(() => {
    auth = {
      token: 'token-1',
      refreshTokenValue: 'refresh-token-1',
      refresh: vi.fn(() => of(refreshedSession)),
      clear: vi.fn(),
    };
    router = {
      url: '/orders',
      navigate: vi.fn(async () => true),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        MessageService,
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        {
          provide: ADMIN_AUTH_CONFIG,
          useValue: { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
    TestBed.resetTestingModule();
  });

  it('attaches the bearer token to admin API requests', () => {
    http.get(ordersUrl).subscribe();

    const request = httpController.expectOne(ordersUrl);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({});
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const result = firstValueFrom(http.get<{ ok: boolean }>(ordersUrl));

    const firstRequest = httpController.expectOne(ordersUrl);
    expect(firstRequest.request.headers.get('Authorization')).toBe('Bearer token-1');
    firstRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    const retryRequest = httpController.expectOne(ordersUrl);
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer token-2');
    retryRequest.flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });

  it('shares a single refresh across concurrent 401 responses', async () => {
    const refreshSubject = new Subject<AuthSession>();
    auth.refresh = vi.fn(() => refreshSubject.asObservable());

    const firstResult = firstValueFrom(http.get(`${ordersUrl}?page=1`));
    const secondResult = firstValueFrom(http.get(`${ordersUrl}?page=2`));

    const firstRequest = httpController.expectOne(`${ordersUrl}?page=1`);
    const secondRequest = httpController.expectOne(`${ordersUrl}?page=2`);
    firstRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    secondRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).toHaveBeenCalledTimes(1);

    refreshSubject.next(refreshedSession);
    refreshSubject.complete();

    const firstRetry = httpController.expectOne(`${ordersUrl}?page=1`);
    const secondRetry = httpController.expectOne(`${ordersUrl}?page=2`);
    expect(firstRetry.request.headers.get('Authorization')).toBe('Bearer token-2');
    expect(secondRetry.request.headers.get('Authorization')).toBe('Bearer token-2');
    firstRetry.flush({ page: 1 });
    secondRetry.flush({ page: 2 });

    await expect(firstResult).resolves.toEqual({ page: 1 });
    await expect(secondResult).resolves.toEqual({ page: 2 });
  });

  it('clears the session and redirects to sign in when refresh fails', async () => {
    auth.refresh = vi.fn(() => throwError(() => new Error('refresh failed')));
    const result = firstValueFrom(http.get(ordersUrl));

    const request = httpController.expectOne(ordersUrl);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toThrow('refresh failed');
    expect(auth.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/orders' },
    });
    httpController.expectNone(ordersUrl);
  });

  it('clears the session without refreshing when no refresh token exists', async () => {
    auth.refreshTokenValue = null;
    auth.refresh = vi.fn(() => of(refreshedSession));
    const result = firstValueFrom(http.get(ordersUrl));

    const request = httpController.expectOne(ordersUrl);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(auth.refresh).not.toHaveBeenCalled();
    expect(auth.clear).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/orders' },
    });
  });

  it('does not attach the token to the login endpoint', () => {
    const loginUrl = `${baseUrl}${defaultAdminAuthConfig.loginPath}`;
    http.post(loginUrl, {}).subscribe();

    const request = httpController.expectOne(loginUrl);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
