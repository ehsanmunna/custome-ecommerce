import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedDatabase, SEEDED_ADMIN_PERMISSION_KEYS } from '../src/seed';
import {
  hasDatabase,
  resetDatabase,
  runMigrateCommand,
  runtimeUrl,
  withClient,
  migrationUrl,
} from './helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

const RECONCILIATION_SQL = readFileSync(
  join(
    process.cwd(),
    'prisma',
    'migrations',
    '20261115000000_permission_catalog_reconciliation',
    'migration.sql',
  ),
  'utf8',
);

const AUTH_KEYS = ['admin.auth.logout', 'admin.auth.read'];
const OPERATIONAL_PREFIXES =
  /^(catalog|media|inventory|orders|customers|settings|shipping|promotions|cms|notifications|analytics)\./;

const expectedManagerKeys = [
  ...AUTH_KEYS,
  ...SEEDED_ADMIN_PERMISSION_KEYS.filter((key) => OPERATIONAL_PREFIXES.test(key)),
  'orders_manage',
  'admin.roles.read',
  'image-storage.read',
].sort();

const expectedStaffKeys = [
  ...AUTH_KEYS,
  'catalog.brands.read',
  'catalog.categories.read',
  'catalog.products.read',
  'image-storage.read',
  'inventory.read',
  'orders.read',
].sort();

const expectedSupportKeys = [...AUTH_KEYS, 'orders.read', 'customers.read'].sort();

const grantsByRole = async (
  client: PrismaClient,
): Promise<Record<string, string[]>> => {
  const roles = await client.adminRole.findMany({
    include: { permissions: { include: { permission: true } } },
  });
  return Object.fromEntries(
    roles.map((role) => [
      role.key,
      role.permissions.map(({ permission }) => permission.key).sort(),
    ]),
  );
};

const createCustomRole = async (
  client: PrismaClient,
  permissions: string[],
  key = 'custom_support',
): Promise<void> => {
  await client.adminRole.create({
    data: {
      key,
      name: `Custom ${key}`,
      scope: 'store',
      isSystem: false,
      permissions: {
        create: permissions.map((permissionKey) => ({
          permission: { connect: { key: permissionKey } },
        })),
      },
    },
  });
};

