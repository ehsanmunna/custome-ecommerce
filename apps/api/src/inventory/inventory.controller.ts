import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { INVENTORY_PERMISSION_MAP } from './inventory.permissions';
import {
  inventoryAdjustmentSchema,
  inventoryQuerySchema,
  parseInventoryInput,
  reservationInputSchema,
  reservationQuerySchema,
  reservationStatusSchema,
} from './inventory.schemas';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory: InventoryService) {}

  @Get()
  @AuthAccess({
    access: 'admin',
    permission: INVENTORY_PERMISSION_MAP['inventory.read'],
    scope: 'store',
  })
  list(@Query() query: Record<string, unknown>) {
    return this.inventory.listInventory(parseInventoryInput(inventoryQuerySchema, query));
  }

  @Post(':variantId/adjustments')
  @AuthAccess({
    access: 'admin',
    permission: INVENTORY_PERMISSION_MAP['inventory.adjust'],
    scope: 'store',
  })
  adjust(@Param('variantId', ParseUUIDPipe) variantId: string, @Body() body: unknown) {
    return this.inventory.adjustInventory(
      variantId,
      parseInventoryInput(inventoryAdjustmentSchema, body),
    );
  }

  @Get('reservations')
  @AuthAccess({
    access: 'admin',
    permission: INVENTORY_PERMISSION_MAP['inventory.read'],
    scope: 'store',
  })
  reservations(@Query() query: Record<string, unknown>) {
    return this.inventory.listReservations(parseInventoryInput(reservationQuerySchema, query));
  }

  @Post('reservations')
  @AuthAccess({
    access: 'admin',
    permission: INVENTORY_PERMISSION_MAP['inventory.adjust'],
    scope: 'store',
  })
  createReservation(@Body() body: unknown) {
    return this.inventory.createReservation(parseInventoryInput(reservationInputSchema, body));
  }

  @Patch('reservations/:reservationId/status')
  @AuthAccess({
    access: 'admin',
    permission: INVENTORY_PERMISSION_MAP['inventory.adjust'],
    scope: 'store',
  })
  updateReservationStatus(
    @Param('reservationId', ParseUUIDPipe) reservationId: string,
    @Body() body: unknown,
  ) {
    return this.inventory.updateReservationStatus(
      reservationId,
      parseInventoryInput(reservationStatusSchema, body),
    );
  }
}
