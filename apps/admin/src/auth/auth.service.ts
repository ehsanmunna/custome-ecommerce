import { Inject, Injectable, Optional, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from './auth.config';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: string;
  permissions: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user?: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http: HttpClient;
  private readonly config: AdminAuthConfig;
  private readonly storage = typeof window !== 'undefined' ? window.localStorage : null;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private currentUser: AuthUser | null = null;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    configOrInjector?: AdminAuthConfig,
    @Optional() @Inject(ADMIN_AUTH_CONFIG) configFromDi?: AdminAuthConfig,
  ) {
    this.http = httpOrInjector;
    this.config = configOrInjector ?? configFromDi ?? inject(ADMIN_AUTH_CONFIG);
    this.restoreFromStorage();
  }

  private restoreFromStorage(): void {
    if (!this.storage) return;
    const storedAccess = this.storage.getItem(this.config.tokenStorageKey);
    const storedRefresh = this.storage.getItem(this.config.refreshStorageKey);
    if (storedAccess) this.accessToken = storedAccess;
    if (storedRefresh) this.refreshToken = storedRefresh;
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
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken && this.expiresAt !== null && Date.now() < this.expiresAt;
  }

  get token(): string | null {
    return this.accessToken;
  }

  get user(): AuthUser | null {
    return this.currentUser;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const response = await this.http
      .post<AuthSession>(`${this.config.apiBaseUrl}${this.config.loginPath}`, { email, password })
      .toPromise();

    if (!response) {
      throw new Error('Login failed: empty response');
    }

    this.accessToken = response.accessToken;
    this.refreshToken = response.refreshToken ?? null;
    this.expiresAt = Date.now() + response.expiresIn * 1000;
    this.currentUser = response.user ?? null;
    this.persistToStorage();

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

    this.accessToken = response.accessToken;
    this.refreshToken = response.refreshToken ?? this.refreshToken;
    this.expiresAt = Date.now() + response.expiresIn * 1000;
    if (response.user) this.currentUser = response.user;
    this.persistToStorage();

    return response;
  }

  async me(): Promise<AuthUser> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await this.http
      .get<{ user: AuthUser }>(`${this.config.apiBaseUrl}${this.config.mePath}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      .toPromise();

    if (!response?.user) {
      throw new Error('Failed to load current user');
    }

    this.currentUser = response.user;
    return response.user;
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
      this.accessToken = null;
      this.refreshToken = null;
      this.expiresAt = null;
      this.currentUser = null;
      this.persistToStorage();
    }
  }

  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.currentUser = null;
    this.persistToStorage();
  }
}
