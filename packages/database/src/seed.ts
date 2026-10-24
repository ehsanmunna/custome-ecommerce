import argon2 from 'argon2';
import { Prisma, PrismaClient } from '@prisma/client';

const roles = [
  { key: 'owner', name: 'Owner', sortOrder: 0 },
  { key: 'manager', name: 'Manager', sortOrder: 1 },
  { key: 'staff', name: 'Staff', sortOrder: 2 },
  { key: 'support', name: 'Support', sortOrder: 3 },
] as const;

const permissions = [
  { key: 'catalog_read', groupKey: 'catalog', description: 'View catalog records' },
  { key: 'catalog_manage', groupKey: 'catalog', description: 'Manage catalog records' },
  { key: 'inventory_read', groupKey: 'inventory', description: 'View inventory' },
  { key: 'inventory_manage', groupKey: 'inventory', description: 'Manage inventory' },
  { key: 'orders_read', groupKey: 'orders', description: 'View orders' },
  { key: 'orders_manage', groupKey: 'orders', description: 'Manage orders' },
  { key: 'orders_change_status', groupKey: 'orders', description: 'Change order status' },
  { key: 'customers_read', groupKey: 'customers', description: 'View customers' },
  { key: 'customers_manage', groupKey: 'customers', description: 'Manage customers' },
  { key: 'settings_read', groupKey: 'settings', description: 'View store settings' },
  { key: 'settings_manage', groupKey: 'settings', description: 'Manage store settings' },
  { key: 'roles_read', groupKey: 'roles', description: 'View roles and permissions' },
  { key: 'roles_manage', groupKey: 'roles', description: 'Manage roles and permissions' },
] as const;

const managerPermissionKeys = new Set([
  'catalog_read',
  'catalog_manage',
  'inventory_read',
  'inventory_manage',
  'orders_read',
  'orders_manage',
  'orders_change_status',
  'customers_read',
  'customers_manage',
  'settings_read',
  'roles_read',
]);
const staffPermissionKeys = new Set(['catalog_read', 'inventory_read', 'orders_read']);
const supportPermissionKeys = new Set(['orders_read', 'customers_read']);

const settingDefaults = [
  {
    key: 'tax',
    value: { enabled: false, rateBasisPoints: 0 },
  },
  {
    key: 'payments',
    value: { cod: { enabled: true }, online: { enabled: false } },
  },
  {
    key: 'courier',
    value: { enabled: false },
  },
  {
    key: 'notifications',
    value: { email: { enabled: false }, sms: { enabled: false } },
  },
] satisfies Array<{ key: string; value: Prisma.InputJsonObject }>;

const zoneDefaults = [
  { code: 'dhaka', name: 'Dhaka' },
  { code: 'outside_dhaka', name: 'Outside Dhaka' },
] as const;

export interface BootstrapConfig {
  email: string;
  password: string;
  displayName: string;
}

export function parseBootstrapConfig(env: NodeJS.ProcessEnv): BootstrapConfig | null {
  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;

  if (email === undefined && password === undefined) {
    return null;
  }
  if (email === undefined || password === undefined) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured together.');
  }
  if (
    email.length === 0 ||
    email !== email.trim() ||
    email !== email.toLowerCase() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error('SEED_ADMIN_EMAIL must be a valid lowercase email address.');
  }
  if (password.length === 0) {
    throw new Error('SEED_ADMIN_PASSWORD must not be empty.');
  }

  const displayName = env.SEED_ADMIN_DISPLAY_NAME ?? 'Store Owner';
  if (displayName.trim().length === 0) {
    throw new Error('SEED_ADMIN_DISPLAY_NAME must not be empty when configured.');
  }

  return { email, password, displayName: displayName.trim() };
}

