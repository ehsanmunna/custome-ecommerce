import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

export interface LowStockAlert {
  variantId: string;
  productName: string;
  sku: string;
  available: number;
  threshold: number;
}

export interface LowStockAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: LowStockAlert[];
  error?: string;
}

@Component({
  selector: 'app-low-stock-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe],
  template: `
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)]">
          {{ 'dashboard.lowStockAlerts' | transloco }}
        </h3>
        <a
          routerLink="/inventory"
          class="text-sm text-[var(--color-primary)] hover:underline no-underline"
        >
          {{ 'dashboard.viewInventory' | transloco }}
        </a>
      </div>

      @if (state().status === 'loading') {
        <div class="h-48 flex items-center justify-center">
          <div class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
        </div>
      } @else if (state().status === 'empty') {
        <div class="h-48 flex items-center justify-center">
          <p class="text-sm text-[var(--color-text-muted)]">{{ 'dashboard.noLowStock' | transloco }}</p>
        </div>
      } @else if (state().status === 'error') {
        <div class="h-48 flex items-center justify-center">
          <div class="text-center">
            <p class="text-sm text-[var(--color-danger)]">{{ 'dashboard.widgetError' | transloco }}</p>
            <button
              (click)="retry.emit()"
              class="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              {{ 'dashboard.widgetRetry' | transloco }}
            </button>
          </div>
        </div>
      } @else {
        <ul class="divide-y divide-[var(--color-border)]">
          @for (alert of alerts(); track alert.variantId) {
            <li class="py-3 flex justify-between items-center">
              <div>
                <p class="text-sm font-medium text-[var(--color-text)]">{{ alert.productName }}</p>
                <p class="text-xs text-[var(--color-text-muted)]">{{ alert.sku }}</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-[var(--color-text)]">{{ alert.available }} / {{ alert.threshold }}</p>
                <p class="text-xs text-[var(--color-text-muted)]">Available / Threshold</p>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class LowStockWidgetComponent {
  readonly state = input.required<LowStockAsyncState>();
  readonly retry = output<void>();

  readonly alerts = computed(() => this.state().data ?? []);
}
