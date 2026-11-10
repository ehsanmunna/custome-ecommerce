import { inject, Injectable, signal, computed } from '@angular/core';
import { DashboardService } from './dashboard.service';
import type { DashboardRange, AsyncState, DashboardOverview } from './dashboard.models';

export interface DashboardWidgetState {
  orders: AsyncState<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>;
  revenue: AsyncState<{ today: { orderCount: number; revenue: number }; yesterday: { orderCount: number; revenue: number } }>;
  newCustomers: AsyncState<number>;
  lowStockCount: AsyncState<number>;
  revenueChart: AsyncState<{ points: { periodStart: string; orderCount: number; revenue: number }[]; range: DashboardRange }>;
  recentOrders: AsyncState<{ id: string; number: string; customerName: string; status: string; total: number; createdAt: string }[]>;
  topProducts: AsyncState<{ rank: number; productName: string; unitsSold: number }[]>;
  orderStatus: AsyncState<{ status: string; count: number }[]>;
  lowStockAlerts: AsyncState<{ variantId: string; productName: string; sku: string; available: number; threshold: number }[]>;
}

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly service = inject(DashboardService);

  private readonly _state = signal<DashboardWidgetState | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly state = computed(() => this._state());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly range = computed(() => this.service.dashboardRange());

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.service.loadOverview().subscribe({
      next: (overview: DashboardOverview) => {
        this._state.set({
          orders: { status: 'ready', data: overview.orders.data },
          revenue: { status: 'ready', data: overview.revenue.data },
          newCustomers: { status: 'ready', data: overview.newCustomers.data, isSample: overview.newCustomers.isSample },
          lowStockCount: { status: 'ready', data: overview.lowStockCount.data },
          revenueChart: { status: 'ready', data: overview.revenueChart.data, isSample: overview.revenueChart.isSample },
          recentOrders: { status: 'ready', data: overview.recentOrders.data },
          topProducts: { status: 'ready', data: overview.topProducts.data, isSample: overview.topProducts.isSample },
          orderStatus: { status: 'ready', data: overview.orderStatus.data },
          lowStockAlerts: { status: 'ready', data: overview.lowStockAlerts.data },
        });
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard';
        this._error.set(message);
      },
      complete: () => {
        this._loading.set(false);
      }
    });
  }

  setRange(range: DashboardRange): void {
    this.service.setRange(range);
  }

  isSample(widget: keyof DashboardWidgetState): boolean {
    const s = this._state();
    if (!s) return false;
    const widgetState = s[widget] as { isSample?: boolean } | undefined;
    return widgetState?.isSample === true;
  }

  hasPermission(_permission: string): boolean {
    return true;
  }
}
