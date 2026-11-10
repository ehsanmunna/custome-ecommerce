import { Module } from '@nestjs/common';
import { AdminCatalogController, StorefrontCatalogController } from './catalog.controller';
import { AdminProductController } from './admin-product.controller';
import { StorefrontProductController } from './storefront-product.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [
    StorefrontCatalogController,
    StorefrontProductController,
    AdminCatalogController,
    AdminProductController,
  ],
  providers: [CatalogService],
})
export class CatalogModule {}
