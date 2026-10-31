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

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'products', component: ProductListComponent },
      { path: 'categories', component: CategoryListComponent },
      { path: 'brands', component: BrandListComponent },
      { path: 'attributes', component: AttributeListComponent },
      { path: 'products/:productId/variants', component: VariantListComponent },
      { path: 'media', component: MediaListComponent },
      { path: 'inventory', component: InventoryListComponent },
      { path: 'inventory/adjust', component: InventoryAdjustmentComponent },
      { path: 'inventory/reservations', component: InventoryReservationComponent },
      { path: 'inventory/movements', component: StockMovementsComponent },
      { path: 'orders', component: OrderListComponent },
      { path: 'orders/:orderId', component: OrderDetailComponent },
      { path: 'orders/:orderId/status', component: OrderStatusComponent },
      { path: 'returns', component: ReturnListComponent },
      { path: 'returns/:returnId/status', component: ReturnStatusComponent },
      { path: 'settings/shipping-zones', component: ShippingZoneListComponent },
      { path: 'settings/coupons', component: CouponListComponent },
      { path: 'cms/pages', component: PageListComponent },
      { path: 'cms/banners', component: BannerListComponent },
      { path: 'reports/sales', component: SalesMetricsComponent },
      { path: 'reports/low-stock', component: LowStockIndicatorsComponent },
      { path: 'profile', loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent) },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
