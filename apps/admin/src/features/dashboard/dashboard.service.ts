import { Injectable, computed, inject, signal } from '@angular/core';
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

  async loadOverview(): Promise<DashboardOverview> {
    const [orders, revenue, newCustomers, lowStockCount, revenueChart, recentOrders, topProducts, orderStatus, lowStockAlerts] =
      await Promise.all([
        this.loadOverviewWidget('orders'),
        this.loadOverviewWidget('revenue'),
        this.loadNewCustomers(),
        this.loadLowStockCount(),
        this.loadRevenueChart(),
        this.loadRecentOrders(),
        this.loadTopProducts(),
        this.loadOrderStatus(),
        this.loadLowStockAlerts(),
      ]);

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
  }

  private async loadOverviewWidget(type: 'orders' | 'revenue'): Promise<AsyncResult<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>> {
    try {
      const [today, yesterday] = await Promise.all([
        this.http.getOverviewToday(),
        this.http.getOverviewYesterday(),
      ]);
      return {
        status: 'ready',
        data: { today, yesterday },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load ${type}`;
      return { status: 'error', error: message };
    }
  }

  private async loadNewCustomers(): Promise<AsyncResult<number>> {
    try {
      const data = await this.http.getNewCustomers();
      return { status: 'ready', data, isSample: true };
    } catch {
      const data = await this.sample.getNewCustomers();
      return { status: 'ready', data, isSample: true };
    }
  }

  private async loadLowStockCount(): Promise<AsyncResult<number>> {
    try {
      const data = await this.http.getLowStockCount();
      return { status: 'ready', data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load low-stock count';
      return { status: 'error', error: message };
    }
  }

  private async loadRevenueChart(): Promise<AsyncResult<{ points: RevenuePoint[]; range: DashboardRange }>> {
    try {
      const points = await this.http.getSales(this.range());
      return {
        status: points.length > 0 ? 'ready' : 'empty',
        data: { points, range: this.range() },
      };
    } catch {
      const points = await this.sample.getSales(this.range());
      return {
        status: points.length > 0 ? 'ready' : 'empty',
        data: { points, range: this.range() },
        isSample: true,
      };
    }
  }

  private async loadRecentOrders(): Promise<AsyncResult<RecentOrder[]>> {
    try {
      const data = await this.http.getRecentOrders(8);
      return {
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent orders';
      return { status: 'error', error: message };
    }
  }

  private async loadTopProducts(): Promise<AsyncResult<TopProduct[]>> {
    try {
      const data = await this.http.getTopSellingProducts();
      return {
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      };
    } catch {
      const data = await this.sample.getTopSellingProducts();
      return { status: 'ready', data, isSample: true };
    }
  }

  private async loadOrderStatus(): Promise<AsyncResult<OrderStatusCount[]>> {
    try {
      const data = await this.http.getOrderStatusCounts();
      const total = data.reduce((sum, s) => sum + s.count, 0);
      return {
        status: total > 0 ? 'ready' : 'empty',
        data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load order status';
      return { status: 'error', error: message };
    }
  }

  private async loadLowStockAlerts(): Promise<AsyncResult<LowStockAlert[]>> {
    try {
      const data = await this.http.getLowStockAlerts(5);
      return {
        status: data.length > 0 ? 'ready' : 'empty',
        data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load low-stock alerts';
      return { status: 'error', error: message };
    }
  }
}
