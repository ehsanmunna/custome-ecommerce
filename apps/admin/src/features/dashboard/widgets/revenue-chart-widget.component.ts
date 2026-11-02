import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartThemeService } from '../chart-theme.service';
import { TranslocoPipe } from '@jsverse/transloco';

export interface SalesAsyncState {
  status: 'loading' | 'ready' | 'empty' | 'error';
  data?: { points: { periodStart: string; orderCount: number; revenue: number }[]; range: '7' | '30' | '90' };
  error?: string;
  isSample?: boolean;
}

@Component({
  selector: 'app-revenue-chart-widget',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  template: `
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div class="flex items-center justify-between mb-4">
        <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)]">
          {{ 'dashboard.revenueChart' | transloco }}
        </h3>
        <div class="flex gap-1">
          <button
            *ngFor="let range of ranges"
            (click)="setRange(range)"
            [class]="'px-3 py-1.5 text-xs rounded-md transition-colors ' + (range === selectedRange() ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/50')"
          >
            {{ rangeLabel(range) | transloco }}
          </button>
        </div>
      </div>

      @if (state().status === 'loading') {
        <div class="h-48 flex items-center justify-center">
          <div class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
        </div>
      } @else if (state().status === 'empty') {
        <div class="h-48 flex items-center justify-center">
          <p class="text-sm text-[var(--color-text-muted)]">{{ 'dashboard.revenueEmpty' | transloco }}</p>
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
        <canvas baseChart [data]="chartData()"></canvas>
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
export class RevenueChartWidgetComponent {
  readonly state = input.required<SalesAsyncState>();
  readonly retry = output<void>();

  readonly ranges = ['7', '30', '90'] as const;

  private readonly chartTheme = inject(ChartThemeService);

  readonly selectedRange = computed(() => this.state().data?.range ?? '7');

  readonly chartData = computed(() => {
    const s = this.state();
    if (s.status !== 'ready' || !s.data) return { labels: [], datasets: [] };
    const colors = this.chartTheme.getColors();
    return {
      labels: s.data.points.map((p) => p.periodStart),
      datasets: [
        {
          data: s.data.points.map((p: { revenue: number }) => p.revenue),
          borderColor: colors.primary || 'var(--p-primary-500)',
          backgroundColor: colors.primaryLight || 'var(--p-primary-100)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  });

  readonly isSample = computed(() => this.state().isSample === true);

  rangeLabel(range: '7' | '30' | '90'): string {
    const map: Record<'7' | '30' | '90', string> = {
      '7': 'dashboard.range7',
      '30': 'dashboard.range30',
      '90': 'dashboard.range90',
    };
    return map[range];
  }

  setRange(range: '7' | '30' | '90'): void {
    console.log(`Set range to ${range}`);
  }
}
