import { Prisma, PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensureGrants,
  parseBootstrapConfig,
  seedDatabase,
  SEEDED_ADMIN_PERMISSION_KEYS,
} from '../src/seed';
import { hasDatabase, resetDatabase, runMigrateCommand, runtimeUrl } from './helpers/database';

const describeDatabase = hasDatabase ? describe : describe.skip;

describe('seed bootstrap configuration', () => {
  it('skips bootstrap only when both credentials are absent', () => {
    expect(parseBootstrapConfig({})).toBeNull();
  });

  it('requires bootstrap credentials together', () => {
    expect(() => parseBootstrapConfig({ SEED_ADMIN_EMAIL: 'owner@example.com' })).toThrow(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured together.',
    );
    expect(() => parseBootstrapConfig({ SEED_ADMIN_PASSWORD: 'password' })).toThrow(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured together.',
    );
  });

  it('validates lowercase email and a non-empty password', () => {
    expect(() =>
      parseBootstrapConfig({
        SEED_ADMIN_EMAIL: 'Owner@example.com',
        SEED_ADMIN_PASSWORD: 'password',
      }),
    ).toThrow('SEED_ADMIN_EMAIL must be a valid lowercase email address.');
    expect(() =>
      parseBootstrapConfig({
        SEED_ADMIN_EMAIL: 'owner@example.com',
        SEED_ADMIN_PASSWORD: '',
      }),
    ).toThrow('SEED_ADMIN_PASSWORD must not be empty.');
  });

  it('uses the default display name when no name is provided', () => {
    expect(
      parseBootstrapConfig({
        SEED_ADMIN_EMAIL: 'owner@example.com',
        SEED_ADMIN_PASSWORD: 'password',
      }),
    ).toEqual({
      email: 'owner@example.com',
      password: 'password',
      displayName: 'Store Owner',
    });
  });
});

describe('admin role grant reconciliation', () => {
  it('translates legacy grants, replaces them only on baseline roles, and preserves custom grants', async () => {
    const legacyGrants = [
      { roleId: 'manager-id', permissionId: 'legacy-catalog-read' },
      { roleId: 'custom-role-id', permissionId: 'legacy-catalog-read' },
    ];
    const createdRows: Array<{ roleId: string; permissionId: string }> = [];
    const deletedRoleIds: string[] = [];
    const tx = {
      adminPermission: {
        findMany: vi.fn(async () => [{ id: 'legacy-catalog-read', key: 'catalog_read' }]),
      },
      adminRolePermission: {
        findMany: vi.fn(async () => legacyGrants),
        createMany: vi.fn(
          async ({ data }: { data: Array<{ roleId: string; permissionId: string }> }) => {
            createdRows.push(...data);
            return { count: data.length };
          },
        ),
        deleteMany: vi.fn(async ({ where }: { where: { roleId: string } }) => {
          deletedRoleIds.push(where.roleId);
          return { count: 1 };
        }),
      },
    } as unknown as Prisma.TransactionClient;
    const roleIds = new Map([
      ['owner', 'owner-id'],
      ['manager', 'manager-id'],
      ['staff', 'staff-id'],
      ['support', 'support-id'],
    ]);
    const permissionIds = new Map(
      SEEDED_ADMIN_PERMISSION_KEYS.map((key) => [key, `canonical-${key}`]),
    );

    await ensureGrants(tx, roleIds, permissionIds);

    expect(createdRows).toContainEqual({
      roleId: 'custom-role-id',
      permissionId: 'canonical-catalog.products.read',
    });
    expect(createdRows).toContainEqual({
      roleId: 'manager-id',
      permissionId: 'canonical-catalog.products.read',
    });
    expect(deletedRoleIds.sort()).toEqual(['manager-id', 'owner-id', 'staff-id', 'support-id']);
    expect(deletedRoleIds).not.toContain('custom-role-id');
  });
});

