import { Module } from '@nestjs/common';
import { AdminCatalogController, StorefrontCatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [StorefrontCatalogController, AdminCatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
