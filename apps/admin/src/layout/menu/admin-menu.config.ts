export interface AdminMenuItem {
  id: string;
  labelKey: string;
  icon: string;
  routerLink: string;
  roles: readonly string[];
  children?: readonly AdminMenuItem[];
}

const ALL_ROLES = ['owner', 'manager', 'staff', 'support'];
const CATALOG_ROLES = ['owner', 'manager', 'staff'];
const ORDER_ROLES = ['owner', 'manager', 'staff', 'support'];
const CUSTOMER_ROLES = ['owner', 'manager', 'support'];
const INVENTORY_ROLES = ['owner', 'manager', 'staff'];
const MANAGER_ROLES = ['owner', 'manager'];

export const ADMIN_MENU: readonly AdminMenuItem[] = [
  {
    id: 'dashboard',
    labelKey: 'menu.dashboard',
    icon: 'pi pi-home',
    routerLink: '/dashboard',
    roles: ALL_ROLES,
  },
  {
    id: 'products',
    labelKey: 'menu.products',
    icon: 'pi pi-box',
    routerLink: '/products',
    roles: CATALOG_ROLES,
    children: [
      {
        id: 'categories',
        labelKey: 'menu.categories',
        icon: 'pi pi-tags',
        routerLink: '/categories',
        roles: CATALOG_ROLES,
      },
      {
        id: 'brands',
        labelKey: 'menu.brands',
        icon: 'pi pi-star',
        routerLink: '/brands',
        roles: CATALOG_ROLES,
      },
      {
        id: 'attributes',
        labelKey: 'menu.attributes',
        icon: 'pi pi-list',
        routerLink: '/attributes',
        roles: CATALOG_ROLES,
      },
      {
        id: 'media',
        labelKey: 'menu.media',
        icon: 'pi pi-images',
        routerLink: '/media',
        roles: CATALOG_ROLES,
      },
    ],
  },
  {
    id: 'orders',
    labelKey: 'menu.orders',
    icon: 'pi pi-shopping-cart',
    routerLink: '/orders',
    roles: ORDER_ROLES,
    children: [
      {
        id: 'returns',
        labelKey: 'menu.returns',
        icon: 'pi pi-replay',
        routerLink: '/returns',
        roles: MANAGER_ROLES,
      },
    ],
  },
  {
    id: 'customers',
    labelKey: 'menu.customers',
    icon: 'pi pi-users',
    routerLink: '/customers',
    roles: CUSTOMER_ROLES,
  },
  {
    id: 'inventory',
    labelKey: 'menu.inventory',
    icon: 'pi pi-warehouse',
    routerLink: '/inventory',
    roles: INVENTORY_ROLES,
    children: [
      {
        id: 'adjust-stock',
        labelKey: 'menu.adjustStock',
        icon: 'pi pi-pencil',
        routerLink: '/inventory/adjust',
        roles: MANAGER_ROLES,
      },
      {
        id: 'reservations',
        labelKey: 'menu.reservations',
        icon: 'pi pi-calendar',
        routerLink: '/inventory/reservations',
        roles: INVENTORY_ROLES,
      },
      {
        id: 'stock-movements',
        labelKey: 'menu.stockMovements',
        icon: 'pi pi-arrows-h',
        routerLink: '/inventory/movements',
        roles: INVENTORY_ROLES,
      },
    ],
  },
  {
    id: 'settings',
    labelKey: 'menu.settings',
    icon: 'pi pi-cog',
    routerLink: '/settings',
    roles: MANAGER_ROLES,
    children: [
      {
        id: 'shipping-zones',
        labelKey: 'menu.shippingZones',
        icon: 'pi pi-truck',
        routerLink: '/settings/shipping-zones',
        roles: MANAGER_ROLES,
      },
  {
    id: 'coupons',
    labelKey: 'menu.coupons',
    icon: 'pi pi-ticket',
    routerLink: '/settings/coupons',
    roles: MANAGER_ROLES,
  },
  {
    id: 'users',
    labelKey: 'menu.users',
    icon: 'pi pi-user',
    routerLink: '/settings/users',
    roles: MANAGER_ROLES,
  },
  {
    id: 'roles',
    labelKey: 'menu.roles',
    icon: 'pi pi-shield',
    routerLink: '/settings/roles',
    roles: MANAGER_ROLES,
  },
  {
    id: 'cms-pages',
        labelKey: 'menu.cmsPages',
        icon: 'pi pi-file',
        routerLink: '/cms/pages',
        roles: MANAGER_ROLES,
      },
      {
        id: 'cms-banners',
        labelKey: 'menu.cmsBanners',
        icon: 'pi pi-image',
        routerLink: '/cms/banners',
        roles: MANAGER_ROLES,
      },
      {
        id: 'sales-report',
        labelKey: 'menu.salesReport',
        icon: 'pi pi-chart-line',
        routerLink: '/reports/sales',
        roles: MANAGER_ROLES,
      },
      {
        id: 'low-stock-report',
        labelKey: 'menu.lowStockReport',
        icon: 'pi pi-exclamation-triangle',
        routerLink: '/reports/low-stock',
        roles: INVENTORY_ROLES,
      },
    ],
  },
];
