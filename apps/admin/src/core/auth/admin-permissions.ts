export const ADMIN_PERMISSIONS = {
  auth: {
    logout: 'admin.auth.logout',
    read: 'admin.auth.read',
  },
  users: {
    read: 'admin.users.read',
    create: 'admin.users.create',
    update: 'admin.users.update',
    disable: 'admin.users.disable',
  },
  roles: {
    read: 'admin.roles.read',
    create: 'admin.roles.create',
    update: 'admin.roles.update',
    delete: 'admin.roles.delete',
  },
  customers: {
    read: 'customers.read',
  },
  catalog: {
    brands: {
      read: 'catalog.brands.read',
      create: 'catalog.brands.create',
      update: 'catalog.brands.update',
      delete: 'catalog.brands.delete',
    },
    categories: {
      read: 'catalog.categories.read',
      create: 'catalog.categories.create',
      update: 'catalog.categories.update',
      delete: 'catalog.categories.delete',
    },
    products: {
      read: 'catalog.products.read',
      create: 'catalog.products.create',
      update: 'catalog.products.update',
      delete: 'catalog.products.delete',
    },
  },
  imageStorage: {
    read: 'image-storage.read',
  },
  media: {
    create: 'media.create',
    delete: 'media.delete',
  },
  inventory: {
    read: 'inventory.read',
    adjust: 'inventory.adjust',
  },
  orders: {
    read: 'orders.read',
    statusUpdate: 'orders.status.update',
    returnsRead: 'orders.returns.read',
    returnsUpdate: 'orders.returns.update',
    manage: 'orders_manage',
  },
  shipping: {
    zones: {
      read: 'shipping.zones.read',
      create: 'shipping.zones.create',
      update: 'shipping.zones.update',
      delete: 'shipping.zones.delete',
    },
  },
  promotions: {
    coupons: {
      read: 'promotions.coupons.read',
      create: 'promotions.coupons.create',
      update: 'promotions.coupons.update',
      delete: 'promotions.coupons.delete',
    },
  },
  settings: {
    read: 'settings.read',
    update: 'settings.update',
  },
  cms: {
    pages: {
      read: 'cms.pages.read',
      create: 'cms.pages.create',
      update: 'cms.pages.update',
      delete: 'cms.pages.delete',
    },
    banners: {
      read: 'cms.banners.read',
      create: 'cms.banners.create',
      update: 'cms.banners.update',
      delete: 'cms.banners.delete',
    },
  },
  notifications: {
    read: 'notifications.read',
    test: 'notifications.test',
  },
  analytics: {
    read: 'analytics.read',
  },
} as const;

type PermissionTree = { readonly [key: string]: string | PermissionTree };

function collectPermissionKeys(tree: PermissionTree): string[] {
  return Object.values(tree).flatMap((value) =>
    typeof value === 'string' ? [value] : collectPermissionKeys(value),
  );
}

export const ADMIN_PERMISSION_KEYS: readonly string[] = [
  ...new Set(collectPermissionKeys(ADMIN_PERMISSIONS)),
];

export type PermissionMode = 'all' | 'any';

export interface PermissionRequirement {
  permissions: readonly string[];
  permissionMode: PermissionMode;
}

export function permissionRequirementAll(...permissions: string[]): PermissionRequirement {
  return { permissions, permissionMode: 'all' };
}

export function permissionRequirementAny(...permissions: string[]): PermissionRequirement {
  return { permissions, permissionMode: 'any' };
}
