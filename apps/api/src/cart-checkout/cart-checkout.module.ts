import { Module } from '@nestjs/common';
import { CartCheckoutController } from './cart-checkout.controller';
import { CartCheckoutService } from './cart-checkout.service';

@Module({
  controllers: [CartCheckoutController],
  providers: [CartCheckoutService],
})
export class CartCheckoutModule {}
