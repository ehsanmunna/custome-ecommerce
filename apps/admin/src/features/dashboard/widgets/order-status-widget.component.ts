import { Component, input, output, computed, inject } from '@angular/core';

import { ChartThemeService } from '../chart-theme.service';
import { TranslocoPipe } from '@jsverse/transloco';

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface OrderStatusAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: OrderStatusCount[];
  error?: string;
}

@Component({
  selector: 'app-order-status-widget',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
    >
      <h3 class="mt-0 mb-4 text-lg font-semibold text-[var(--color-text)]">
        {{ 'dashboard.orderStatus' | transloco }}
      </h3>

      @if (state().status === 'loading') {
        <div class="h-48 flex items-center justify-center">
          <div class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
        </div>
      } @else if (state().status === 'empty') {
        <div class="h-48 flex items-center justify-center">
          <p class="text-sm text-[var(--color-text-muted)]">
            {{ 'dashboard.orderStatusEmpty' | transloco }}
          </p>
        </div>
      } @else if (state().status === 'error') {
        <div class="h-48 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-[var(--color-danger)]">
              {{ 'dashboard.widgetError' | transloco }}
            </p>
            <button
              (click)="retry.emit()"
              class="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              {{ 'dashboard.widgetRetry' | transloco }}
            </button>
          </div>
        </div>
      } @else {
        <canvas baseChart [data]="chartData()"></canvas>
        <div class="mt-4 grid grid-cols-2 gap-4">
          @for (item of statusCounts(); track item.status) {
            <div class="flex items-center gap-2 text-sm">
              <span class="w-3 h-3 rounded-full" [style.background]="itemColor(item.status)"></span>
              <span class="text-[var(--color-text)]">{{ item.status }}</span>
              <span class="ml-auto text-[var(--color-text-muted)]">{{ item.count }}</span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class OrderStatusWidgetComponent {
  readonly state = input.required<OrderStatusAsyncState>();
  readonly retry = output<void>();

  private readonly chartTheme = inject(ChartThemeService);

  readonly statusCounts = computed(() => this.state().data ?? []);

  readonly chartData = computed(() => {
    const counts = this.statusCounts();
    const colors = this.chartTheme.getColors();
    const palette = [
      colors.primary,
      colors.success,
      colors.warning,
      colors.danger,
      colors.info,
      colors.surface,
      colors.textMuted,
      colors.border,
    ].filter((c): c is string => Boolean(c));
    return {
      labels: counts.map((c) => c.status),
      datasets: [
        {
          data: counts.map((c) => c.count),
          backgroundColor: counts.map(
            (_, i) => palette[i % palette.length] || 'var(--p-primary-500)',
          ),
          borderColor: counts.map(() => colors.surfaceLight || 'var(--p-surface-200)'),
        },
      ],
    };
  });

  readonly itemColor = (status: string): string => {
    const colors = this.chartTheme.getColors();
    const map: Record<string, string> = {
      pending: colors.warning || 'var(--p-yellow-500)',
      confirmed: colors.primary || 'var(--p-primary-500)',
      processing: colors.info || 'var(--p-blue-500)',
      shipped: colors.primary || 'var(--p-primary-500)',
      delivered: colors.success || 'var(--p-green-500)',
      cancelled: colors.danger || 'var(--p-red-500)',
      returned: colors.danger || 'var(--p-red-500)',
      partially_delivered: colors.warning || 'var(--p-yellow-500)',
    };
    return map[status] || colors.border || 'var(--p-border-color)';
  };
}
