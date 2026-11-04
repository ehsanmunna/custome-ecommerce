import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
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
  getOverviewToday(): Observable<{ orderCount: number; revenue: number }> {
    return of({ orderCount: 0, revenue: 0 });
  }

  getOverviewYesterday(): Observable<{ orderCount: number; revenue: number }> {
    return of({ orderCount: 0, revenue: 0 });
  }

  getSales(_range: DashboardRange): Observable<RevenuePoint[]> {
    return of([]);
  }

  getRecentOrders(_limit?: number): Observable<RecentOrder[]> {
    return of([]);
  }

  getLowStockCount(): Observable<number> {
    return of(0);
  }

  getOrderStatusCounts(): Observable<OrderStatusCount[]> {
    return of(ORDER_STATUSES.map((status) => ({ status: status as OrderStatus, count: 0 })));
  }

  getLowStockAlerts(_limit = 5): Observable<LowStockAlert[]> {
    return of([]);
  }

  getNewCustomers(): Observable<number> {
    return of(SAMPLE_NEW_CUSTOMERS);
  }

  getTopSellingProducts(): Observable<TopProduct[]> {
    return of([...SAMPLE_TOP_PRODUCTS]);
  }
}
