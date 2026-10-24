import createClient, { type ClientOptions } from 'openapi-fetch';
import type { paths } from './generated/api';

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  fetch?: ClientOptions['fetch'];
}

export type ApiClient = ReturnType<typeof createClient<paths>> & {
  baseUrl: string;
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const client = createClient<paths>({
    baseUrl,
    fetch: options.fetch,
  });

  if (options.getAccessToken) {
    client.use({
      async onRequest({ request }) {
        const accessToken = await options.getAccessToken?.();
        if (accessToken) {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
        }
        return request;
      },
    });
  }

  return Object.assign(client, { baseUrl });
}

export type { paths } from './generated/api';
