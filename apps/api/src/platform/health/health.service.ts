import { Injectable } from '@nestjs/common';
import type { ReadinessResponse } from 'shared-types';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { StructuredLogger } from '../logging/structured-logger';
import { SchemaCompatibilityService } from '../schema/schema-compatibility.service';
import { withTimeout } from '../timeout';

const DATABASE_PROBE_QUERY = 'SELECT 1';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly schemaCompatibility: SchemaCompatibilityService,
    private readonly logger: StructuredLogger,
  ) {}

  async checkReadiness(): Promise<ReadinessResponse> {
    const database = await this.probeDatabase();
    const schema = await this.schemaCompatibility.check();
    const schemaStatus = schema.status === 'match' ? 'ok' : 'error';
    const healthy = database === 'ok' && schemaStatus === 'ok';

    return {
      status: healthy ? 'ok' : 'error',
      checks: {
        database: { status: database },
        schema: { status: schemaStatus },
      },
    };
  }

  private async probeDatabase(): Promise<'ok' | 'error'> {
    try {
      await withTimeout(
        this.prisma.$queryRawUnsafe(DATABASE_PROBE_QUERY),
        this.config.databaseProbeTimeoutMs,
        'database probe',
      );
      return 'ok';
    } catch {
      this.logger.warn({ event: 'database.probe.failed' }, 'HealthService');
      return 'error';
    }
  }
}
