import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { components } from 'api-sdk';
import { ADMIN_AUTH_CONFIG } from './auth.config';
import type { AdminAuthConfig } from './auth.config';

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
  private currentUser: AdminUser | null = null;

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
    this.expiresAt = Number.isFinite(parsedExpiry) ? parsedExpiry : null;

    const storedUser = this.storage.getItem(this.config.userStorageKey);
    if (storedUser === null) {
      this.currentUser = null;
      return;
    }

    try {
      const parsedUser: unknown = JSON.parse(storedUser);
      this.currentUser = isAdminUser(parsedUser) ? parsedUser : null;
    } catch {
      this.currentUser = null;
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

    if (this.currentUser) {
      this.storage.setItem(this.config.userStorageKey, JSON.stringify(this.currentUser));
    } else {
      this.storage.removeItem(this.config.userStorageKey);
    }
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken && this.expiresAt !== null && Date.now() < this.expiresAt;
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
    return this.currentUser;
  }

  get role(): AdminRole | null {
    return this.currentUser?.role ?? null;
  }

  get roleKey(): string | null {
    return this.role?.key ?? null;
  }

  hasRole(role: string): boolean {
    return this.roleKey === role;
  }

  hasAnyRole(roles: readonly string[]): boolean {
    return this.roleKey !== null && roles.includes(this.roleKey);
  }

  hasPermission(permission: string): boolean {
    return this.currentUser?.permissions?.includes(permission) ?? false;
  }

  hasAnyPermission(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.hasPermission(permission));
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await this.http
      .post<AuthSession>(`${this.config.apiBaseUrl}${this.config.loginPath}`, { email, password })
      .toPromise();

    if (!response) {
      throw new Error('Login failed: empty response');
    }

    this.applySession(response);
    return response;
  }

  async refresh(): Promise<AuthSession> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.http
      .post<AuthSession>(`${this.config.apiBaseUrl}${this.config.refreshPath}`, {
        refreshToken: this.refreshToken,
      })
      .toPromise();

    if (!response) {
      throw new Error('Refresh failed: empty response');
    }

    this.applySession(response, this.refreshToken);
    return response;
  }

  async me(): Promise<AdminUser> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await this.http
      .get<AdminUser>(`${this.config.apiBaseUrl}${this.config.mePath}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      .toPromise();

    if (!response) {
      throw new Error('Failed to load current user');
    }

    this.currentUser = response;
    this.persistToStorage();
    return response;
  }

  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await this.http
          .post(`${this.config.apiBaseUrl}${this.config.logoutPath}`, {}, {
            headers: { Authorization: `Bearer ${this.accessToken}` },
          })
          .toPromise();
      }
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.currentUser = null;
    this.persistToStorage();
  }

  private applySession(session: AuthSession, fallbackRefreshToken: string | null = null): void {
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken ?? fallbackRefreshToken;
    this.expiresAt = Date.now() + session.expiresIn * 1000;
    if (session.user) {
      this.currentUser = session.user;
    }
    this.persistToStorage();
  }
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
