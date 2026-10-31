import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CartCheckoutModule } from './cart-checkout/cart-checkout.module';
import { CatalogModule } from './catalog/catalog.module';
import { InventoryModule } from './inventory/inventory.module';
import { MediaModule } from './media/media.module';
import { ShippingModule } from './shipping/shipping.module';
import { RolesModule } from './roles/roles.module';
import { OrdersModule } from './orders/orders.module';
import { SettingsModule } from './settings/settings.module';
import { CouponsModule } from './coupons/coupons.module';
import { CmsModule } from './cms/cms.module';
import { CustomersModule } from './customers/customers.module';
import { AnalyticsModule } from './analytics/analytics.module';
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
    CartCheckoutModule,
    CatalogModule,
    InventoryModule,
    MediaModule,
    ShippingModule,
    RolesModule,
    OrdersModule,
    SettingsModule,
    CouponsModule,
    CmsModule,
    CustomersModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
