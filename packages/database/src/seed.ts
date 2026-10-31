import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const roles = [
  { key: 'owner', name: 'Owner', sortOrder: 0 },
  { key: 'manager', name: 'Manager', sortOrder: 1 },
  { key: 'staff', name: 'Staff', sortOrder: 2 },
  { key: 'support', name: 'Support', sortOrder: 3 },
] as const;

const permissions = [
  {
    key: 'admin.auth.logout',
    groupKey: 'admin-auth',
    description: 'End the current admin session',
  },
  {
    key: 'admin.auth.read',
    groupKey: 'admin-auth',
    description: 'Read the current admin identity',
  },
  { key: 'admin.users.read', groupKey: 'admin-users', description: 'View administrators' },
  { key: 'admin.users.create', groupKey: 'admin-users', description: 'Create administrators' },
  { key: 'admin.users.update', groupKey: 'admin-users', description: 'Update administrators' },
  { key: 'admin.users.delete', groupKey: 'admin-users', description: 'Delete administrators' },
  { key: 'admin.roles.read', groupKey: 'roles', description: 'View roles and permissions' },
  { key: 'admin.roles.create', groupKey: 'roles', description: 'Create roles' },
  { key: 'admin.roles.update', groupKey: 'roles', description: 'Update roles' },
  { key: 'admin.roles.delete', groupKey: 'roles', description: 'Delete roles' },
  { key: 'customers.read', groupKey: 'customers', description: 'View customer support records' },
  { key: 'catalog.brands.read', groupKey: 'catalog', description: 'View brands' },
  { key: 'catalog.brands.create', groupKey: 'catalog', description: 'Create brands' },
  { key: 'catalog.brands.update', groupKey: 'catalog', description: 'Update brands' },
  { key: 'catalog.brands.delete', groupKey: 'catalog', description: 'Delete brands' },
  { key: 'catalog.categories.read', groupKey: 'catalog', description: 'View categories' },
  { key: 'catalog.categories.create', groupKey: 'catalog', description: 'Create categories' },
  { key: 'catalog.categories.update', groupKey: 'catalog', description: 'Update categories' },
  { key: 'catalog.categories.delete', groupKey: 'catalog', description: 'Delete categories' },
  { key: 'catalog.products.read', groupKey: 'catalog', description: 'View products and variants' },
  { key: 'catalog.products.create', groupKey: 'catalog', description: 'Create products' },
  {
    key: 'catalog.products.update',
    groupKey: 'catalog',
    description: 'Update products and variants',
  },
  { key: 'catalog.products.delete', groupKey: 'catalog', description: 'Delete products' },
  { key: 'media.read', groupKey: 'media', description: 'View media assets' },
  { key: 'media.create', groupKey: 'media', description: 'Upload media assets' },
  { key: 'media.delete', groupKey: 'media', description: 'Delete media assets' },
  { key: 'inventory.read', groupKey: 'inventory', description: 'View inventory and reservations' },
  {
    key: 'inventory.adjust',
    groupKey: 'inventory',
    description: 'Adjust inventory and reservations',
  },
  { key: 'orders.read', groupKey: 'orders', description: 'View orders' },
  { key: 'orders.status.update', groupKey: 'orders', description: 'Change order status' },
  { key: 'orders.returns.read', groupKey: 'orders', description: 'View return requests' },
  { key: 'orders.returns.update', groupKey: 'orders', description: 'Update return requests' },
  { key: 'orders_manage', groupKey: 'orders', description: 'Create a shipping parcel' },
  { key: 'shipping.zones.read', groupKey: 'shipping', description: 'View shipping zones' },
  { key: 'shipping.zones.create', groupKey: 'shipping', description: 'Create shipping zones' },
  { key: 'shipping.zones.update', groupKey: 'shipping', description: 'Update shipping zones' },
  { key: 'shipping.zones.delete', groupKey: 'shipping', description: 'Delete shipping zones' },
  { key: 'shipping.shipments.read', groupKey: 'shipping', description: 'View shipments' },
  { key: 'shipping.shipments.create', groupKey: 'shipping', description: 'Create shipments' },
  { key: 'promotions.coupons.read', groupKey: 'promotions', description: 'View coupons' },
  { key: 'promotions.coupons.create', groupKey: 'promotions', description: 'Create coupons' },
  { key: 'promotions.coupons.update', groupKey: 'promotions', description: 'Update coupons' },
  { key: 'promotions.coupons.delete', groupKey: 'promotions', description: 'Delete coupons' },
  { key: 'settings.read', groupKey: 'settings', description: 'View store settings' },
  { key: 'settings.update', groupKey: 'settings', description: 'Update store settings' },
  { key: 'cms.pages.read', groupKey: 'cms', description: 'View CMS pages' },
  { key: 'cms.pages.create', groupKey: 'cms', description: 'Create CMS pages' },
  { key: 'cms.pages.update', groupKey: 'cms', description: 'Update CMS pages' },
  { key: 'cms.pages.delete', groupKey: 'cms', description: 'Delete CMS pages' },
  { key: 'cms.banners.read', groupKey: 'cms', description: 'View banners' },
  { key: 'cms.banners.create', groupKey: 'cms', description: 'Create banners' },
  { key: 'cms.banners.update', groupKey: 'cms', description: 'Update banners' },
  { key: 'cms.banners.delete', groupKey: 'cms', description: 'Delete banners' },
  { key: 'notifications.read', groupKey: 'notifications', description: 'View notifications' },
  { key: 'notifications.test', groupKey: 'notifications', description: 'Send test notifications' },
  { key: 'analytics.read', groupKey: 'analytics', description: 'View analytics' },
] as const;

