import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { AUTH_ACCESS_METADATA } from '../src/auth/auth-access.decorator';
import { OrdersController } from '../src/orders/orders.controller';

const document = parse(readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, { 'x-required-permission'?: string }>>;
  'x-implemented-operations': string[];
};

const routeRequirements = [
  {
    method: 'get',
    path: '/admin/orders',
    permission: 'orders.read',
    handler: OrdersController.prototype.listOrders,
  },
  {
    method: 'get',
    path: '/admin/orders/{orderId}',
    permission: 'orders.read',
    handler: OrdersController.prototype.getOrder,
  },
  {
    method: 'patch',
    path: '/admin/orders/{orderId}/status',
    permission: 'orders.status.update',
    handler: OrdersController.prototype.updateOrderStatus,
  },
  {
    method: 'get',
    path: '/admin/returns',
    permission: 'orders.returns.read',
    handler: OrdersController.prototype.listReturns,
  },
  {
    method: 'patch',
    path: '/admin/returns/{returnId}/status',
    permission: 'orders.returns.update',
    handler: OrdersController.prototype.updateReturnStatus,
  },
] as const;

describe('order and return permission contract', () => {
  it('uses the exact contract permissions for every implemented route', () => {
    for (const route of routeRequirements) {
      expect(document.paths[route.path]?.[route.method]?.['x-required-permission']).toBe(
        route.permission,
      );
      expect(document['x-implemented-operations']).toContain(
        `${route.method.toUpperCase()} ${route.path}`,
      );
      expect(Reflect.getMetadata(AUTH_ACCESS_METADATA, route.handler)).toEqual({
        access: 'admin',
        permission: route.permission,
        scope: 'store',
      });
    }
  });
});
