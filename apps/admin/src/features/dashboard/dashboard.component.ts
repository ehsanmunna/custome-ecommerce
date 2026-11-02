import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardStore } from './dashboard.store';
import { StatCardsWidgetComponent } from './widgets/stat-cards-widget.component';
import { RevenueChartWidgetComponent } from './widgets/revenue-chart-widget.component';
import { RecentOrdersWidgetComponent } from './widgets/recent-orders-widget.component';
import { TopProductsWidgetComponent } from './widgets/top-products-widget.component';
import { OrderStatusWidgetComponent } from './widgets/order-status-widget.component';
import { LowStockWidgetComponent } from './widgets/low-stock-widget.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
    imports: [
    CommonModule,
    TranslocoPipe,
    StatCardsWidgetComponent,
    RevenueChartWidgetComponent,
    RecentOrdersWidgetComponent,
    TopProductsWidgetComponent,
    OrderStatusWidgetComponent,
    LowStockWidgetComponent,
  ],
  template: `
    <div class="mx-auto max-w-[1200px] p-4">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">
            {{ 'dashboard.title' | transloco }}
          </h1>
          <p class="mt-1 text-sm text-[var(--color-text-muted)]">
            {{ 'dashboard.subtitle' | transloco }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            (click)="setRange('7')"
            [class]="'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (range() === '7' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50')"
          >
            {{ 'dashboard.range7' | transloco }}
          </button>
          <button
            (click)="setRange('30')"
            [class]="'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (range() === '30' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50')"
          >
            {{ 'dashboard.range30' | transloco }}
          </button>
          <button
            (click)="setRange('90')"
            [class]="'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' + (range() === '90' ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50')"
          >
            {{ 'dashboard.range90' | transloco }}
          </button>
        </div>
      </div>

      @if (store.loading()) {        <div class="h-64 flex items-center justify-center">
          <div class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
        </div>
      } @else if (store.error()) {
        <div class="h-64 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-[var(--color-danger)]">{{ store.error() }}</p>
            <button
              (click)="load()"
              class="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              {{ 'dashboard.widgetRetry' | transloco }}
            </button>
          </div>
        </div>
      } @else {
        <app-stat-cards-widget
          [orders]="widgetState('orders')"
          [revenue]="widgetState('revenue')"
          [newCustomers]="widgetState('newCustomers')"
          [lowStockCount]="widgetState('lowStockCount')"
        />

        <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="lg:col-span-2">
            <app-revenue-chart-widget [state]="widgetState('revenueChart')" (retry)="load()" />
          </div>
          <div>
            <app-recent-orders-widget [state]="widgetState('recentOrders')" (retry)="load()" />
          </div>
          <div>
            <app-top-products-widget [state]="widgetState('topProducts')" (retry)="load()" />
          </div>
          <div>
            <app-order-status-widget [state]="widgetState('orderStatus')" (retry)="load()" />
          </div>
          <div>
            <app-low-stock-widget [state]="widgetState('lowStockAlerts')" (retry)="load()" />
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly store = inject(DashboardStore);
  private readonly transloco = inject(TranslocoService);

  readonly range = this.store.range;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.store.load();
  }

  setRange(range: '7' | '30' | '90'): void {
    this.store.setRange(range);
    this.load();
  }

  widgetState(key: string) {
    const state = this.store.state();
    if (!state) {
      return { status: 'loading' as const };
    }
    return ((state as unknown) as Record<string, unknown>)[key] ?? { status: 'loading' as const };
  }
}
