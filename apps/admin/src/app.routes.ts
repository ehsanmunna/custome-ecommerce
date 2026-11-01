import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login.component';
import { LogoutComponent } from './auth/logout.component';
import { authGuard } from './auth/auth.guard';
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
import { PageListComponent } from './cms/page-list.component';
import { BannerListComponent } from './cms/banner-list.component';
import { SalesMetricsComponent } from './reporting/sales-metrics.component';
import { LowStockIndicatorsComponent } from './reporting/low-stock-indicators.component';
import { AdminShellComponent } from './shell/admin-shell.component';

// The admin navigation menu is derived from this route table. Add
// `data: { menu: { label, group } }` to a route to make it appear in the sidebar.
// Routes without menu data (detail routes, redirects, login/logout) stay hidden.
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        data: { menu: { label: 'Dashboard' } },
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      { path: 'products', component: ProductListComponent, data: { menu: { label: 'Products', group: 'Catalog' } } },
      { path: 'categories', component: CategoryListComponent, data: { menu: { label: 'Categories', group: 'Catalog' } } },
      { path: 'brands', component: BrandListComponent, data: { menu: { label: 'Brands', group: 'Catalog' } } },
      { path: 'attributes', component: AttributeListComponent, data: { menu: { label: 'Attributes', group: 'Catalog' } } },
      { path: 'products/:productId/variants', component: VariantListComponent },
      { path: 'media', component: MediaListComponent, data: { menu: { label: 'Media', group: 'Catalog' } } },
      { path: 'inventory', component: InventoryListComponent, data: { menu: { label: 'Inventory', group: 'Inventory' } } },
      { path: 'inventory/adjust', component: InventoryAdjustmentComponent, data: { menu: { label: 'Adjust stock', group: 'Inventory' } } },
      { path: 'inventory/reservations', component: InventoryReservationComponent, data: { menu: { label: 'Reservations', group: 'Inventory' } } },
      { path: 'inventory/movements', component: StockMovementsComponent, data: { menu: { label: 'Stock movements', group: 'Inventory' } } },
      { path: 'orders', component: OrderListComponent, data: { menu: { label: 'Orders', group: 'Orders' } } },
      { path: 'orders/:orderId', component: OrderDetailComponent },
      { path: 'orders/:orderId/status', component: OrderStatusComponent },
      { path: 'returns', component: ReturnListComponent, data: { menu: { label: 'Returns', group: 'Returns' } } },
      { path: 'returns/:returnId/status', component: ReturnStatusComponent },
      { path: 'settings/shipping-zones', component: ShippingZoneListComponent, data: { menu: { label: 'Shipping zones', group: 'Settings' } } },
      { path: 'settings/coupons', component: CouponListComponent, data: { menu: { label: 'Coupons', group: 'Settings' } } },
      { path: 'cms/pages', component: PageListComponent, data: { menu: { label: 'Pages', group: 'CMS' } } },
      { path: 'cms/banners', component: BannerListComponent, data: { menu: { label: 'Banners', group: 'CMS' } } },
      { path: 'reports/sales', component: SalesMetricsComponent, data: { menu: { label: 'Sales', group: 'Reports' } } },
      { path: 'reports/low-stock', component: LowStockIndicatorsComponent, data: { menu: { label: 'Low stock', group: 'Reports' } } },
      {
        path: 'profile',
        data: { menu: { label: 'Profile' } },
        loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
