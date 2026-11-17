import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { LogoutComponent } from './auth/logout.component';
import { ForbiddenComponent } from './auth/forbidden.component';
import { authGuard } from './auth/auth.guard';
import {
  ADMIN_PERMISSIONS,
  permissionRequirementAll,
  permissionRequirementAny,
} from './core/auth/admin-permissions';
import { permissionGuard } from './core/auth/permission.guard';
import { ProductListComponent } from './catalog/product-list.component';
import { CategoryListComponent } from './catalog/category-list.component';
import { BrandListComponent } from './catalog/brand-list.component';
import { AttributeListComponent } from './catalog/attribute-list.component';
import { VariantListComponent } from './catalog/variant-list.component';
import { MediaListComponent } from './catalog/media-list.component';
import { InventoryListComponent } from './inventory/inventory-list.component';
import { InventoryAdjustmentComponent } from './inventory/inventory-adjustment.component';
import { InventoryReservationComponent } from './inventory/inventory-reservation.component';
import { StockMovementsComponent } from './inventory/stock-movements.component';
import { OrderListComponent } from './orders/order-list.component';
import { OrderDetailComponent } from './orders/order-detail.component';
import { OrderStatusComponent } from './orders/order-status.component';
import { ReturnListComponent } from './returns/return-list.component';
import { ReturnStatusComponent } from './returns/return-status.component';
import { ShippingZoneListComponent } from './settings/shipping-zone-list.component';
import { CouponListComponent } from './settings/coupon-list.component';
import { AdminUsersListComponent } from './users/admin-users-list.component';
import { AdminRolesListComponent } from './roles/admin-roles-list.component';
import { PageListComponent } from './cms/page-list.component';
import { BannerListComponent } from './cms/banner-list.component';
import { SalesMetricsComponent } from './reporting/sales-metrics.component';
import { LowStockIndicatorsComponent } from './reporting/low-stock-indicators.component';
import { AdminShellComponent } from './layout/shell/admin-shell.component';

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

// Navigation labels, icons, and ordering live in
// `layout/menu/admin-menu.config.ts`. Every protected route declares the same
// permission requirement that `permissionGuard` enforces at navigation time.
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'forbidden', component: ForbiddenComponent },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: DASHBOARD_ACCESS,
        canActivate: [permissionGuard],
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'customers',
        data: permissionRequirementAll(P.customers.read),
        canActivate: [permissionGuard],
        loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent),
      },
      { path: 'products', component: ProductListComponent, data: permissionRequirementAll(P.catalog.products.read), canActivate: [permissionGuard] },
      { path: 'categories', component: CategoryListComponent, data: permissionRequirementAll(P.catalog.categories.read), canActivate: [permissionGuard] },
      { path: 'brands', component: BrandListComponent, data: permissionRequirementAll(P.catalog.brands.read), canActivate: [permissionGuard] },
      { path: 'attributes', component: AttributeListComponent, data: permissionRequirementAll(P.catalog.categories.read), canActivate: [permissionGuard] },
      { path: 'products/:productId/variants', component: VariantListComponent, data: permissionRequirementAll(P.catalog.products.read), canActivate: [permissionGuard] },
      { path: 'media', component: MediaListComponent, data: permissionRequirementAll(P.imageStorage.read), canActivate: [permissionGuard] },
      { path: 'inventory', component: InventoryListComponent, data: permissionRequirementAll(P.inventory.read), canActivate: [permissionGuard] },
      { path: 'inventory/adjust', component: InventoryAdjustmentComponent, data: permissionRequirementAll(P.inventory.adjust), canActivate: [permissionGuard] },
      { path: 'inventory/reservations', component: InventoryReservationComponent, data: permissionRequirementAll(P.inventory.read), canActivate: [permissionGuard] },
      { path: 'inventory/movements', component: StockMovementsComponent, data: permissionRequirementAll(P.inventory.read), canActivate: [permissionGuard] },
      { path: 'orders', component: OrderListComponent, data: permissionRequirementAll(P.orders.read), canActivate: [permissionGuard] },
      { path: 'orders/:orderId', component: OrderDetailComponent, data: permissionRequirementAll(P.orders.read), canActivate: [permissionGuard] },
      { path: 'orders/:orderId/status', component: OrderStatusComponent, data: permissionRequirementAll(P.orders.statusUpdate), canActivate: [permissionGuard] },
      { path: 'returns', component: ReturnListComponent, data: permissionRequirementAll(P.orders.returnsRead), canActivate: [permissionGuard] },
      { path: 'returns/:returnId/status', component: ReturnStatusComponent, data: permissionRequirementAll(P.orders.returnsUpdate), canActivate: [permissionGuard] },
      {
        path: 'settings',
        data: SETTINGS_ACCESS,
        canActivate: [permissionGuard],
        loadComponent: () => import('./settings/settings-home.component').then(m => m.SettingsHomeComponent),
      },
      { path: 'settings/shipping-zones', component: ShippingZoneListComponent, data: permissionRequirementAll(P.shipping.zones.read), canActivate: [permissionGuard] },
      { path: 'settings/coupons', component: CouponListComponent, data: permissionRequirementAll(P.promotions.coupons.read), canActivate: [permissionGuard] },
      { path: 'settings/users', component: AdminUsersListComponent, data: permissionRequirementAll(P.users.read), canActivate: [permissionGuard] },
      { path: 'settings/roles', component: AdminRolesListComponent, data: permissionRequirementAll(P.roles.read), canActivate: [permissionGuard] },
      { path: 'cms/pages', component: PageListComponent, data: permissionRequirementAll(P.cms.pages.read), canActivate: [permissionGuard] },
      { path: 'cms/banners', component: BannerListComponent, data: permissionRequirementAll(P.cms.banners.read), canActivate: [permissionGuard] },
      { path: 'reports/sales', component: SalesMetricsComponent, data: permissionRequirementAll(P.analytics.read), canActivate: [permissionGuard] },
      { path: 'reports/low-stock', component: LowStockIndicatorsComponent, data: permissionRequirementAll(P.inventory.read), canActivate: [permissionGuard] },
      {
        path: 'profile',
        data: permissionRequirementAll(P.auth.read),
        canActivate: [permissionGuard],
        loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
