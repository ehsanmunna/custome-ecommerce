import type { components } from 'api-sdk';
import { ADMIN_PERMISSIONS } from '../../core/auth/admin-permissions';

export type DashboardRange = '7' | '30' | '90';

export type AnalyticsOverview = components['schemas']['AnalyticsOverview'];
export type Money = components['schemas']['Money'];
export type OrderStatus = components['schemas']['OrderStatus'];
export type SalesSeries = components['schemas']['SalesSeries'];
export type InventoryItem = components['schemas']['InventoryItem'];
export type OrderPage = components['schemas']['OrderPage'];
export type AdminOrder = components['schemas']['Order'];
export type AdminProduct = components['schemas']['Product'];

export interface AsyncState<T> {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: T;
  error?: string;
  isSample?: boolean;
}

export interface DashboardStat {
  value: string | number;
  labelKey: string;
  icon: string;
  delta?: { value: number | string; direction: 'up' | 'down' };
  status: 'loading' | 'ready' | 'empty' | 'error';
  isSample?: boolean;
}

export interface RevenuePoint {
  periodStart: string;
  orderCount: number;
  revenue: number;
}

export interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
}

export interface TopProduct {
  rank: number;
  productName: string;
  unitsSold: number;
}

export interface OrderStatusCount {
  status: OrderStatus;
  count: number;
}

export interface LowStockAlert {
  variantId: string;
  productName: string;
  sku: string;
  available: number;
  threshold: number;
}

export interface OverviewData {
  today: { orderCount: number; revenue: number };
  yesterday: { orderCount: number; revenue: number };
}

export interface SalesData {
  points: RevenuePoint[];
  range: DashboardRange;
}

export interface DashboardOverview {
  orders: AsyncState<OverviewData>;
  revenue: AsyncState<OverviewData>;
  newCustomers: AsyncState<number>;
  lowStockCount: AsyncState<number>;
  revenueChart: AsyncState<SalesData>;
  recentOrders: AsyncState<RecentOrder[]>;
  topProducts: AsyncState<TopProduct[]>;
  orderStatus: AsyncState<OrderStatusCount[]>;
  lowStockAlerts: AsyncState<LowStockAlert[]>;
}

/** Permission each dashboard widget's data request requires. */
export const DASHBOARD_WIDGET_PERMISSIONS = {
  orders: ADMIN_PERMISSIONS.analytics.read,
  revenue: ADMIN_PERMISSIONS.analytics.read,
  revenueChart: ADMIN_PERMISSIONS.analytics.read,
  topProducts: ADMIN_PERMISSIONS.analytics.read,
  newCustomers: ADMIN_PERMISSIONS.customers.read,
  recentOrders: ADMIN_PERMISSIONS.orders.read,
  orderStatus: ADMIN_PERMISSIONS.orders.read,
  lowStockCount: ADMIN_PERMISSIONS.inventory.read,
  lowStockAlerts: ADMIN_PERMISSIONS.inventory.read,
} as const;

export type DashboardWidget = keyof typeof DASHBOARD_WIDGET_PERMISSIONS;

export const DASHBOARD_WIDGETS = Object.keys(
  DASHBOARD_WIDGET_PERMISSIONS,
) as DashboardWidget[];

export function dashboardWidgetPermission(widget: DashboardWidget): string {
  return DASHBOARD_WIDGET_PERMISSIONS[widget];
}

import { Observable } from 'rxjs';

export type DashboardDataSource = {
  getOverviewToday(): Observable<{ orderCount: number; revenue: number }>;
  getOverviewYesterday(): Observable<{ orderCount: number; revenue: number }>;
  getSales(range: DashboardRange): Observable<RevenuePoint[]>;
  getRecentOrders(limit?: number): Observable<RecentOrder[]>;
  getLowStockCount(): Observable<number>;
  getOrderStatusCounts(): Observable<OrderStatusCount[]>;
  getLowStockAlerts(limit?: number): Observable<LowStockAlert[]>;
  getNewCustomers(): Observable<number>;
  getTopSellingProducts(): Observable<TopProduct[]>;
};
