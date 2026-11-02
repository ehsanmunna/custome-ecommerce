import { inject, provideAppInitializer, type EnvironmentProviders } from '@angular/core';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { PrimeNG } from 'primeng/config';
import { ClientConfigService } from '../config/client-config.service';
import { buildPalette } from './palette';

export function createClientPreset(primaryColor: string) {
  return definePreset(Aura, {
    semantic: {
      primary: buildPalette(primaryColor),
    },
  });
}

/**
 * Applies the client-specific PrimeNG preset after the client configuration
 * has been loaded. The loader is cached, so this never hits the network twice.
 */
export function provideClientTheme(): EnvironmentProviders {
  return provideAppInitializer(async () => {
    const clientConfig = inject(ClientConfigService);
    const primeng = inject(PrimeNG);
    const config = await clientConfig.load();

    primeng.setConfig({
      theme: {
        preset: createClientPreset(config.primaryColor),
      },
    });
  });
}
