import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './env.schema';

@Injectable()
export class AppConfigService {
  private readonly ephemeralSigningSecret = randomBytes(32).toString('base64url');
  private readonly ephemeralHashSecret = randomBytes(32).toString('base64url');

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private read<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config.getOrThrow(key) as AppConfig[K];
  }

  get nodeEnv(): AppConfig['NODE_ENV'] {
    return this.read('NODE_ENV');
  }

  get port(): number {
    return this.read('PORT');
  }

  get databaseUrl(): string {
    return this.read('DATABASE_URL');
  }

  get databaseProbeTimeoutMs(): number {
    return this.read('DATABASE_PROBE_TIMEOUT_MS');
  }

  get logLevel(): AppConfig['LOG_LEVEL'] {
    return this.read('LOG_LEVEL');
  }

  get authTokenSigningSecret(): string {
    return this.config.get('AUTH_TOKEN_SIGNING_SECRET') ?? this.ephemeralSigningSecret;
  }

  get authTokenHashSecret(): string {
    return this.config.get('AUTH_TOKEN_HASH_SECRET') ?? this.ephemeralHashSecret;
  }

  get authAccessTokenTtlSeconds(): number {
    return this.read('AUTH_ACCESS_TOKEN_TTL_SECONDS');
  }

  get authRefreshTokenTtlSeconds(): number {
    return this.read('AUTH_REFRESH_TOKEN_TTL_SECONDS');
  }

  get authOtpTtlSeconds(): number {
    return this.read('AUTH_OTP_TTL_SECONDS');
  }

  get authOtpMaxAttempts(): number {
    return this.read('AUTH_OTP_MAX_ATTEMPTS');
  }

  get authOtpRateLimitCount(): number {
    return this.read('AUTH_OTP_RATE_LIMIT_COUNT');
  }

  get authOtpRateLimitWindowSeconds(): number {
    return this.read('AUTH_OTP_RATE_LIMIT_WINDOW_SECONDS');
  }

  get resendApiKey(): string | undefined {
    return this.config.get('RESEND_API_KEY');
  }

  get resendFromEmail(): string | undefined {
    return this.config.get('RESEND_FROM_EMAIL');
  }

  get twilioAccountSid(): string | undefined {
    return this.config.get('TWILIO_ACCOUNT_SID');
  }

  get twilioAuthToken(): string | undefined {
    return this.config.get('TWILIO_AUTH_TOKEN');
  }

  get twilioFromNumber(): string | undefined {
    return this.config.get('TWILIO_FROM_NUMBER');
  }

  get steadfastApiKey(): string | undefined {
    return this.config.get('STEADFAST_API_KEY');
  }

  get steadfastApiBaseUrl(): string | undefined {
    return this.config.get('STEADFAST_API_BASE_URL');
  }

  get steadfastWebhookSecret(): string | undefined {
    return this.config.get('STEADFAST_WEBHOOK_SECRET');
  }

  get secretValues(): string[] {
    return [
      this.databaseUrl,
      this.authTokenSigningSecret,
      this.authTokenHashSecret,
      ...[this.resendApiKey, this.twilioAuthToken].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
      ...[this.steadfastApiKey, this.steadfastWebhookSecret].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    ];
  }

  describe(): Record<string, string | number | boolean> {
    return {
      NODE_ENV: this.nodeEnv,
      PORT: this.port,
      DATABASE_URL: '[REDACTED]',
      DATABASE_PROBE_TIMEOUT_MS: this.databaseProbeTimeoutMs,
      LOG_LEVEL: this.logLevel,
      AUTH_TOKEN_SIGNING_SECRET: '[REDACTED]',
      AUTH_TOKEN_HASH_SECRET: '[REDACTED]',
      AUTH_ACCESS_TOKEN_TTL_SECONDS: this.authAccessTokenTtlSeconds,
      AUTH_REFRESH_TOKEN_TTL_SECONDS: this.authRefreshTokenTtlSeconds,
      AUTH_OTP_TTL_SECONDS: this.authOtpTtlSeconds,
      AUTH_OTP_MAX_ATTEMPTS: this.authOtpMaxAttempts,
      AUTH_OTP_RATE_LIMIT_COUNT: this.authOtpRateLimitCount,
      AUTH_OTP_RATE_LIMIT_WINDOW_SECONDS: this.authOtpRateLimitWindowSeconds,
      RESEND_API_KEY: '[REDACTED]',
      RESEND_FROM_EMAIL: this.resendFromEmail ?? '',
      TWILIO_ACCOUNT_SID: '[REDACTED]',
      TWILIO_AUTH_TOKEN: '[REDACTED]',
      TWILIO_FROM_NUMBER: this.twilioFromNumber ?? '',
      STEADFAST_API_KEY: '[REDACTED]',
      STEADFAST_API_BASE_URL: this.steadfastApiBaseUrl ?? '',
      STEADFAST_WEBHOOK_SECRET: '[REDACTED]',
    };
  }
}
