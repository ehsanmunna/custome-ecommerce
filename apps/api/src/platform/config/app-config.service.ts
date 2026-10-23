import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './env.schema';

@Injectable()
export class AppConfigService {
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

  get secretValues(): string[] {
    return [this.databaseUrl];
  }

  describe(): Record<string, string | number> {
    return {
      NODE_ENV: this.nodeEnv,
      PORT: this.port,
      DATABASE_URL: '[REDACTED]',
      DATABASE_PROBE_TIMEOUT_MS: this.databaseProbeTimeoutMs,
      LOG_LEVEL: this.logLevel,
    };
  }
}
