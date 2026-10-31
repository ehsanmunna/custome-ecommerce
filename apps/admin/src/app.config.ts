import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ADMIN_AUTH_CONFIG, defaultAdminAuthConfig } from './auth/auth.config';

const apiBaseUrl = process.env['ADMIN_API_BASE_URL'] || defaultAdminAuthConfig.apiBaseUrl;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    { provide: ADMIN_AUTH_CONFIG, useValue: { ...defaultAdminAuthConfig, apiBaseUrl } },
  ],
};
