import { describe, expect, it } from 'vitest';
import { AppConfigService } from '../src/platform/config/app-config.service';
import type { AppConfig } from '../src/platform/config/env.schema';

function createConfig(overrides: Partial<AppConfig> = {}) {
  const values: Record<string, unknown> = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app',
    DATABASE_PROBE_TIMEOUT_MS: 2000,
    LOG_LEVEL: 'info',
    AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
    AUTH_REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
    AUTH_OTP_TTL_SECONDS: 300,
    AUTH_OTP_MAX_ATTEMPTS: 5,
    AUTH_OTP_RATE_LIMIT_COUNT: 5,
    AUTH_OTP_RATE_LIMIT_WINDOW_SECONDS: 3600,
    R2_UPLOAD_TTL_SECONDS: 600,
    R2_MAX_UPLOAD_BYTES: 10_485_760,
    R2_IMAGE_RESIZING_ENABLED: true,
    ...overrides,
  };

  return new AppConfigService({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as never);
}

describe('app configuration service', () => {
  it('exposes R2 settings and includes configured credentials in log redaction', () => {
    const config = createConfig({
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'media-bucket',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      R2_IMAGE_RESIZING_ENABLED: false,
    });

    expect(config.r2AccountId).toBe('account-id');
    expect(config.r2Bucket).toBe('media-bucket');
    expect(config.r2UploadTtlSeconds).toBe(600);
    expect(config.r2MaxUploadBytes).toBe(10_485_760);
    expect(config.r2ImageResizingEnabled).toBe(false);
    expect(config.secretValues).toContain('access-key');
    expect(config.secretValues).toContain('secret-key');
  });

  it('describes effective configuration without exposing R2 credentials', () => {
    const config = createConfig({
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'media-bucket',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
    });

    const described = config.describe();

    expect(described).toMatchObject({
      R2_ACCOUNT_ID: '[REDACTED]',
      R2_ACCESS_KEY_ID: '[REDACTED]',
      R2_SECRET_ACCESS_KEY: '[REDACTED]',
      R2_BUCKET: 'media-bucket',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      R2_UPLOAD_TTL_SECONDS: 600,
      R2_MAX_UPLOAD_BYTES: 10_485_760,
      R2_IMAGE_RESIZING_ENABLED: true,
    });
    expect(JSON.stringify(described)).not.toContain('access-key');
    expect(JSON.stringify(described)).not.toContain('secret-key');
  });

  it('omits absent R2 credentials from log redaction', () => {
    const config = createConfig();

    expect(config.r2AccountId).toBeUndefined();
    expect(config.secretValues).toEqual([
      'postgresql://app_runtime:secret@localhost:5432/app',
      config.authTokenSigningSecret,
      config.authTokenHashSecret,
    ]);
  });

  it('exposes OTP provider settings and redacts provider credentials', () => {
    const config = createConfig({
      RESEND_API_KEY: 'resend-secret',
      RESEND_FROM_EMAIL: 'otp@example.com',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'twilio-secret',
      TWILIO_FROM_NUMBER: '+15005550006',
    });

    expect(config.resendApiKey).toBe('resend-secret');
    expect(config.resendFromEmail).toBe('otp@example.com');
    expect(config.twilioAccountSid).toBe('AC123');
    expect(config.twilioAuthToken).toBe('twilio-secret');
    expect(config.twilioFromNumber).toBe('+15005550006');
    expect(config.secretValues).toContain('resend-secret');
    expect(config.secretValues).toContain('twilio-secret');
    expect(config.describe()).toMatchObject({
      RESEND_API_KEY: '[REDACTED]',
      RESEND_FROM_EMAIL: 'otp@example.com',
      TWILIO_ACCOUNT_SID: '[REDACTED]',
      TWILIO_AUTH_TOKEN: '[REDACTED]',
      TWILIO_FROM_NUMBER: '+15005550006',
    });
    expect(JSON.stringify(config.describe())).not.toContain('resend-secret');
    expect(JSON.stringify(config.describe())).not.toContain('twilio-secret');
  });
});
