import {
  ADMIN_PERMISSIONS,
  permissionRequirementAll,
  permissionRequirementAny,
  type PermissionRequirement,
} from '../../core/auth/admin-permissions';

export interface AdminMenuItem extends PermissionRequirement {
  id: string;
  labelKey: string;
  icon: string;
  routerLink: string;
  children?: readonly AdminMenuItem[];
}

const P = ADMIN_PERMISSIONS;

const DASHBOARD_ACCESS = permissionRequirementAny(
  P.analytics.read,
  P.orders.read,
  P.inventory.read,
  P.customers.read,
);

const SETTINGS_ACCESS = permissionRequirementAny(
  P.settings.read,
  P.shipping.zones.read,
  P.promotions.coupons.read,
  P.users.read,
  P.roles.read,
  P.cms.pages.read,
  P.cms.banners.read,
  P.analytics.read,
  P.inventory.read,
);

export const ADMIN_MENU: readonly AdminMenuItem[] = [
  {
    id: 'dashboard',
    labelKey: 'menu.dashboard',
    icon: 'pi pi-home',
    routerLink: '/dashboard',
    ...DASHBOARD_ACCESS,
  },
  {
    id: 'products',
    labelKey: 'menu.products',
    icon: 'pi pi-box',
    routerLink: '/products',
    ...permissionRequirementAll(P.catalog.products.read),
    children: [
      {
        id: 'categories',
        labelKey: 'menu.categories',
        icon: 'pi pi-tags',
        routerLink: '/categories',
        ...permissionRequirementAll(P.catalog.categories.read),
      },
      {
        id: 'brands',
        labelKey: 'menu.brands',
        icon: 'pi pi-star',
        routerLink: '/brands',
        ...permissionRequirementAll(P.catalog.brands.read),
      },
      {
        id: 'attributes',
        labelKey: 'menu.attributes',
        icon: 'pi pi-list',
        routerLink: '/attributes',
        ...permissionRequirementAll(P.catalog.categories.read),
      },
      {
        id: 'media',
        labelKey: 'menu.media',
        icon: 'pi pi-images',
        routerLink: '/media',
        ...permissionRequirementAll(P.imageStorage.read),
      },
    ],
  },
  {
    id: 'orders',
    labelKey: 'menu.orders',
    icon: 'pi pi-shopping-cart',
    routerLink: '/orders',
    ...permissionRequirementAll(P.orders.read),
    children: [
      {
        id: 'returns',
        labelKey: 'menu.returns',
        icon: 'pi pi-replay',
        routerLink: '/returns',
        ...permissionRequirementAll(P.orders.returnsRead),
      },
    ],
  },
  {
    id: 'customers',
    labelKey: 'menu.customers',
    icon: 'pi pi-users',
    routerLink: '/customers',
    ...permissionRequirementAll(P.customers.read),
  },
  {
    id: 'inventory',
    labelKey: 'menu.inventory',
    icon: 'pi pi-warehouse',
    routerLink: '/inventory',
    ...permissionRequirementAll(P.inventory.read),
    children: [
      {
        id: 'adjust-stock',
        labelKey: 'menu.adjustStock',
        icon: 'pi pi-pencil',
        routerLink: '/inventory/adjust',
        ...permissionRequirementAll(P.inventory.adjust),
      },
      {
        id: 'reservations',
        labelKey: 'menu.reservations',
        icon: 'pi pi-calendar',
        routerLink: '/inventory/reservations',
        ...permissionRequirementAll(P.inventory.read),
      },
      {
        id: 'stock-movements',
        labelKey: 'menu.stockMovements',
        icon: 'pi pi-arrows-h',
        routerLink: '/inventory/movements',
        ...permissionRequirementAll(P.inventory.read),
      },
    ],
  },
  {
    id: 'settings',
    labelKey: 'menu.settings',
    icon: 'pi pi-cog',
    routerLink: '/settings',
    ...SETTINGS_ACCESS,
    children: [
      {
        id: 'shipping-zones',
        labelKey: 'menu.shippingZones',
        icon: 'pi pi-truck',
        routerLink: '/settings/shipping-zones',
        ...permissionRequirementAll(P.shipping.zones.read),
      },
      {
        id: 'coupons',
        labelKey: 'menu.coupons',
        icon: 'pi pi-ticket',
        routerLink: '/settings/coupons',
        ...permissionRequirementAll(P.promotions.coupons.read),
      },
      {
        id: 'users',
        labelKey: 'menu.users',
        icon: 'pi pi-user',
        routerLink: '/settings/users',
        ...permissionRequirementAll(P.users.read),
      },
      {
        id: 'roles',
        labelKey: 'menu.roles',
        icon: 'pi pi-shield',
        routerLink: '/settings/roles',
        ...permissionRequirementAll(P.roles.read),
      },
      {
        id: 'cms-pages',
        labelKey: 'menu.cmsPages',
        icon: 'pi pi-file',
        routerLink: '/cms/pages',
        ...permissionRequirementAll(P.cms.pages.read),
      },
      {
        id: 'cms-banners',
        labelKey: 'menu.cmsBanners',
        icon: 'pi pi-image',
        routerLink: '/cms/banners',
        ...permissionRequirementAll(P.cms.banners.read),
      },
      {
        id: 'sales-report',
        labelKey: 'menu.salesReport',
        icon: 'pi pi-chart-line',
        routerLink: '/reports/sales',
        ...permissionRequirementAll(P.analytics.read),
      },
      {
        id: 'low-stock-report',
        labelKey: 'menu.lowStockReport',
        icon: 'pi pi-exclamation-triangle',
        routerLink: '/reports/low-stock',
        ...permissionRequirementAll(P.inventory.read),
      },
    ],
  },
];