describeDatabase('permission matrix', () => {
  let client: PrismaClient;

  beforeEach(async () => {
    await resetDatabase();
    const migration = runMigrateCommand();
    expect(migration.status, migration.stderr).toBe(0);
    if (!runtimeUrl) {
      throw new Error('DATABASE_URL is required for database integration tests');
    }
    client = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
  });

  afterEach(async () => {
    await client?.$disconnect();
  });

  it('grants exactly the baseline matrix on a freshly seeded database', async () => {
    await seedDatabase(client, null);

    const grants = await grantsByRole(client);

    expect(grants.owner).toEqual([...SEEDED_ADMIN_PERMISSION_KEYS].sort());
    expect(grants.manager).toEqual(expectedManagerKeys);
    expect(grants.staff).toEqual(expectedStaffKeys);
    expect(grants.support).toEqual(expectedSupportKeys);

    expect(grants.owner).toContain('admin.users.disable');
    expect(grants.manager).not.toContain('admin.users.disable');
    expect(grants.manager).not.toContain('admin.users.create');
    expect(grants.manager).not.toContain('admin.roles.update');
    expect(grants.staff).not.toContain('media.create');
    expect(grants.support).not.toContain('image-storage.read');
  });

  it('keeps a custom role independent of the baseline role keys', async () => {
    await seedDatabase(client, null);
    await createCustomRole(client, [
      'admin.auth.logout',
      'admin.auth.read',
      'orders.read',
      'orders.status.update',
      'customers.read',
      'image-storage.read',
    ]);

    const grants = await grantsByRole(client);

    expect(grants.custom_support).toEqual(
      [
        'admin.auth.logout',
        'admin.auth.read',
        'customers.read',
        'image-storage.read',
        'orders.read',
        'orders.status.update',
      ].sort(),
    );
    expect(grants.custom_support).not.toContain('admin.roles.read');
    expect(grants.custom_support).not.toContain('catalog.products.read');
  });

  it('reconciles a drifted legacy database and translates legacy grants', async () => {
    await seedDatabase(client, null);
    await createCustomRole(client, ['admin.auth.read'], 'custom_media_manager');

    await withClient(migrationUrl as string, async (pg) => {
      await pg.query(`
        INSERT INTO "admin_permissions" ("key", "group_key", "description")
        VALUES
          ('media.read', 'media', 'View media assets'),
          ('admin.users.delete', 'admin-users', 'Delete administrators'),
          ('shipping.shipments.read', 'shipping', 'View shipments'),
          ('shipping.shipments.create', 'shipping', 'Create shipments'),
          ('media_read', 'media', 'Legacy read media'),
          ('media_manage', 'media', 'Legacy manage media'),
          ('orders_change_status', 'orders', 'Legacy change order status')
        ON CONFLICT ("key") DO NOTHING;
      `);

      await pg.query(`
        INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
        SELECT role_row."id", permission_row."id"
        FROM "admin_roles" AS role_row
        CROSS JOIN "admin_permissions" AS permission_row
        WHERE permission_row."key" IN (
          'media.read',
          'admin.users.delete',
          'shipping.shipments.read',
          'shipping.shipments.create'
        )
          AND role_row."key" IN ('owner', 'manager', 'staff', 'custom_media_manager')
        ON CONFLICT DO NOTHING;
      `);

      await pg.query(`
        INSERT INTO "admin_role_permissions" ("role_id", "permission_id")
        SELECT role_row."id", permission_row."id"
        FROM "admin_roles" AS role_row
        CROSS JOIN "admin_permissions" AS permission_row
        WHERE permission_row."key" IN ('media_read', 'media_manage', 'orders_change_status')
          AND role_row."key" = 'custom_media_manager'
        ON CONFLICT DO NOTHING;
      `);

      await pg.query(`
        DELETE FROM "admin_role_permissions" AS grant_row
        USING "admin_permissions" AS permission_row
        WHERE grant_row."permission_id" = permission_row."id"
          AND permission_row."key" = 'image-storage.read'
          AND grant_row."role_id" IN (
            SELECT "id" FROM "admin_roles" WHERE "key" IN ('owner', 'manager', 'staff')
          );
      `);
    });

    await withClient(migrationUrl as string, async (pg) => {
      await pg.query(RECONCILIATION_SQL);
    });

    const permissionKeys = (await client.adminPermission.findMany()).map(({ key }) => key);
    expect(permissionKeys).not.toContain('media.read');
    expect(permissionKeys).not.toContain('admin.users.delete');
    expect(permissionKeys).not.toContain('shipping.shipments.read');
    expect(permissionKeys).not.toContain('shipping.shipments.create');
    expect(permissionKeys).toContain('image-storage.read');
    expect(permissionKeys).toContain('admin.users.disable');

    const reconciled = await grantsByRole(client);
    for (const role of ['owner', 'manager', 'staff']) {
      expect(reconciled[role]).toContain('image-storage.read');
    }
    expect(reconciled.owner).toContain('admin.users.disable');
    expect(reconciled.custom_media_manager).toEqual(
      expect.arrayContaining([
        'admin.auth.read',
        'image-storage.read',
        'media.create',
        'media.delete',
        'orders.read',
        'orders.status.update',
      ]),
    );
    // The reconciliation migration keeps the legacy rows in place.
    expect(reconciled.custom_media_manager).toEqual(
      expect.arrayContaining(['media_read', 'media_manage', 'orders_change_status']),
    );

    await seedDatabase(client, null);

    const reseeded = await grantsByRole(client);
    expect(reseeded.owner).toEqual([...SEEDED_ADMIN_PERMISSION_KEYS].sort());
    expect(reseeded.manager).toEqual(expectedManagerKeys);
    expect(reseeded.staff).toEqual(expectedStaffKeys);
    expect(reseeded.support).toEqual(expectedSupportKeys);
    expect(reseeded.custom_media_manager).toEqual(
      expect.arrayContaining([
        'admin.auth.read',
        'image-storage.read',
        'media.create',
        'media.delete',
        'orders.read',
        'orders.status.update',
      ]),
    );
  });
});
