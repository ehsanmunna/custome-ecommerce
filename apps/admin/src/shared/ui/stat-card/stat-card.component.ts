import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export type StatCardStatus = 'loading' | 'ready' | 'empty' | 'error';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm"
      [class.opacity-50]="status() === 'loading'"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-md bg-[var(--color-surface-secondary)] flex items-center justify-center"
          >
            <span class="pi pi-fw" [attr.class]="icon()"></span>
          </div>
          <p class="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
            {{ label() | transloco }}
          </p>
        </div>
        @if (status() === 'error') {
          <button
            (click)="retry.emit()"
            class="rounded-md p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
            aria-label="{{ 'dashboard.widgetRetry' | transloco }}"
          >
            <span class="pi pi-refresh"></span>
          </button>
        }
      </div>

      @if (status() === 'loading') {
        <div class="h-8 w-24 rounded-md bg-[var(--color-surface-secondary)] animate-pulse"></div>
      } @else if (status() === 'empty') {
        <div class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span class="pi pi-info-circle text-[var(--color-text-muted)]"></span>
          {{ 'dashboard.noData' | transloco }}
        </div>
      } @else if (status() === 'error') {
        <div class="flex items-center gap-2 text-sm text-[var(--color-danger)]">
          <span class="pi pi-exclamation-triangle text-[var(--color-danger)]"></span>
          {{ 'dashboard.widgetError' | transloco }}
        </div>
      } @else {
        <div class="flex items-baseline gap-1">
          <span class="text-2xl font-semibold text-[var(--color-text)]">{{ value() }}</span>
          @if (delta() !== null && delta() !== undefined) {
            <span
              class="text-sm font-medium"
              [class.text-[var(--color-success)]]="deltaDirection() === 'up'"
              [class.text-[var(--color-danger)]]="deltaDirection() === 'down'"
            >
              {{
                deltaDirection() === 'up'
                  ? ('dashboard.deltaUp' | transloco: { value: delta() })
                  : ('dashboard.deltaDown' | transloco: { value: delta() })
              }}
            </span>
          }
        </div>
      }
    </div>
  `,
})
export class StatCardComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly icon = input<string>('pi pi-chart-bar');
  readonly delta = input<number | string | null>(null);
  readonly deltaDirection = input<'up' | 'down' | null>(null);
  readonly status = input<StatCardStatus>('ready');

  readonly retry = output<void>();
}
