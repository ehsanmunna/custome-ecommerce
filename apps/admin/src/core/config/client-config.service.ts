import {
  Inject,
  Injectable,
  inject,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_CLIENT_CONFIG,
  isValidClientConfig,
  normalizeClientConfig,
  type ClientConfig,
} from './client-config.model';

export const CLIENT_CONFIG_URL = '/assets/client.config.json';

@Injectable({ providedIn: 'root' })
export class ClientConfigService {
  private readonly current = signal<ClientConfig>(DEFAULT_CLIENT_CONFIG);

  private pendingLoad?: Promise<ClientConfig>;

  readonly config: Signal<ClientConfig> = this.current.asReadonly();

  constructor(@Inject(HttpClient) private readonly http: HttpClient) {}

  get value(): ClientConfig {
    return this.current();
  }

  load(): Promise<ClientConfig> {
    this.pendingLoad ??= this.fetchConfig();
    return this.pendingLoad;
  }

  private async fetchConfig(): Promise<ClientConfig> {
    try {
      const response = await firstValueFrom(this.http.get<unknown>(CLIENT_CONFIG_URL));

      if (!isValidClientConfig(response)) {
        console.warn(
          `Client configuration at ${CLIENT_CONFIG_URL} is missing required values; using defaults.`,
        );
      }

      const config = normalizeClientConfig(response);
      this.current.set(config);
      return config;
    } catch (error) {
      console.warn(
        `Client configuration at ${CLIENT_CONFIG_URL} could not be loaded; using defaults.`,
        error,
      );
      this.current.set(DEFAULT_CLIENT_CONFIG);
      return DEFAULT_CLIENT_CONFIG;
    }
  }
}

export function provideClientConfig(): EnvironmentProviders {
  return provideAppInitializer(() => inject(ClientConfigService).load());
}
