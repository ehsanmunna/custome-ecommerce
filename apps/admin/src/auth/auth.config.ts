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
  apiBaseUrl: '',
  brandName: 'Admin',
  loginPath: '/admin/auth/login',
  logoutPath: '/admin/auth/logout',
  refreshPath: '/admin/auth/refresh',
  mePath: '/admin/auth/me',
  tokenStorageKey: 'admin_access_token',
  refreshStorageKey: 'admin_refresh_token',
};
