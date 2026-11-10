import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { ADMIN_AUTH_CONFIG, defaultAdminAuthConfig } from './auth/auth.config';
import { authInterceptor } from './core/http/auth.interceptor';
import { provideClientConfig } from './core/config/client-config.service';
import { provideClientTheme } from './core/theme/client-preset';
import { provideAdminTransloco, provideClientLanguage } from './core/i18n/admin-transloco';
import { providePrimeNgTranslations } from './core/i18n/primeng-translation';

const apiBaseUrl = process.env['ADMIN_API_BASE_URL'] || defaultAdminAuthConfig.apiBaseUrl;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    MessageService,
    provideClientConfig(),
    provideClientTheme(),
    ...provideAdminTransloco(),
    provideClientLanguage(),
    providePrimeNgTranslations(),
    { provide: ADMIN_AUTH_CONFIG, useValue: { ...defaultAdminAuthConfig, apiBaseUrl } },
  ],
};
