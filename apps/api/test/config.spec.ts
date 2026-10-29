import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/platform/config/env.schema';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app?schema=public',
  DATABASE_PROBE_TIMEOUT_MS: '2000',
  LOG_LEVEL: 'info',
};

describe('configuration validation', () => {
  it('accepts complete configuration and coerces numeric values', () => {
    const config = validateEnv(validEnv);

    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_PROBE_TIMEOUT_MS).toBe(2000);
  });

  it('fails and names a missing required key without falling back to a default', () => {
    const { DATABASE_URL: _missing, ...incomplete } = validEnv;

    expect(() => validateEnv(incomplete)).toThrowError(/DATABASE_URL/);
  });

  it('fails and names a key with an invalid value', () => {
    expect(() => validateEnv({ ...validEnv, PORT: 'not-a-port' })).toThrowError(/PORT/);
    expect(() => validateEnv({ ...validEnv, DATABASE_URL: 'mysql://localhost/app' })).toThrowError(
      /DATABASE_URL/,
    );
    expect(() => validateEnv({ ...validEnv, AUTH_OTP_MAX_ATTEMPTS: '0' })).toThrowError(
      /AUTH_OTP_MAX_ATTEMPTS/,
    );
  });

  it('requires independent auth secrets of sufficient length in production', () => {
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'production' })).toThrowError(
      /AUTH_TOKEN_SIGNING_SECRET/,
    );

    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        AUTH_TOKEN_SIGNING_SECRET: 'a'.repeat(32),
        AUTH_TOKEN_HASH_SECRET: 'b'.repeat(32),
      }),
    ).not.toThrow();

    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        AUTH_TOKEN_SIGNING_SECRET: 'same-secret-used-for-both-32-characters',
        AUTH_TOKEN_HASH_SECRET: 'same-secret-used-for-both-32-characters',
      }),
    ).toThrowError(/must differ/);
  });

  it('rejects short configured auth secrets', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        AUTH_TOKEN_SIGNING_SECRET: 'too-short',
      }),
    ).toThrowError(/AUTH_TOKEN_SIGNING_SECRET/);
  });

  it('applies safe media defaults without requiring R2 credentials', () => {
    const config = validateEnv(validEnv);

    expect(config.R2_UPLOAD_TTL_SECONDS).toBe(600);
    expect(config.R2_MAX_UPLOAD_BYTES).toBe(10_485_760);
    expect(config.R2_IMAGE_RESIZING_ENABLED).toBe(true);
    expect(config.R2_ACCOUNT_ID).toBeUndefined();
  });

  it('allows OTP providers to be omitted or configured as complete independent groups', () => {
    expect(validateEnv(validEnv).RESEND_API_KEY).toBeUndefined();

    const config = validateEnv({
      ...validEnv,
      RESEND_API_KEY: 'resend-secret',
      RESEND_FROM_EMAIL: 'otp@example.com',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'twilio-secret',
      TWILIO_FROM_NUMBER: '+15005550006',
    });

    expect(config.RESEND_API_KEY).toBe('resend-secret');
    expect(config.TWILIO_ACCOUNT_SID).toBe('AC123');
  });

  it('rejects incomplete OTP provider configuration and identifies missing keys', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        RESEND_API_KEY: 'resend-secret',
      }),
    ).toThrowError(/RESEND_FROM_EMAIL/);

    expect(() =>
      validateEnv({
        ...validEnv,
        TWILIO_ACCOUNT_SID: 'AC123',
        TWILIO_FROM_NUMBER: '+15005550006',
      }),
    ).toThrowError(/TWILIO_AUTH_TOKEN/);
  });

  it('accepts complete R2 configuration and coerces numeric and boolean values', () => {
    const config = validateEnv({
      ...validEnv,
      R2_ACCOUNT_ID: 'account-id',
      R2_BUCKET: 'media-bucket',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      R2_UPLOAD_TTL_SECONDS: '3600',
      R2_MAX_UPLOAD_BYTES: '104857600',
      R2_IMAGE_RESIZING_ENABLED: 'false',
    });

    expect(config.R2_UPLOAD_TTL_SECONDS).toBe(3600);
    expect(config.R2_MAX_UPLOAD_BYTES).toBe(104_857_600);
    expect(config.R2_IMAGE_RESIZING_ENABLED).toBe(false);
  });

  it('rejects unsafe media limits and non-boolean toggles', () => {
    expect(() => validateEnv({ ...validEnv, R2_UPLOAD_TTL_SECONDS: '59' })).toThrowError(
      /R2_UPLOAD_TTL_SECONDS/,
    );
    expect(() => validateEnv({ ...validEnv, R2_UPLOAD_TTL_SECONDS: '3601' })).toThrowError(
      /R2_UPLOAD_TTL_SECONDS/,
    );
    expect(() => validateEnv({ ...validEnv, R2_MAX_UPLOAD_BYTES: '0' })).toThrowError(
      /R2_MAX_UPLOAD_BYTES/,
    );
    expect(() => validateEnv({ ...validEnv, R2_MAX_UPLOAD_BYTES: '104857601' })).toThrowError(
      /R2_MAX_UPLOAD_BYTES/,
    );
    expect(() => validateEnv({ ...validEnv, R2_IMAGE_RESIZING_ENABLED: 'yes' })).toThrowError(
      /R2_IMAGE_RESIZING_ENABLED/,
    );
  });

  it('reports every offending key in one error', () => {
    let message = '';

    try {
      validateEnv({
        NODE_ENV: 'invalid',
        DATABASE_PROBE_TIMEOUT_MS: '-5',
        LOG_LEVEL: 'loud',
      });
    } catch (error) {
      message = (error as Error).message;
    }

    for (const key of [
      'NODE_ENV',
      'PORT',
      'DATABASE_URL',
      'DATABASE_PROBE_TIMEOUT_MS',
      'LOG_LEVEL',
    ]) {
      expect(message).toContain(key);
    }
  });
});
