import { Injectable } from '@angular/core';
import type { DashboardDataSource, DashboardRange, LowStockAlert, OrderStatusCount, RevenuePoint, TopProduct, RecentOrder, OrderStatus } from './dashboard.models';

const SAMPLE_NEW_CUSTOMERS = 12;

const SAMPLE_TOP_PRODUCTS: TopProduct[] = [
  { rank: 1, productName: 'Cotton T-Shirt', unitsSold: 45 },
  { rank: 2, productName: 'Denim Jeans', unitsSold: 32 },
  { rank: 3, productName: 'Wool Sweater', unitsSold: 28 },
  { rank: 4, productName: 'Running Shoes', unitsSold: 24 },
  { rank: 5, productName: 'Leather Belt', unitsSold: 19 },
];

const ORDER_STATUSES: string[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'partially_delivered',
];

@Injectable({ providedIn: 'root' })
export class SampleDashboardDataSource implements DashboardDataSource {
  async getOverviewToday(): Promise<{ orderCount: number; revenue: number }> {
    return { orderCount: 0, revenue: 0 };
  }

  async getOverviewYesterday(): Promise<{ orderCount: number; revenue: number }> {
    return { orderCount: 0, revenue: 0 };
  }

  async getSales(_range: DashboardRange): Promise<RevenuePoint[]> {
    return [];
  }

  async getRecentOrders(_limit?: number): Promise<RecentOrder[]> {
    return [];
  }

  async getLowStockCount(): Promise<number> {
    return 0;
  }

  async getOrderStatusCounts(): Promise<OrderStatusCount[]> {
    return ORDER_STATUSES.map((status) => ({ status: status as OrderStatus, count: 0 }));
  }

  async getLowStockAlerts(_limit = 5): Promise<LowStockAlert[]> {
    return [];
  }

  async getNewCustomers(): Promise<number> {
    return SAMPLE_NEW_CUSTOMERS;
  }

  async getTopSellingProducts(): Promise<TopProduct[]> {
    return [...SAMPLE_TOP_PRODUCTS];
  }
}
