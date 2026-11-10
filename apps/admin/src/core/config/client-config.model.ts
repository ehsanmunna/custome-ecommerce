export type ClientLanguage = 'en' | 'bn';

export interface ClientConfig {
  name: string;
  logo?: string;
  primaryColor: string;
  defaultLanguage: ClientLanguage;
}

export const DEFAULT_CLIENT_CONFIG: ClientConfig = Object.freeze({
  name: 'Admin',
  primaryColor: '#2563eb',
  defaultLanguage: 'en',
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeClientConfig(value: unknown): ClientConfig {
  const record = isRecord(value) ? value : {};
  const name = nonEmptyString(record['name']) ?? DEFAULT_CLIENT_CONFIG.name;
  const logo = nonEmptyString(record['logo']);
  const configuredColor = nonEmptyString(record['primaryColor']);
  const primaryColor =
    configuredColor && HEX_COLOR.test(configuredColor)
      ? configuredColor.toLowerCase()
      : DEFAULT_CLIENT_CONFIG.primaryColor;
  const language = record['defaultLanguage'];
  const defaultLanguage: ClientLanguage =
    language === 'bn' || language === 'en'
      ? language
      : DEFAULT_CLIENT_CONFIG.defaultLanguage;

  return {
    name,
    ...(logo ? { logo } : {}),
    primaryColor,
    defaultLanguage,
  };
}

export function isValidClientConfig(value: unknown): value is ClientConfig {
  if (!isRecord(value)) {
    return false;
  }

  return (
    nonEmptyString(value['name']) !== undefined &&
    (value['logo'] === undefined || typeof value['logo'] === 'string') &&
    typeof value['primaryColor'] === 'string' &&
    HEX_COLOR.test(value['primaryColor']) &&
    (value['defaultLanguage'] === 'en' || value['defaultLanguage'] === 'bn')
  );
}
