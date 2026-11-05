import { Component, input, output, computed } from '@angular/core';

import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import { TranslocoPipe } from '@jsverse/transloco';

export interface RecentOrder {
  id: string;
  number: string;
  customerName: string;
  status: string;
  total: number;
  createdAt: string;
}

export interface OrdersAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: RecentOrder[];
  error?: string;
}

@Component({
  selector: 'app-recent-orders-widget',
  standalone: true,
  imports: [DataTableComponent, TranslocoPipe],
  template: `
    <div
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)]">
          {{ 'dashboard.recentOrders' | transloco }}
        </h3>
        <a
          routerLink="/orders"
          class="text-sm text-[var(--color-primary)] hover:underline no-underline"
        >
          {{ 'dashboard.viewAllOrders' | transloco }}
        </a>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="ordersData()"
        [status]="state().status"
        [emptyMessage]="'dashboard.noRecentOrders'"
        (retry)="retry.emit()"
      />
    </div>
  `,
})
export class RecentOrdersWidgetComponent {
  readonly state = input.required<OrdersAsyncState>();
  readonly retry = output<void>();

  readonly columns = [
    { key: 'number', label: 'dashboard.orderNumber' },
    { key: 'customerName', label: 'dashboard.customer' },
    { key: 'status', label: 'status.orders.pending' },
    { key: 'total', label: 'dashboard.total' },
    { key: 'createdAt', label: 'dashboard.createdAt' },
  ] as const;

  readonly ordersData = computed(() => this.state().data ?? []);
}
