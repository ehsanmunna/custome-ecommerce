import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { CouponsService } from './coupons.service';
import {
  parseCouponInput,
  couponInputSchema,
  couponQuerySchema,
} from './coupons.schemas';

@Controller('admin/coupons')
export class CouponsController {
  constructor(@Inject(CouponsService) private readonly coupons: CouponsService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: 'promotions.coupons.read',
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.coupons.listCoupons(parseCouponInput(couponQuerySchema, query));
  }

  @Post()
  @AuthAccess({
    access: 'admin',
    permission: 'promotions.coupons.create',
    scope: 'store',
  })
  create(@Body() body: unknown) {
    return this.coupons.createCoupon(parseCouponInput(couponInputSchema, body));
  }

  @Patch(':couponId')
  @AuthAccess({
    access: 'admin',
    permission: 'promotions.coupons.update',
    scope: 'store',
  })
  update(@Param('couponId', ParseUUIDPipe) couponId: string, @Body() body: unknown) {
    return this.coupons.updateCoupon(couponId, parseCouponInput(couponInputSchema, body));
  }

  @Delete(':couponId')
  @AuthAccess({
    access: 'admin',
    permission: 'promotions.coupons.delete',
    scope: 'store',
  })
  delete(@Param('couponId', ParseUUIDPipe) couponId: string) {
    return this.coupons.deleteCoupon(couponId);
  }
}