describeDatabase('database seed operation', () => {
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

  it('creates store roles, baseline permissions, and least-privilege grants', async () => {
    await seedDatabase(client, null);

    const seededRoles = await client.adminRole.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    expect(seededRoles.map(({ key, scope, isSystem }) => ({ key, scope, isSystem }))).toEqual([
      { key: 'owner', scope: 'store', isSystem: true },
      { key: 'manager', scope: 'store', isSystem: true },
      { key: 'staff', scope: 'store', isSystem: true },
      { key: 'support', scope: 'store', isSystem: true },
    ]);

    const grants = Object.fromEntries(
      seededRoles.map((role) => [
        role.key,
        new Set(role.permissions.map(({ permission }) => permission.key)),
      ]),
    );
    const ownerPermissions = grants.owner as Set<string>;
    expect(ownerPermissions.has('admin.roles.read')).toBe(true);
    expect(ownerPermissions.has('catalog.products.update')).toBe(true);
    expect(ownerPermissions.has('media.create')).toBe(true);
    expect(ownerPermissions.has('inventory.adjust')).toBe(true);
    expect(ownerPermissions.has('customers.read')).toBe(true);
    expect(ownerPermissions.has('analytics.read')).toBe(true);
    expect(ownerPermissions.size).toBe(await client.adminPermission.count());
    const managerPermissions = grants.manager as Set<string>;
    expect(managerPermissions.has('catalog.products.update')).toBe(true);
    expect(managerPermissions.has('inventory.adjust')).toBe(true);
    expect(managerPermissions.has('orders.status.update')).toBe(true);
    expect(managerPermissions.has('customers.read')).toBe(true);
    expect(managerPermissions.has('admin.roles.read')).toBe(true);
    expect(managerPermissions.has('orders_manage')).toBe(true);
    expect(managerPermissions.has('admin.roles.create')).toBe(false);
    expect(managerPermissions.has('admin.users.create')).toBe(false);
    expect(grants.staff).toEqual(
      new Set([
        'admin.auth.logout',
        'admin.auth.read',
        'catalog.brands.read',
        'catalog.categories.read',
        'catalog.products.read',
        'media.read',
        'inventory.read',
        'orders.read',
      ]),
    );
    expect(grants.support).toEqual(
      new Set(['admin.auth.logout', 'admin.auth.read', 'orders.read', 'customers.read']),
    );
    expect((grants.staff as Set<string>).has('orders.status.update')).toBe(false);
    expect((grants.support as Set<string>).has('orders.status.update')).toBe(false);
    expect(managerPermissions.has('settings.update')).toBe(true);
    expect(managerPermissions.has('admin.roles.delete')).toBe(false);
    expect(await client.adminRole.count({ where: { scope: 'platform' } })).toBe(0);
    expect(await client.adminUser.count()).toBe(0);
  });

  it('creates safe settings and inactive shipping-zone placeholders', async () => {
    await seedDatabase(client, null);

    expect(await client.storeSetting.findMany({ orderBy: { key: 'asc' } })).toMatchObject([
      { key: 'courier', value: { enabled: false } },
      { key: 'notifications', value: { email: { enabled: false }, sms: { enabled: false } } },
      { key: 'payments', value: { cod: { enabled: true }, online: { enabled: false } } },
      { key: 'tax', value: { enabled: false, rateBasisPoints: 0 } },
    ]);
    expect(
      await client.shippingZone.findMany({
        orderBy: { code: 'asc' },
        include: { districts: true },
      }),
    ).toMatchObject([
      {
        code: 'dhaka',
        deliveryFeePoisha: 0,
        isActive: false,
        districts: [],
      },
      {
        code: 'outside_dhaka',
        deliveryFeePoisha: 0,
        isActive: false,
        districts: [],
      },
    ]);
  });

  it('is idempotent and preserves configured settings and zones', async () => {
    await seedDatabase(client, null);
    await client.storeSetting.update({
      where: { key: 'tax' },
      data: { value: { enabled: true, rateBasisPoints: 500 } },
    });
    await client.shippingZone.update({
      where: { code: 'dhaka' },
      data: { deliveryFeePoisha: 6000, isActive: true },
    });

    await seedDatabase(client, null);

    expect(await client.adminRole.count()).toBe(4);
    expect(await client.adminPermission.count()).toBeGreaterThan(15);
    expect(await client.storeSetting.count()).toBe(4);
    expect(await client.shippingZone.count()).toBe(2);
    expect(await client.storeSetting.findUnique({ where: { key: 'tax' } })).toMatchObject({
      value: { enabled: true, rateBasisPoints: 500 },
    });

    expect(await client.shippingZone.findUnique({ where: { code: 'dhaka' } })).toMatchObject({
      deliveryFeePoisha: 6000,
      isActive: true,
    });
  });

  it('replaces legacy broad grants on baseline roles and translates custom-role grants', async () => {
    await seedDatabase(client, null);
    const legacyPermission = await client.adminPermission.create({
      data: { key: 'catalog_read', groupKey: 'catalog' },
    });
    const manager = await client.adminRole.findUniqueOrThrow({ where: { key: 'manager' } });
    const customRole = await client.adminRole.create({
      data: { key: 'custom-support', name: 'Custom support', scope: 'store' },
    });
    await client.adminRolePermission.createMany({
      data: [
        { roleId: manager.id, permissionId: legacyPermission.id },
        { roleId: customRole.id, permissionId: legacyPermission.id },
      ],
    });

    await seedDatabase(client, null);

    const updatedManager = await client.adminRole.findUniqueOrThrow({
      where: { key: 'manager' },
      include: { permissions: { include: { permission: true } } },
    });
    const retainedCustomRole = await client.adminRole.findUniqueOrThrow({
      where: { key: 'custom-support' },
      include: { permissions: { include: { permission: true } } },
    });
    expect(updatedManager.permissions.map(({ permission }) => permission.key)).not.toContain(
      'catalog_read',
    );
    expect(updatedManager.permissions.map(({ permission }) => permission.key)).toContain(
      'catalog.products.read',
    );
    expect(retainedCustomRole.permissions.map(({ permission }) => permission.key)).toContain(
      'catalog_read',
    );
    expect(retainedCustomRole.permissions.map(({ permission }) => permission.key)).toContain(
      'catalog.products.read',
    );
  });

  it('rejects incompatible baseline role records without committing partial defaults', async () => {
    await client.adminRole.create({
      data: { key: 'manager', name: 'Custom manager', scope: 'store', isSystem: false },
    });

    await expect(seedDatabase(client, null)).rejects.toThrow(
      'Baseline role "manager" exists with incompatible scope or system status.',
    );
    expect(await client.adminRole.count()).toBe(1);
    expect(await client.adminRole.count({ where: { key: 'owner' } })).toBe(0);
  });

  it('rejects incompatible permission groups and rolls back role creation', async () => {
    await client.adminPermission.create({
      data: { key: 'catalog.brands.read', groupKey: 'inventory' },
    });

    await expect(seedDatabase(client, null)).rejects.toThrow(
      'Baseline permission "catalog.brands.read" exists in incompatible group "inventory".',
    );
    expect(await client.adminRole.count()).toBe(0);
    expect(await client.adminPermission.count()).toBe(1);
  });

  it('creates only the first owner administrator with an Argon2id hash', async () => {
    const bootstrap = {
      email: 'owner@example.com',
      password: 'a secure bootstrap password',
      displayName: 'Primary Owner',
    };
    const result = await seedDatabase(client, bootstrap);

    expect(result.admin).toBe('created');
    const admin = await client.adminUser.findUnique({
      where: { email: bootstrap.email },
      include: { role: true },
    });
    expect(admin).toMatchObject({
      displayName: 'Primary Owner',
      status: 'active',
      role: { key: 'owner', scope: 'store' },
    });
    expect(admin?.passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(admin?.passwordHash).not.toContain(bootstrap.password);

    expect((await seedDatabase(client, bootstrap)).admin).toBe('skipped-existing-admin');
    expect(await client.adminUser.count()).toBe(1);
  });

  it('preserves any existing administrator during optional bootstrap', async () => {
    await seedDatabase(client, null);
    const owner = await client.adminRole.findUniqueOrThrow({ where: { key: 'owner' } });
    await client.adminUser.create({
      data: {
        roleId: owner.id,
        email: 'existing@example.com',
        passwordHash:
          'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        displayName: 'Existing Admin',
      },
    });

    const result = await seedDatabase(client, {
      email: 'replacement@example.com',
      password: 'replacement password',
      displayName: 'Replacement',
    });

    expect(result.admin).toBe('skipped-existing-admin');
    expect(await client.adminUser.findMany()).toMatchObject([
      {
        email: 'existing@example.com',
        passwordHash:
          'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        displayName: 'Existing Admin',
      },
    ]);
  });

  it('fails clearly when the required migrated schema is absent', async () => {
    await client.$disconnect();
    await resetDatabase();
    const emptyClient = new PrismaClient({ datasources: { db: { url: runtimeUrl! } } });
    try {
      await expect(seedDatabase(emptyClient, null)).rejects.toMatchObject({ code: 'P2021' });
    } finally {
      await emptyClient.$disconnect();
    }

    const migration = runMigrateCommand();
    expect(migration.status, migration.stderr).toBe(0);
  });
});
