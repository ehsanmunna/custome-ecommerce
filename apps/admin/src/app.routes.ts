import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { LogoutComponent } from './auth/logout.component';
import { ForbiddenComponent } from './auth/forbidden.component';
import { authGuard } from './auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
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
import { PageListComponent } from './cms/page-list.component';
import { BannerListComponent } from './cms/banner-list.component';
import { SalesMetricsComponent } from './reporting/sales-metrics.component';
import { LowStockIndicatorsComponent } from './reporting/low-stock-indicators.component';
import { AdminShellComponent } from './layout/shell/admin-shell.component';

const ALL_ROLES = ['owner', 'manager', 'staff', 'support'];
const CATALOG_ROLES = ['owner', 'manager', 'staff'];
const ORDER_ROLES = ['owner', 'manager', 'staff', 'support'];
const CUSTOMER_ROLES = ['owner', 'manager', 'support'];
const INVENTORY_ROLES = ['owner', 'manager', 'staff'];
const MANAGER_ROLES = ['owner', 'manager'];

// Navigation labels, icons, and ordering live in
// `layout/menu/admin-menu.config.ts`. Every protected route declares the same
// `data.roles` list that `roleGuard` enforces at navigation time.
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
        data: { roles: ALL_ROLES },
        canActivate: [roleGuard],
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'customers',
        data: { roles: CUSTOMER_ROLES },
        canActivate: [roleGuard],
        loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent),
      },
      { path: 'products', component: ProductListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'categories', component: CategoryListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'brands', component: BrandListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'attributes', component: AttributeListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'products/:productId/variants', component: VariantListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'media', component: MediaListComponent, data: { roles: CATALOG_ROLES }, canActivate: [roleGuard] },
      { path: 'inventory', component: InventoryListComponent, data: { roles: INVENTORY_ROLES }, canActivate: [roleGuard] },
      { path: 'inventory/adjust', component: InventoryAdjustmentComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'inventory/reservations', component: InventoryReservationComponent, data: { roles: INVENTORY_ROLES }, canActivate: [roleGuard] },
      { path: 'inventory/movements', component: StockMovementsComponent, data: { roles: INVENTORY_ROLES }, canActivate: [roleGuard] },
      { path: 'orders', component: OrderListComponent, data: { roles: ORDER_ROLES }, canActivate: [roleGuard] },
      { path: 'orders/:orderId', component: OrderDetailComponent, data: { roles: ORDER_ROLES }, canActivate: [roleGuard] },
      { path: 'orders/:orderId/status', component: OrderStatusComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'returns', component: ReturnListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'returns/:returnId/status', component: ReturnStatusComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      {
        path: 'settings',
        data: { roles: MANAGER_ROLES },
        canActivate: [roleGuard],
        loadComponent: () => import('./settings/settings-home.component').then(m => m.SettingsHomeComponent),
      },
      { path: 'settings/shipping-zones', component: ShippingZoneListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'settings/coupons', component: CouponListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'settings/users', component: AdminUsersListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'cms/pages', component: PageListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'cms/banners', component: BannerListComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'reports/sales', component: SalesMetricsComponent, data: { roles: MANAGER_ROLES }, canActivate: [roleGuard] },
      { path: 'reports/low-stock', component: LowStockIndicatorsComponent, data: { roles: INVENTORY_ROLES }, canActivate: [roleGuard] },
      {
        path: 'profile',
        data: { roles: ALL_ROLES },
        canActivate: [roleGuard],
        loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
