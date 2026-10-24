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

  get secretValues(): string[] {
    return [this.databaseUrl, this.authTokenSigningSecret, this.authTokenHashSecret];
  }

  describe(): Record<string, string | number> {
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
    };
  }
}
