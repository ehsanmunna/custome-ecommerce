import { InjectionToken } from '@angular/core';

export interface AdminAuthConfig {
  apiBaseUrl: string;
  brandName: string;
  loginPath: string;
  logoutPath: string;
  refreshPath: string;
  mePath: string;
  tokenStorageKey: string;
  refreshStorageKey: string;
}

export const ADMIN_AUTH_CONFIG = new InjectionToken<AdminAuthConfig>('ADMIN_AUTH_CONFIG');

export const defaultAdminAuthConfig: AdminAuthConfig = {
  apiBaseUrl: 'http://localhost:3000',
  brandName: 'Admin',
  loginPath: '/v1/admin/auth/login',
  logoutPath: '/v1/admin/auth/logout',
  refreshPath: '/v1/admin/auth/refresh',
  mePath: '/v1/admin/auth/me',
  tokenStorageKey: 'admin_access_token',
  refreshStorageKey: 'admin_refresh_token',
};
