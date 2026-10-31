import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfigService } from './platform/config/app-config.service';
import { StructuredLogger } from './platform/logging/structured-logger';
import { SchemaCompatibilityService } from './platform/schema/schema-compatibility.service';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  try {
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    const logger = app.get(StructuredLogger);
    app.useLogger(logger);

    const config = app.get(AppConfigService);
    logger.log({
      event: 'configuration.effective',
      ...config.describe(),
    });

    app.enableCors({
      origin: 'http://localhost:4200',
      credentials: true,
    });

    const schema = app.get(SchemaCompatibilityService);
    await schema.assertCompatible();

    await app.listen(config.port, '0.0.0.0');
  } catch (error) {
    await app.close();
    throw error;
  }
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: 'fatal',
        message: 'API startup failed',
        error: message,
      }),
    );
    process.exitCode = 1;
  });
}