export const SEEDED_ADMIN_PERMISSION_KEYS = permissions.map(({ key }) => key);

const authPermissionKeys = new Set(['admin.auth.logout', 'admin.auth.read']);
const permissionsFor = (...prefixes: string[]): Set<string> =>
  new Set(
    permissions
      .map(({ key }) => key)
      .filter((key) => prefixes.some((prefix) => key.startsWith(prefix))),
  );
const managerPermissionKeys = new Set([
  ...authPermissionKeys,
  ...permissionsFor(
    'catalog.',
    'media.',
    'inventory.',
    'orders.',
    'customers.',
    'settings.',
    'shipping.',
    'promotions.',
    'cms.',
    'notifications.',
    'analytics.',
  ),
  'orders_manage',
  'admin.roles.read',
]);
const staffPermissionKeys = new Set([
  ...authPermissionKeys,
  'catalog.brands.read',
  'catalog.categories.read',
  'catalog.products.read',
  'media.read',
  'inventory.read',
  'orders.read',
]);
const supportPermissionKeys = new Set([...authPermissionKeys, 'orders.read', 'customers.read']);
const legacyPermissionGrants: Record<string, string[]> = {
  catalog_read: ['catalog.brands.read', 'catalog.categories.read', 'catalog.products.read'],
  catalog_manage: [
    'catalog.brands.read',
    'catalog.brands.create',
    'catalog.brands.update',
    'catalog.brands.delete',
    'catalog.categories.read',
    'catalog.categories.create',
    'catalog.categories.update',
    'catalog.categories.delete',
    'catalog.products.read',
    'catalog.products.create',
    'catalog.products.update',
    'catalog.products.delete',
  ],
  media_read: ['media.read'],
  media_manage: ['media.read', 'media.create', 'media.delete'],
  inventory_read: ['inventory.read'],
  inventory_manage: ['inventory.read', 'inventory.adjust'],
  orders_read: ['orders.read'],
  orders_change_status: ['orders.read', 'orders.status.update'],
  customers_read: ['customers.read'],
  customers_manage: ['customers.read'],
  settings_read: ['settings.read'],
  settings_manage: ['settings.read', 'settings.update'],
  roles_read: ['admin.roles.read'],
  roles_manage: [
    'admin.roles.read',
    'admin.roles.create',
    'admin.roles.update',
    'admin.roles.delete',
  ],
};

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

export async function ensureGrants(
  tx: Prisma.TransactionClient,
  roleIds: Map<string, string>,
  permissionIds: Map<string, string>,
): Promise<void> {
  const legacyPermissions = await tx.adminPermission.findMany({
    where: { key: { in: Object.keys(legacyPermissionGrants) } },
    select: { id: true, key: true },
  });
  const legacyKeysById = new Map(legacyPermissions.map(({ id, key }) => [id, key]));
  const existingLegacyGrants = await tx.adminRolePermission.findMany({
    where: { permissionId: { in: legacyPermissions.map(({ id }) => id) } },
    select: { roleId: true, permissionId: true },
  });
  const translatedGrants = existingLegacyGrants.flatMap(({ roleId, permissionId }) => {
    const legacyKey = legacyKeysById.get(permissionId);
    if (!legacyKey) {
      return [];
    }

    return (legacyPermissionGrants[legacyKey] ?? []).map((key) => {
      const translatedPermissionId = permissionIds.get(key);
      if (!translatedPermissionId) {
        throw new Error(`Could not resolve migrated permission "${key}".`);
      }
      return { roleId, permissionId: translatedPermissionId };
    });
  });
  if (translatedGrants.length > 0) {
    await tx.adminRolePermission.createMany({ data: translatedGrants, skipDuplicates: true });
  }

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

    if (legacyPermissions.length > 0) {
      await tx.adminRolePermission.deleteMany({
        where: {
          roleId,
          permissionId: { in: legacyPermissions.map(({ id }) => id) },
        },
      });
    }
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

  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(bootstrap.password, salt, 64);
  const passwordHash = `${salt}:${derivedKey.toString('hex')}`;
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
