export interface ApiClientOptions {
  baseUrl: string;
}

export interface ApiClient {
  baseUrl: string;
}

export const createApiClient = (options: ApiClientOptions): ApiClient => ({
  baseUrl: options.baseUrl.replace(/\/+$/, ''),
});
