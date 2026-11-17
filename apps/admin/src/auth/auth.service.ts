import { computed, Inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import type { components } from 'api-sdk';
import { ADMIN_AUTH_CONFIG, type AdminAuthConfig } from './auth.config';

export type AdminRole = components['schemas']['Role'];
export type AdminUser = components['schemas']['AdminUser'];

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user?: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storage = typeof window !== 'undefined' ? window.localStorage : null;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;

  private readonly currentUserState = signal<AdminUser | null>(null);
  readonly currentUser = this.currentUserState.asReadonly();
  readonly permissionSet = computed(
    () => new Set<string>(this.currentUserState()?.permissions ?? []),
  );

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
    this.restoreFromStorage();
  }

  private restoreFromStorage(): void {
    if (!this.storage) return;

    this.accessToken = this.storage.getItem(this.config.tokenStorageKey);
    this.refreshToken = this.storage.getItem(this.config.refreshStorageKey);

    const storedExpiry = this.storage.getItem(this.config.expiryStorageKey);
    const parsedExpiry = storedExpiry === null ? Number.NaN : Number(storedExpiry);
    this.expiresAt = isPositiveFiniteNumber(parsedExpiry) ? parsedExpiry : null;

    const storedUser = this.storage.getItem(this.config.userStorageKey);
    if (storedUser === null) {
      this.currentUserState.set(null);
      return;
    }

    try {
      const parsedUser: unknown = JSON.parse(storedUser);
      this.currentUserState.set(isAdminUser(parsedUser) ? parsedUser : null);
    } catch {
      this.currentUserState.set(null);
    }
  }

  private persistToStorage(): void {
    if (!this.storage) return;

    if (this.accessToken) {
      this.storage.setItem(this.config.tokenStorageKey, this.accessToken);
    } else {
      this.storage.removeItem(this.config.tokenStorageKey);
    }

    if (this.refreshToken) {
      this.storage.setItem(this.config.refreshStorageKey, this.refreshToken);
    } else {
      this.storage.removeItem(this.config.refreshStorageKey);
    }

    if (this.expiresAt !== null) {
      this.storage.setItem(this.config.expiryStorageKey, String(this.expiresAt));
    } else {
      this.storage.removeItem(this.config.expiryStorageKey);
    }

    if (this.currentUserState()) {
      this.storage.setItem(this.config.userStorageKey, JSON.stringify(this.currentUserState()));
    } else {
      this.storage.removeItem(this.config.userStorageKey);
    }
  }

  get isAuthenticated(): boolean {
    const expiresAt = this.expiresAt;

    return (
      !!this.accessToken &&
      isPositiveFiniteNumber(expiresAt) &&
      Date.now() < expiresAt
    );
  }

  get token(): string | null {
    return this.accessToken;
  }

  get expiry(): number | null {
    return this.expiresAt;
  }

  get refreshTokenValue(): string | null {
    return this.refreshToken;
  }

  get user(): AdminUser | null {
    return this.currentUserState();
  }

  get role(): AdminRole | null {
    return this.currentUserState()?.role ?? null;
  }

  get roleKey(): string | null {
    return this.role?.key ?? null;
  }

  hasPermission(permission: string): boolean {
    return this.permissionSet().has(permission);
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  login(email: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.config.apiBaseUrl}${this.config.loginPath}`, { email, password }).pipe(
      tap((session) => this.applySession(session)),
      catchError((error) => {
        throw new Error('Login failed: ' + (error instanceof Error ? error.message : String(error)));
      })
    );
  }

  refresh(): Observable<AuthSession> {
    if (!this.refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const currentRefreshToken = this.refreshToken;

    return this.http.post<AuthSession>(`${this.config.apiBaseUrl}${this.config.refreshPath}`, {
      refreshToken: currentRefreshToken,
    }).pipe(
      tap((session) => this.applySession(session, currentRefreshToken)),
      catchError((error) => {
        throw new Error('Refresh failed: ' + (error instanceof Error ? error.message : String(error)));
      })
    );
  }

  me(): Observable<AdminUser> {
    if (!this.accessToken) {
      return throwError(() => new Error('No access token available'));
    }

    return this.http.get<AdminUser>(`${this.config.apiBaseUrl}${this.config.mePath}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    }).pipe(
      tap((user) => {
        this.currentUserState.set(user);
        this.persistToStorage();
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          // Preserve the response so callers can distinguish request failures
          // from transport errors and report them consistently.
          return throwError(() => error);
        }
        throw new Error(
          'Failed to load current user: ' + (error instanceof Error ? error.message : String(error)),
        );
      })
    );
  }

  refreshPermissions(): Observable<AdminUser> {
    // `me()` keeps the last known snapshot when the request fails.
    return this.me();
  }

  logout(): Observable<void> {
    if (!this.accessToken) {
      this.clear();
      return of(void 0);
    }

    return this.http.post<void>(`${this.config.apiBaseUrl}${this.config.logoutPath}`, {}, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    }).pipe(
      tap(() => this.clear()),
      catchError((error) => {
        // Still clear local state even if server fails
        this.clear();
        throw new Error('Logout failed: ' + (error instanceof Error ? error.message : String(error)));
      })
    );
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.currentUserState.set(null);
    this.persistToStorage();
  }

  private applySession(session: AuthSession, fallbackRefreshToken: string | null = null): void {
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken ?? fallbackRefreshToken;
    this.expiresAt = isPositiveFiniteNumber(session.expiresIn)
      ? Date.now() + session.expiresIn * 1000
      : null;
    if (session.user) {
      this.currentUserState.set(session.user);
    }
    this.persistToStorage();
  }
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAdminRole(value: unknown): value is AdminRole {
  if (!isRecord(value)) return false;

  return (
    typeof value['id'] === 'string' &&
    typeof value['key'] === 'string' &&
    typeof value['name'] === 'string' &&
    (value['scope'] === 'store' || value['scope'] === 'platform') &&
    typeof value['system'] === 'boolean' &&
    Array.isArray(value['permissions']) &&
    value['permissions'].every((permission) => typeof permission === 'string')
  );
}

function isAdminUser(value: unknown): value is AdminUser {
  if (!isRecord(value)) return false;

  return (
    typeof value['id'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['displayName'] === 'string' &&
    (value['status'] === 'active' || value['status'] === 'disabled') &&
    isAdminRole(value['role']) &&
    Array.isArray(value['permissions']) &&
    value['permissions'].every((permission) => typeof permission === 'string')
  );
}
