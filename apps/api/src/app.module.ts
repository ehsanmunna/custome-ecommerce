import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { MediaModule } from './media/media.module';
import { AppConfigModule } from './platform/config/app-config.module';
import { DatabaseModule } from './platform/database/database.module';
import { HealthModule } from './platform/health/health.module';
import { LoggingModule } from './platform/logging/logging.module';
import { SchemaModule } from './platform/schema/schema.module';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    SchemaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    InventoryModule,
    MediaModule,
  ],
})
export class AppModule {}