function rolePermissionKeys(roleKey: (typeof roles)[number]['key']): Set<string> {
  switch (roleKey) {
    case 'owner':
      return new Set(permissions.map(({ key }) => key));
    case 'manager':
      return managerPermissionKeys;
    case 'staff':
      return staffPermissionKeys;
    case 'support':
      return supportPermissionKeys;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function ensureRoles(tx: Prisma.TransactionClient): Promise<Map<string, string>> {
  const roleIds = new Map<string, string>();

  for (const role of roles) {
    const existing = await tx.adminRole.findUnique({ where: { key: role.key } });
    if (existing) {
      if (existing.scope !== 'store' || !existing.isSystem) {
        throw new Error(
          `Baseline role "${role.key}" exists with incompatible scope or system status.`,
        );
      }
      roleIds.set(role.key, existing.id);
      continue;
    }

    try {
      const created = await tx.adminRole.create({
        data: { ...role, scope: 'store', isSystem: true },
      });
      roleIds.set(role.key, created.id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(`Baseline role "${role.key}" was concurrently created; rerun the seed.`);
      }
      throw error;
    }
  }

  return roleIds;
}

async function ensurePermissions(tx: Prisma.TransactionClient): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();

  for (const [index, permission] of permissions.entries()) {
    const existing = await tx.adminPermission.findUnique({ where: { key: permission.key } });
    if (existing) {
      if (existing.groupKey !== permission.groupKey) {
        throw new Error(
          `Baseline permission "${permission.key}" exists in incompatible group "${existing.groupKey}".`,
        );
      }
      permissionIds.set(permission.key, existing.id);
      continue;
    }

    try {
      const created = await tx.adminPermission.create({
        data: { ...permission, sortOrder: index },
      });
      permissionIds.set(permission.key, created.id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new Error(
          `Baseline permission "${permission.key}" was concurrently created; rerun the seed.`,
        );
      }
      throw error;
    }
  }

  return permissionIds;
}

async function ensureGrants(
  tx: Prisma.TransactionClient,
  roleIds: Map<string, string>,
  permissionIds: Map<string, string>,
): Promise<void> {
  for (const role of roles) {
    const roleId = roleIds.get(role.key);
    if (!roleId) {
      throw new Error(`Could not resolve baseline role "${role.key}".`);
    }

    const grantRows = [...rolePermissionKeys(role.key)].map((key) => {
      const permissionId = permissionIds.get(key);
      if (!permissionId) {
        throw new Error(`Could not resolve baseline permission "${key}".`);
      }
      return { roleId, permissionId };
    });

    await tx.adminRolePermission.createMany({ data: grantRows, skipDuplicates: true });
  }
}

async function ensureSettings(tx: Prisma.TransactionClient): Promise<void> {
  for (const setting of settingDefaults) {
    const existing = await tx.storeSetting.findUnique({ where: { key: setting.key } });
    if (!existing) {
      await tx.storeSetting.create({
        data: { key: setting.key, value: setting.value },
      });
    }
  }
}

async function ensureZones(tx: Prisma.TransactionClient): Promise<void> {
  for (const zone of zoneDefaults) {
    const existing = await tx.shippingZone.findUnique({ where: { code: zone.code } });
    if (!existing) {
      await tx.shippingZone.create({
        data: {
          ...zone,
          deliveryFeePoisha: 0,
          isActive: false,
        },
      });
    }
  }
}

async function ensureFirstAdmin(
  tx: Prisma.TransactionClient,
  roleIds: Map<string, string>,
  bootstrap: BootstrapConfig | null,
): Promise<'created' | 'skipped-no-credentials' | 'skipped-existing-admin'> {
  if (!bootstrap) {
    return 'skipped-no-credentials';
  }
  if (await tx.adminUser.findFirst({ select: { id: true } })) {
    return 'skipped-existing-admin';
  }

  const ownerRoleId = roleIds.get('owner');
  if (!ownerRoleId) {
    throw new Error('Could not resolve the owner role for administrator bootstrap.');
  }

  const passwordHash = await argon2.hash(bootstrap.password, { type: argon2.argon2id });
  await tx.adminUser.create({
    data: {
      roleId: ownerRoleId,
      email: bootstrap.email,
      passwordHash,
      displayName: bootstrap.displayName,
      status: 'active',
    },
  });
  return 'created';
}

export interface SeedResult {
  admin: 'created' | 'skipped-no-credentials' | 'skipped-existing-admin';
}

export async function seedDatabase(
  client: PrismaClient,
  bootstrap: BootstrapConfig | null,
): Promise<SeedResult> {
  try {
    return await client.$transaction(
      async (tx) => {
        const roleIds = await ensureRoles(tx);
        const permissionIds = await ensurePermissions(tx);
        await ensureGrants(tx, roleIds, permissionIds);
        await ensureSettings(tx);
        await ensureZones(tx);
        const admin = await ensureFirstAdmin(tx, roleIds, bootstrap);
        return { admin };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error('A seed record was concurrently created; rerun the seed command.');
    }
    throw error;
  }
}
