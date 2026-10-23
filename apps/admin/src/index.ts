export const ADMIN_APP_NAME = 'admin';

export interface AdminBootstrapConfig {
  apiBaseUrl: string;
}

export const adminPlaceholder = (config: AdminBootstrapConfig): string =>
  `${ADMIN_APP_NAME} placeholder (api: ${config.apiBaseUrl})`;
