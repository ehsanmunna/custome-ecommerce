import { Component, input, output, computed } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';

export interface TopProduct {
  rank: number;
  productName: string;
  unitsSold: number;
}

export interface TopProductsAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: TopProduct[];
  error?: string;
  isSample?: boolean;
}

@Component({
  selector: 'app-top-products-widget',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
    >
      <h3 class="mt-0 mb-4 text-lg font-semibold text-[var(--color-text)]">
        {{ 'dashboard.topProducts' | transloco }}
      </h3>

      @if (state().status === 'loading') {
        <div class="h-48 flex items-center justify-center">
          <div class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
        </div>
      } @else if (state().status === 'empty') {
        <div class="h-48 flex items-center justify-center">
          <p class="text-sm text-[var(--color-text-muted)]">
            {{ 'dashboard.noTopProducts' | transloco }}
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
        <ol class="list-decimal list-inside divide-y divide-[var(--color-border)]">
          @for (product of products(); track product.rank) {
            <li class="py-3 flex justify-between items-center">
              <div class="flex items-center gap-3">
                <span class="w-6 text-center font-medium text-[var(--color-text-muted)]">
                  {{ product.rank }}
                </span>
                <span class="text-[var(--color-text)]">{{ product.productName }}</span>
              </div>
              <span class="text-[var(--color-text-secondary)]">{{
                'dashboard.unitsSold' | transloco: { value: product.unitsSold }
              }}</span>
            </li>
          }
        </ol>
      }

      @if (isSample()) {
        <div class="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <span class="pi pi-information-circle"></span>
          {{ 'dashboard.sampleData' | transloco }}
        </div>
      }
    </div>
  `,
})
export class TopProductsWidgetComponent {
  readonly state = input.required<TopProductsAsyncState>();
  readonly retry = output<void>();

  readonly products = computed(() => this.state().data ?? []);
  readonly isSample = computed(() => this.state().isSample === true);
}
