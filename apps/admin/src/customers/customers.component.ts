import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div class="mx-auto max-w-[1200px] p-4">
      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">
        {{ 'menu.customers' | transloco }}
      </h1>
      <p class="mb-6 mt-2 text-sm text-[var(--color-text-muted)]">
        {{ 'common.noData' | transloco }}
      </p>
      <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
        <p class="mb-4 text-sm text-[var(--color-text-secondary)]">
          {{ 'dashboard.noRecentOrders' | transloco }}
        </p>
      </div>
    </div>
  `,
})
export class CustomersComponent {}
