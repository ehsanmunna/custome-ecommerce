import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  Body,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  adminOrderQuerySchema,
  adminReturnQuerySchema,
  orderStatusUpdateSchema,
  parseOrderInput,
  returnStatusUpdateSchema,
} from './orders.schemas';
import { OrdersService } from './orders.service';
import type { AdminOrderResponse, AdminPage, AdminReturnResponse } from './orders.service';

@Controller('admin')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get('orders')
  @AuthAccess({ access: 'admin', permission: 'orders.read', scope: 'store' })
  listOrders(@Query() query: Record<string, unknown>): Promise<AdminPage<AdminOrderResponse>> {
    return this.orders.listOrders(parseOrderInput(adminOrderQuerySchema, query));
  }

  @Get('orders/:orderId')
  @AuthAccess({ access: 'admin', permission: 'orders.read', scope: 'store' })
  getOrder(@Param('orderId', ParseUUIDPipe) orderId: string): Promise<AdminOrderResponse> {
    return this.orders.getOrder(orderId);
  }

  @Patch('orders/:orderId/status')
  @AuthAccess({ access: 'admin', permission: 'orders.status.update', scope: 'store' })
  updateOrderStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminOrderResponse> {
    return this.orders.updateOrderStatus(
      orderId,
      parseOrderInput(orderStatusUpdateSchema, body),
      this.adminId(request),
    );
  }

  @Get('returns')
  @AuthAccess({ access: 'admin', permission: 'orders.returns.read', scope: 'store' })
  listReturns(@Query() query: Record<string, unknown>): Promise<AdminPage<AdminReturnResponse>> {
    return this.orders.listReturns(parseOrderInput(adminReturnQuerySchema, query));
  }

  @Patch('returns/:returnId/status')
  @AuthAccess({ access: 'admin', permission: 'orders.returns.update', scope: 'store' })
  updateReturnStatus(
    @Param('returnId', ParseUUIDPipe) returnId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminReturnResponse> {
    return this.orders.updateReturnStatus(
      returnId,
      parseOrderInput(returnStatusUpdateSchema, body),
      this.adminId(request),
    );
  }

  private adminId(request: AuthenticatedRequest): string {
    if (request.auth?.identityType !== 'admin') {
      throw new UnauthorizedException('An authenticated administrator is required');
    }
    return request.auth.subjectId;
  }
}
