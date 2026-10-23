import { Injectable } from '@nestjs/common';
import { EXPECTED_SCHEMA_VERSION } from 'database';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { withTimeout } from '../timeout';

export type SchemaMismatchReason = 'behind' | 'ahead' | 'uninitialized' | 'error';
export type SchemaCheckStatus = 'match' | SchemaMismatchReason;

export interface SchemaCheckResult {
  status: SchemaCheckStatus;
  expected: string;
  actual: string | null;
}

export class SchemaCompatibilityError extends Error {
  constructor(
    readonly reason: SchemaMismatchReason,
    message: string,
  ) {
    super(message);
    this.name = 'SchemaCompatibilityError';
  }
}

const SCHEMA_VERSION_QUERY = 'SELECT version FROM schema_version LIMIT 1';

function isMissingSchemaObject(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: string; meta?: { code?: string }; message?: string };

  return (
    candidate.code === 'P2021' ||
    candidate.meta?.code === '42P01' ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('schema_version') &&
      candidate.message.includes('does not exist'))
  );
}

function describeMismatch(result: SchemaCheckResult): string {
  const actual = result.actual ?? 'none';

  switch (result.status) {
    case 'behind':
      return `Database schema is behind the running build: database=${actual}, expected=${result.expected}. Run migrations with the migration identity before starting the API.`;
    case 'ahead':
      return `Database schema is ahead of the running build: database=${actual}, expected=${result.expected}. This build is outdated; deploy the build that matches the database.`;
    case 'uninitialized':
      return `Database schema is uninitialized: no schema version was found (expected=${result.expected}). Run migrations with the migration identity before starting the API.`;
    default:
      return `Unable to verify the database schema version (expected=${result.expected}). The database may be unreachable.`;
  }
}

@Injectable()
export class SchemaCompatibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async check(): Promise<SchemaCheckResult> {
    const expected = EXPECTED_SCHEMA_VERSION;
    let rows: Array<{ version: string }>;

    try {
      rows = await withTimeout(
        this.prisma.$queryRawUnsafe<Array<{ version: string }>>(SCHEMA_VERSION_QUERY),
        this.config.databaseProbeTimeoutMs,
        'schema version check',
      );
    } catch (error) {
      if (isMissingSchemaObject(error)) {
        return { status: 'uninitialized', expected, actual: null };
      }
      return { status: 'error', expected, actual: null };
    }

    const actual = rows[0]?.version ?? null;

    if (!actual) {
      return { status: 'uninitialized', expected, actual: null };
    }

    if (actual === expected) {
      return { status: 'match', expected, actual };
    }

    return {
      status: actual < expected ? 'behind' : 'ahead',
      expected,
      actual,
    };
  }

  async assertCompatible(): Promise<SchemaCheckResult> {
    const result = await this.check();

    if (result.status === 'match') {
      return result;
    }

    throw new SchemaCompatibilityError(result.status, describeMismatch(result));
  }
}
