import { timingSafeEqual } from 'node:crypto';
import { Inject, Module } from '@nestjs/common';
import { AppConfigService } from '../platform/config/app-config.service';
import { SHIPPING_ADAPTER, ShippingAdapter } from './shipping-adapter';
import { SteadfastShippingAdapter } from './steadfast-shipping.adapter';
import { ShippingController } from './shipping.controller';
import { SteadfastWebhookController } from './shipping.controller';
import {
  ShippingService,
  VerifyWebhookSignature,
  VERIFY_WEBHOOK_SIGNATURE,
} from './shipping.service';

function createSteadfastWebhookVerifier(
  config: AppConfigService,
): VerifyWebhookSignature {
  const secret = config.steadfastWebhookSecret;
  if (!secret) {
    return async () => false;
  }

  const expected = Buffer.from(secret, 'utf8');

  return async (_payload: string | Buffer, signature: string | undefined) => {
    if (!signature || typeof signature !== 'string') return false;
    const actual = Buffer.from(signature, 'utf8');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  };
}

@Module({
  controllers: [ShippingController, SteadfastWebhookController],
  providers: [
    {
      provide: SHIPPING_ADAPTER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new SteadfastShippingAdapter({
          apiKey: config.steadfastApiKey,
          baseUrl: config.steadfastApiBaseUrl,
        }),
    },
    {
      provide: VERIFY_WEBHOOK_SIGNATURE,
      inject: [AppConfigService],
      useFactory: createSteadfastWebhookVerifier,
    },
    ShippingService,
  ],
  exports: [SHIPPING_ADAPTER, ShippingService],
})
export class ShippingModule {}
