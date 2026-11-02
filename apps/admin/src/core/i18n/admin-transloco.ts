import {
  inject,
  isDevMode,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { ClientConfigService } from '../config/client-config.service';
import { TranslocoHttpLoader } from './transloco-http.loader';

export const ADMIN_LANGUAGES = ['en', 'bn'] as const;

export function provideAdminTransloco(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...ADMIN_LANGUAGES],
      defaultLang: 'en',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: {
        logMissingKey: true,
        useFallbackTranslation: true,
        allowEmpty: false,
      },
    },
    loader: TranslocoHttpLoader,
  });
}

/** Applies the client's configured default language until a user overrides it. */
export function provideClientLanguage(): EnvironmentProviders {
  return provideAppInitializer(async () => {
    const clientConfig = inject(ClientConfigService);
    const transloco = inject(TranslocoService);

    const config = await clientConfig.load();
    transloco.setActiveLang(config.defaultLanguage);
  });
}
