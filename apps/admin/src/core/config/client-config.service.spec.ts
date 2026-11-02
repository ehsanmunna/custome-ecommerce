import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { ClientConfigService } from './client-config.service';
import { DEFAULT_CLIENT_CONFIG } from './client-config.model';

class StubHttpClient {
  constructor(private readonly response: unknown) {}

  get<T>(): Observable<T> {
    if (this.response instanceof Error) {
      return throwError(() => this.response);
    }

    return of(this.response as T);
  }
}

function serviceWith(response: unknown): ClientConfigService {
  return new ClientConfigService(
    new StubHttpClient(response) as unknown as HttpClient,
  );
}

describe('ClientConfigService', () => {
  it('loads valid configuration', async () => {
    const service = serviceWith({
      name: 'Acme Store',
      logo: '/assets/acme.svg',
      primaryColor: '#ABCDEF',
      defaultLanguage: 'bn',
    });

    await expect(service.load()).resolves.toEqual({
      name: 'Acme Store',
      logo: '/assets/acme.svg',
      primaryColor: '#abcdef',
      defaultLanguage: 'bn',
    });
    expect(service.value.name).toBe('Acme Store');
  });

  it('uses defaults when the configuration file is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = serviceWith(new Error('404'));

    await expect(service.load()).resolves.toEqual(DEFAULT_CLIENT_CONFIG);
    expect(service.value).toEqual(DEFAULT_CLIENT_CONFIG);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('uses defaults when the configuration is malformed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = serviceWith({
      name: '',
      logo: 42,
      primaryColor: 'blue',
      defaultLanguage: 'fr',
    });

    await expect(service.load()).resolves.toEqual(DEFAULT_CLIENT_CONFIG);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not block startup when loading fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = serviceWith(new Error('network unavailable'));

    await expect(service.load()).resolves.toBeDefined();
    warn.mockRestore();
  });
});
