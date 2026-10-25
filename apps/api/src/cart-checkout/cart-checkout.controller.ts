import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import {
  parseCartCheckoutInput,
  cartItemInputSchema,
  cartItemUpdateSchema,
  checkoutRequestSchema,
} from './cart-checkout.schemas';
import { CartCheckoutService } from './cart-checkout.service';

@Controller('storefront/carts')
@AuthAccess({ access: 'public' })
export class CartCheckoutController {
  constructor(
    @Inject(CartCheckoutService) private readonly cartCheckout: CartCheckoutService,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const customerId = typeof body === 'object' && body !== null && 'customerId' in body
      ? String(body.customerId)
      : undefined;
    return this.cartCheckout.createCart(customerId);
  }

  @Get(':cartId')
  async get(@Param('cartId', ParseUUIDPipe) cartId: string) {
    return this.cartCheckout.getCart(cartId);
  }

  @Post(':cartId/items')
  @HttpCode(HttpStatus.CREATED)
  async addItem(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Body() body: unknown,
  ) {
    return this.cartCheckout.addCartItem(
      cartId,
      parseCartCheckoutInput(cartItemInputSchema, body),
    );
  }

  @Patch(':cartId/items/:itemId')
  async updateItem(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: unknown,
  ) {
    return this.cartCheckout.updateCartItem(
      cartId,
      itemId,
      parseCartCheckoutInput(cartItemUpdateSchema, body),
    );
  }

  @Delete(':cartId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    await this.cartCheckout.removeCartItem(cartId, itemId);
  }

  @Post(':cartId/checkout')
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Param('cartId', ParseUUIDPipe) cartId: string,
    @Body() body: unknown,
  ) {
    return this.cartCheckout.checkout(
      cartId,
      parseCartCheckoutInput(checkoutRequestSchema, body),
    );
  }
}
