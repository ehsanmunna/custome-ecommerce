export const STOREFRONT_STARTER_NAME = 'storefront-starter';

export interface StorefrontBootstrapConfig {
  apiBaseUrl: string;
  locale: 'bn' | 'en';
}

export const storefrontPlaceholder = (config: StorefrontBootstrapConfig): string =>
  `${STOREFRONT_STARTER_NAME} placeholder (api: ${config.apiBaseUrl}, locale: ${config.locale})`;
