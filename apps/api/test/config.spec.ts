import { describe, expect, it } from 'vitest';
import { validateEnv } from '../src/platform/config/env.schema';

describe('config validation', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app',
    AUTH_TOKEN_SIGNING_SECRET: 'signing-secret-at-least-32-chars',
    AUTH_TOKEN_HASH_SECRET: 'hash-secret-at-least-32-chars',
    NODE_ENV: 'development',
    PORT: '3000',
  };

  it('applies safe defaults without requiring media credentials', () => {
    const config = validateEnv(validEnv);

    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
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

    expect(message).toContain('NODE_ENV');
    expect(message).toContain('DATABASE_PROBE_TIMEOUT_MS');
    expect(message).toContain('LOG_LEVEL');
  });
});
