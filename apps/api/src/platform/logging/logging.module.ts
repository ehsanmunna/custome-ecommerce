import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { StructuredLogger } from './structured-logger';

@Global()
@Module({
  providers: [
    {
      provide: StructuredLogger,
      useFactory: (config: AppConfigService) =>
        new StructuredLogger({ level: config.logLevel, secrets: config.secretValues }),
      inject: [AppConfigService],
    },
  ],
  exports: [StructuredLogger],
})
export class LoggingModule {}
