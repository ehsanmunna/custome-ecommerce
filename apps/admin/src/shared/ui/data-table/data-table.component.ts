import { Component, input, output } from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';

export interface DataTableColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      @if (status() === 'loading') {
        <div class="p-4 text-center">
          <div
            class="h-8 w-32 rounded-md bg-[var(--color-surface-secondary)] animate-pulse mx-auto"
          ></div>
          <p class="mt-2 text-sm text-[var(--color-text-muted)]">
            {{ 'common.loading' | transloco }}
          </p>
        </div>
      } @else if (status() === 'empty') {
        <div class="p-8 text-center">
          <p class="text-sm text-[var(--color-text-muted)]">{{ emptyMessage | transloco }}</p>
        </div>
      } @else if (status() === 'error') {
        <div class="p-4 text-center">
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
      } @else {
        <table class="w-full border-collapse text-left">
          <thead>
            <tr>
              @for (column of columns(); track column.key) {
                <th
                  class="border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
                >
                  {{ column.label | transloco }}
                </th>
              }
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            @for (row of data(); track row.id) {
              <tr class="hover:bg-[var(--color-surface-secondary)]/50 transition-colors">
                @for (column of columns(); track column.key) {
                  <td class="px-3 py-2 text-sm text-[var(--color-text)]">
                    {{ formatValue(column, row) }}
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
})
export class DataTableComponent<T = unknown> {
  readonly columns = input.required<DataTableColumn[]>();
  readonly data = input.required<T[]>();
  readonly status = input<'loading' | 'ready' | 'empty' | 'error'>('ready');
  readonly emptyMessage = input<string>('common.table.empty');

  readonly retry = output<void>();

  formatValue(column: DataTableColumn, row: T): string {
    const value = (row as Record<string, unknown>)[column.key];
    if (column.format) {
      return column.format(value);
    }
    return String(value ?? '');
  }
}
