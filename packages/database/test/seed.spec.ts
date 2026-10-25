import { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBootstrapConfig, seedDatabase } from '../src/seed';
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
    expect(ownerPermissions.size).toBe(15);
    expect(ownerPermissions.has('media_read')).toBe(true);
    expect(ownerPermissions.has('media_manage')).toBe(true);
    expect(grants.manager).toEqual(
      new Set([
        'catalog_read',
        'catalog_manage',
        'media_read',
        'media_manage',
        'inventory_read',
        'inventory_manage',
        'orders_read',
        'orders_manage',
        'orders_change_status',
        'customers_read',
        'customers_manage',
        'settings_read',
        'roles_read',
      ]),
    );
    expect(grants.staff).toEqual(
      new Set(['catalog_read', 'media_read', 'inventory_read', 'orders_read']),
    );
    expect(grants.support).toEqual(new Set(['orders_read', 'customers_read']));
    expect((grants.staff as Set<string>).has('orders_change_status')).toBe(false);
    expect((grants.support as Set<string>).has('orders_change_status')).toBe(false);
    expect((grants.manager as Set<string>).has('settings_manage')).toBe(false);
    expect((grants.manager as Set<string>).has('roles_manage')).toBe(false);
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
    expect(await client.adminPermission.count()).toBe(15);
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
      data: { key: 'catalog_read', groupKey: 'inventory' },
    });

    await expect(seedDatabase(client, null)).rejects.toThrow(
      'Baseline permission "catalog_read" exists in incompatible group "inventory".',
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
    expect(admin?.passwordHash.startsWith('$argon2id$')).toBe(true);
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
        passwordHash: '$argon2id$existing-hash',
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
        passwordHash: '$argon2id$existing-hash',
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
