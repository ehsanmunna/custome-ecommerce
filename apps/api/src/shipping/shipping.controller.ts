import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { ShippingService } from './shipping.service';
import {
  parseCreateParcelInput,
  parseShippingZoneInput,
  shippingZoneInputSchema,
  shippingZoneQuerySchema,
  districtsInputSchema,
} from './shipping.schemas';

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

  @Get('zones')
  @AuthAccess({
    access: 'admin',
    permission: 'shipping.zones.read',
    scope: 'store',
  })
  listZones(@Query() query: Record<string, unknown>) {
    return this.shipping.listShippingZones(parseShippingZoneInput(shippingZoneQuerySchema, query));
  }

  @Post('zones')
  @AuthAccess({
    access: 'admin',
    permission: 'shipping.zones.create',
    scope: 'store',
  })
  createZone(@Body() body: unknown) {
    return this.shipping.createShippingZone(parseShippingZoneInput(shippingZoneInputSchema, body));
  }

  @Patch('zones/:zoneId')
  @AuthAccess({
    access: 'admin',
    permission: 'shipping.zones.update',
    scope: 'store',
  })
  updateZone(@Param('zoneId', ParseUUIDPipe) zoneId: string, @Body() body: unknown) {
    return this.shipping.updateShippingZone(
      zoneId,
      parseShippingZoneInput(shippingZoneInputSchema, body),
    );
  }

  @Delete('zones/:zoneId')
  @AuthAccess({
    access: 'admin',
    permission: 'shipping.zones.delete',
    scope: 'store',
  })
  deleteZone(@Param('zoneId', ParseUUIDPipe) zoneId: string) {
    return this.shipping.deleteShippingZone(zoneId);
  }

  @Put('zones/:zoneId/districts')
  @AuthAccess({
    access: 'admin',
    permission: 'shipping.zones.update',
    scope: 'store',
  })
  setDistricts(@Param('zoneId', ParseUUIDPipe) zoneId: string, @Body() body: unknown) {
    const districts = parseShippingZoneInput(districtsInputSchema, body) as {
      districts: string[];
    };
    return this.shipping.setShippingZoneDistricts(zoneId, districts);
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
