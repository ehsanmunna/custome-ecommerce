export const ADMIN_APP_NAME = 'admin';

export interface AdminBootstrapConfig {
  apiBaseUrl: string;
}

export function bootstrapAdmin(config: AdminBootstrapConfig): void {
  // Angular application is bootstrapped via main.ts
  // This entry point is kept for compatibility with the workspace build
  void config;
}
