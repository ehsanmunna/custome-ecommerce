import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface PageBreadcrumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="page-header">
      <nav
        class="page-header-breadcrumb mb-4 text-sm text-[var(--color-text-muted)]"
        aria-label="Breadcrumb"
      >
        @for (crumb of breadcrumbs; track $index) {
          @if (crumb.link) {
            <a [routerLink]="crumb.link" class="text-[var(--color-primary)] underline">{{
              crumb.label
            }}</a>
          } @else {
            <span>{{ crumb.label }}</span>
          }
          @if (!$last) {
            <span class="mx-1">&gt;</span>
          }
        }
      </nav>

      <div class="page-header-row mb-4 flex items-start justify-between gap-4">
        <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">{{ title }}</h1>
        <div class="page-header-actions flex items-center gap-2">
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() breadcrumbs: PageBreadcrumb[] = [];
}
