import { Component, input, output, computed } from '@angular/core';

import { StatCardComponent } from '../../../shared/ui/stat-card/stat-card.component';
import { TranslocoPipe } from '@jsverse/transloco';

export interface OverviewAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: {
    today: { orderCount: number; revenue: number };
    yesterday: { orderCount: number; revenue: number };
  };
  error?: string;
}

@Component({
  selector: 'app-stat-cards-widget',
  standalone: true,
  imports: [StatCardComponent, TranslocoPipe],
  template: `
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <app-stat-card
        [value]="ordersValue()"
        [label]="'dashboard.ordersToday' | transloco"
        [icon]="'pi pi-shopping-cart'"
        [delta]="ordersDelta()"
        [deltaDirection]="ordersDeltaDirection()"
        [status]="orders().status"
        (retry)="onRetry('orders')"
      />
      <app-stat-card
        [value]="revenueValue()"
        [label]="'dashboard.revenueToday' | transloco"
        [icon]="'pi pi-money-bill'"
        [delta]="revenueDelta()"
        [deltaDirection]="revenueDeltaDirection()"
        [status]="revenue().status"
        (retry)="onRetry('revenue')"
      />
      <app-stat-card
        [value]="newCustomersValue()"
        [label]="'dashboard.newCustomers' | transloco"
        [icon]="'pi pi-user-plus'"
        [status]="newCustomers().status"
        (retry)="onRetry('newCustomers')"
      />
      <app-stat-card
        [value]="lowStockValue()"
        [label]="'dashboard.lowStockProducts' | transloco"
        [icon]="'pi pi-exclamation-triangle'"
        [status]="lowStockCount().status"
        (retry)="onRetry('lowStockCount')"
      />
    </div>
  `,
})
export class StatCardsWidgetComponent {
  readonly orders = input.required<OverviewAsyncState>();
  readonly revenue = input.required<OverviewAsyncState>();
  readonly newCustomers = input.required<{
    status: 'loading' | 'ready' | 'empty' | 'error';
    data?: number;
    error?: string;
    isSample?: boolean;
  }>();
  readonly lowStockCount = input.required<{
    status: 'loading' | 'ready' | 'empty' | 'error';
    data?: number;
    error?: string;
  }>();
  readonly retry = output<string>();

  readonly ordersValue = computed(() => {
    const s = this.orders();
    if (s.status !== 'ready' || !s.data) return '—';
    return s.data.today.orderCount;
  });

  readonly ordersDelta = computed(() => {
    const s = this.orders();
    if (s.status !== 'ready' || !s.data) return null;
    const diff = s.data.today.orderCount - s.data.yesterday.orderCount;
    return diff === 0 ? null : diff;
  });

  readonly ordersDeltaDirection = computed(() => {
    const s = this.orders();
    if (s.status !== 'ready' || !s.data) return null;
    const diff = s.data.today.orderCount - s.data.yesterday.orderCount;
    return diff > 0 ? 'up' : diff < 0 ? 'down' : null;
  });

  readonly revenueValue = computed(() => {
    const s = this.revenue();
    if (s.status !== 'ready' || !s.data) return '—';
    return (s.data.today.revenue / 100).toFixed(2);
  });

  readonly revenueDelta = computed(() => {
    const s = this.revenue();
    if (s.status !== 'ready' || !s.data) return null;
    const diff = s.data.today.revenue - s.data.yesterday.revenue;
    return diff === 0 ? null : (diff / 100).toFixed(2);
  });

  readonly revenueDeltaDirection = computed(() => {
    const s = this.revenue();
    if (s.status !== 'ready' || !s.data) return null;
    const diff = s.data.today.revenue - s.data.yesterday.revenue;
    return diff > 0 ? 'up' : diff < 0 ? 'down' : null;
  });

  readonly newCustomersValue = computed(() => {
    const s = this.newCustomers();
    if (s.status !== 'ready') return '—';
    return s.data ?? '—';
  });

  readonly lowStockValue = computed(() => {
    const s = this.lowStockCount();
    if (s.status !== 'ready') return '—';
    return s.data ?? '—';
  });

  onRetry(widget: string): void {
    this.retry.emit(widget);
  }
}
