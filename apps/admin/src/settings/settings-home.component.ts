import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-settings-home',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  template: `
    <div class="mx-auto max-w-[1200px] p-4">
      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">
        {{ 'menu.settings' | transloco }}
      </h1>
      <p class="mb-6 mt-2 text-sm text-[var(--color-text-muted)]">
        {{ 'dashboard.subtitle' | transloco }}
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a
          routerLink="/settings/shipping-zones"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-truck text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.shippingZones' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Manage shipping zones and rates.
          </p>
        </a>
        <a
          routerLink="/settings/coupons"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-ticket text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.coupons' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Create and manage discount coupons.
          </p>
        </a>
        <a
          routerLink="/cms/pages"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-file text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.cmsPages' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Manage CMS pages and content.
          </p>
        </a>
        <a
          routerLink="/cms/banners"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-image text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.cmsBanners' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Manage homepage banners and promos.
          </p>
        </a>
        <a
          routerLink="/reports/sales"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-chart-line text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.salesReport' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            View sales metrics and reports.
          </p>
        </a>
        <a
          routerLink="/reports/low-stock"
          routerLinkActive="bg-[var(--color-primary)]/10"
          class="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <div class="mb-2 text-[var(--color-primary)]">
            <span class="pi pi-exclamation-triangle text-xl"></span>
          </div>
          <h3 class="mb-1 text-sm font-semibold text-[var(--color-text)]">
            {{ 'menu.lowStockReport' | transloco }}
          </h3>
          <p class="text-xs text-[var(--color-text-muted)]">
            Monitor low-stock inventory items.
          </p>
        </a>
      </div>
    </div>
  `,
})
export class SettingsHomeComponent {}
