import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { DashboardRange, RecentOrder, RevenuePoint, TopProduct, LowStockAlert, OrderStatusCount, DashboardOverview } from './dashboard.models';
import { HttpDashboardDataSource } from './http-dashboard-data-source';
import { SampleDashboardDataSource } from './sample-dashboard-data-source';

export type AsyncStatus = 'loading' | 'ready' | 'empty' | 'error';

interface AsyncResult<T> {
  status: AsyncStatus;
  data?: T;
  error?: string;
  isSample?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpDashboardDataSource);
  private readonly sample = inject(SampleDashboardDataSource);

  private readonly range = signal<DashboardRange>('7');

  readonly dashboardRange = computed(() => this.range());

  setRange(range: DashboardRange): void {
    this.range.set(range);
  }

  loadOverview(): Observable<DashboardOverview> {
    return forkJoin([
      this.loadOverviewWidget('orders'),
      this.loadOverviewWidget('revenue'),
      this.loadNewCustomers(),
      this.loadLowStockCount(),
      this.loadRevenueChart(),
      this.loadRecentOrders(),
      this.loadTopProducts(),
      this.loadOrderStatus(),
      this.loadLowStockAlerts(),
    ]).pipe(
      map((results: unknown[]) => {
        const [orders, revenue, newCustomers, lowStockCount, revenueChart, recentOrders, topProducts, orderStatus, lowStockAlerts] = results;
        return {
          orders,
          revenue,
          newCustomers,
          lowStockCount,
          revenueChart,
          recentOrders,
          topProducts,
          orderStatus,
          lowStockAlerts,
        };
      })
    ) as Observable<DashboardOverview>;
  }

  private loadOverviewWidget(type: 'orders' | 'revenue'): Observable<AsyncResult<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>> {
    return forkJoin([
      this.http.getOverviewToday(),
      this.http.getOverviewYesterday(),
    ]).pipe(
      map(([today, yesterday]) => ({
        status: 'ready',
        data: { today, yesterday },
      } as AsyncResult<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>)),
      catchError((err) => {
        const message = err instanceof Error ? err.message : `Failed to load ${type}`;
        return of({ status: 'error', error: message } as AsyncResult<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>);
      })
    );
  }

  private loadNewCustomers(): Observable<AsyncResult<number>> {
    return this.http.getNewCustomers().pipe(
      map((data) => ({ status: 'ready', data, isSample: true } as AsyncResult<number>)),
      catchError(() => this.sample.getNewCustomers().pipe(
        map((data) => ({ status: 'ready', data, isSample: true } as AsyncResult<number>))
      ))
    );
  }

  private loadLowStockCount(): Observable<AsyncResult<number>> {
    return this.http.getLowStockCount().pipe(
      map((data) => ({ status: 'ready', data } as AsyncResult<number>)),
      catchError((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load low-stock count';
        return of({ status: 'error', error: message } as AsyncResult<number>);
      })
    );
  }

  private loadRevenueChart(): Observable<AsyncResult<{ points: RevenuePoint[]; range: DashboardRange }>> {
    return this.http.getSales(this.range()).pipe(
      map((points) => ({
        status: points.length > 0 ? 'ready' : 'empty',
        data: { points, range: this.range() },
      } as AsyncResult<{ points: RevenuePoint[]; range: DashboardRange }>)),
      catchError(() => this.sample.getSales(this.range()).pipe(
        map((points) => ({
          status: points.length > 0 ? 'ready' : 'empty',
          data: { points, range: this.range() },
          isSample: true,
        } as AsyncResult<{ points: RevenuePoint[]; range: DashboardRange }>))
      ))
    );
  }

  private loadRecentOrders(): Observable<AsyncResult<RecentOrder[]>> {
    return this.http.getRecentOrders(8).pipe(
      map((data) => ({
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      } as AsyncResult<RecentOrder[]>)),
      catchError((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load recent orders';
        return of({ status: 'error', error: message } as AsyncResult<RecentOrder[]>);
      })
    );
  }

  private loadTopProducts(): Observable<AsyncResult<TopProduct[]>> {
    return this.http.getTopSellingProducts().pipe(
      map((data) => ({
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      } as AsyncResult<TopProduct[]>)),
      catchError(() => this.sample.getTopSellingProducts().pipe(
        map((data) => ({
          status: data.length > 0 ? 'ready' : 'empty',
          data,
          isSample: true,
        } as AsyncResult<TopProduct[]>))
      ))
    );
  }

  private loadOrderStatus(): Observable<AsyncResult<OrderStatusCount[]>> {
    return this.http.getOrderStatusCounts().pipe(
      map((data) => {
        const total = data.reduce((sum, s) => sum + s.count, 0);
        return {
          status: total > 0 ? 'ready' : 'empty',
          data,
        } as AsyncResult<OrderStatusCount[]>;
      }),
      catchError((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load order status';
        return of({ status: 'error', error: message } as AsyncResult<OrderStatusCount[]>);
      })
    );
  }

  private loadLowStockAlerts(): Observable<AsyncResult<LowStockAlert[]>> {
    return this.http.getLowStockAlerts(5).pipe(
      map((data) => ({
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      } as AsyncResult<LowStockAlert[]>)),
      catchError((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load low-stock alerts';
        return of({ status: 'error', error: message } as AsyncResult<LowStockAlert[]>);
      })
    );
  }
}
