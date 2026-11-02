import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase"
      [class]="severityClass()"
    >
      <span
        class="w-1.5 h-1.5 rounded-full"
        [class]="severityDotClass()"
      ></span>
      {{ label() | transloco }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly variant = input<StatusVariant>('neutral');

  private readonly severityMap: Record<StatusVariant, { bg: string; text: string; dot: string }> = {
    success: {
      bg: 'bg-[var(--color-success)]/10',
      text: 'text-[var(--color-success)]',
      dot: 'bg-[var(--color-success)]',
    },
    warning: {
      bg: 'bg-[var(--color-warning)]/10',
      text: 'text-[var(--color-warning)]',
      dot: 'bg-[var(--color-warning)]',
    },
    danger: {
      bg: 'bg-[var(--color-danger)]/10',
      text: 'text-[var(--color-danger)]',
      dot: 'bg-[var(--color-danger)]',
    },
    info: {
      bg: 'bg-[var(--color-info)]/10',
      text: 'text-[var(--color-info)]',
      dot: 'bg-[var(--color-info)]',
    },
    neutral: {
      bg: 'bg-[var(--color-muted)]/10',
      text: 'text-[var(--color-text-muted)]',
      dot: 'bg-[var(--color-text-muted)]',
    },
  };

  readonly severityClass = (): string => {
    const entry = this.severityMap[this.variant()];
    return `rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${entry.bg} ${entry.text}`;
  };

  readonly severityDotClass = (): string => {
    const entry = this.severityMap[this.variant()];
    return entry.dot;
  };

  readonly label = (): string => {
    const key = `status.orders.${this.status()}`;
    return key;
  };
}
