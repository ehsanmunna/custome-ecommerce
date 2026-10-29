import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { AUTH_ACCESS_METADATA } from '../src/auth/auth-access.decorator';
import { InventoryController } from '../src/inventory/inventory.controller';
import { INVENTORY_PERMISSION_MAP } from '../src/inventory/inventory.permissions';

const document = parse(readFileSync(resolve(process.cwd(), 'openapi/openapi.yaml'), 'utf8')) as {
  paths: Record<string, Record<string, { 'x-required-permission'?: string }>>;
  'x-implemented-operations': string[];
};

const routeRequirements = [
  {
    method: 'get',
    path: '/admin/inventory',
    permission: 'inventory.read',
    handler: InventoryController.prototype.list,
  },
  {
    method: 'post',
    path: '/admin/inventory/{variantId}/adjustments',
    permission: 'inventory.adjust',
    handler: InventoryController.prototype.adjust,
  },
  {
    method: 'get',
    path: '/admin/inventory/reservations',
    permission: 'inventory.read',
    handler: InventoryController.prototype.reservations,
  },
  {
    method: 'post',
    path: '/admin/inventory/reservations',
    permission: 'inventory.adjust',
    handler: InventoryController.prototype.createReservation,
  },
  {
    method: 'patch',
    path: '/admin/inventory/reservations/{reservationId}/status',
    permission: 'inventory.adjust',
    handler: InventoryController.prototype.updateReservationStatus,
  },
] as const;

describe('inventory permission mapping', () => {
  it('maps contract permissions to persisted role permissions on every route', () => {
    for (const route of routeRequirements) {
      const operation = document.paths[route.path]?.[route.method];
      expect(operation?.['x-required-permission']).toBe(route.permission);
      expect(document['x-implemented-operations']).toContain(
        `${route.method.toUpperCase()} ${route.path}`,
      );

      const requirement = Reflect.getMetadata(AUTH_ACCESS_METADATA, route.handler);
      expect(requirement).toEqual({
        access: 'admin',
        permission: INVENTORY_PERMISSION_MAP[route.permission],
        scope: 'store',
      });
    }

    expect(INVENTORY_PERMISSION_MAP).toEqual({
      'inventory.read': 'inventory_read',
      'inventory.adjust': 'inventory_manage',
    });
  });
});
