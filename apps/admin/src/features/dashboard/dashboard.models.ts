import type { components } from 'api-sdk';

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

export type DashboardDataSource = {
  getOverviewToday(): Promise<{ orderCount: number; revenue: number }>;
  getOverviewYesterday(): Promise<{ orderCount: number; revenue: number }>;
  getSales(range: DashboardRange): Promise<RevenuePoint[]>;
  getRecentOrders(limit?: number): Promise<RecentOrder[]>;
  getLowStockCount(): Promise<number>;
  getOrderStatusCounts(): Promise<OrderStatusCount[]>;
  getLowStockAlerts(limit?: number): Promise<LowStockAlert[]>;
  getNewCustomers(): Promise<number>;
  getTopSellingProducts(): Promise<TopProduct[]>;
};
