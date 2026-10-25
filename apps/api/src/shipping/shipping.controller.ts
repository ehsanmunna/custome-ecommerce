import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { ShippingService } from './shipping.service';
import { parseCreateParcelInput } from './shipping.schemas';

export interface RawBodyRequest {
  headers: { [key: string]: string | string[] | undefined };
  [Symbol.asyncIterator](): AsyncIterableIterator<Buffer | string>;
}

@Controller('admin/shipping')
export class ShippingController {
  constructor(@Inject(ShippingService) private readonly shipping: ShippingService) {}

  @Post('parcels')
  @AuthAccess({
    access: 'admin',
    permission: 'orders_manage',
    scope: 'store',
  })
  async createParcel(@Body() body: unknown) {
    return this.shipping.createParcel(parseCreateParcelInput(body));
  }
}

@Controller('webhooks/shipping/steadfast')
export class SteadfastWebhookController {
  constructor(@Inject(ShippingService) private readonly shipping: ShippingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Header('content-type', 'application/json')
  async handleWebhook(@Req() request: RawBodyRequest) {
    const rawChunks: Buffer[] = [];
    for await (const chunk of request) {
      rawChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawPayload = Buffer.concat(rawChunks);
    const signature = request.headers['x-steadfast-signature'] as string | undefined;

    return this.shipping.handleSteadfastWebhook(rawPayload, signature);
  }
}
