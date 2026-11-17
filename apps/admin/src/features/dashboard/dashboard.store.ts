import { inject, Injectable, signal, computed } from '@angular/core';
import { DashboardService } from './dashboard.service';
import {
  DASHBOARD_WIDGETS,
  dashboardWidgetPermission,
  type AsyncState,
  type DashboardRange,
  type DashboardOverview,
  type DashboardWidget,
} from './dashboard.models';
import { AuthService } from '../../auth/auth.service';

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
  private readonly auth = inject(AuthService);

  private readonly _state = signal<Partial<DashboardOverview> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly state = computed(() => this._state());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());
  readonly range = computed(() => this.service.dashboardRange());
  readonly visibleWidgets = computed<DashboardWidget[]>(() =>
    DASHBOARD_WIDGETS.filter((widget) => this.canView(widget)),
  );

  canView(widget: DashboardWidget): boolean {
    return this.auth.hasPermission(dashboardWidgetPermission(widget));
  }

  load(): void {
    this._loading.set(true);
    this._error.set(null);

    this.service.loadOverview().subscribe({
      next: (overview: Partial<DashboardOverview>) => {
        this._state.set(overview);
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
}
