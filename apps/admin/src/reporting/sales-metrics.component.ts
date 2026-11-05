import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface AnalyticsOverview {
  orderCount: number;
  revenue: number;
  averageOrderValue: number;
}

@Component({
  selector: 'app-sales-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Sales Metrics
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Sales Metrics</h1>

      <div *ngIf="!auth.hasPermission('analytics.read')" class="text-[var(--color-danger)] mb-4">
        You do not have permission to view sales metrics.
      </div>

      <div *ngIf="auth.hasPermission('analytics.read')" class="flex gap-2 mb-4 items-center flex-wrap">
        <label class="flex items-center gap-1">
          <span class="text-sm font-medium text-[var(--color-text-secondary)]">From</span>
          <input type="datetime-local" [(ngModel)]="from" class="w-auto p-2 border border-[var(--color-border)] rounded-md ml-1" />
        </label>
        <label class="flex items-center gap-1">
          <span class="text-sm font-medium text-[var(--color-text-secondary)]">To</span>
          <input type="datetime-local" [(ngModel)]="to" class="w-auto p-2 border border-[var(--color-border)] rounded-md ml-1" />
        </label>
        <button (click)="loadOverview()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Load</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <div *ngIf="overview" class="flex gap-4">
        <div class="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface-secondary)] flex-1">
          <div class="text-[var(--color-text-muted)] text-xs font-medium mb-1">Total Orders</div>
          <div class="text-xl font-semibold text-[var(--color-text)]">{{ overview.orderCount }}</div>
        </div>
        <div class="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface-secondary)] flex-1">
          <div class="text-[var(--color-text-muted)] text-xs font-medium mb-1">Revenue</div>
          <div class="text-xl font-semibold text-[var(--color-text)]">{{ (overview.revenue / 100).toFixed(2) }} BDT</div>
        </div>
        <div class="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-surface-secondary)] flex-1">
          <div class="text-[var(--color-text-muted)] text-xs font-medium mb-1">Average Order Value</div>
          <div class="text-xl font-semibold text-[var(--color-text)]">{{ (overview.averageOrderValue / 100).toFixed(2) }} BDT</div>
        </div>
      </div>

      <div *ngIf="loading" class="text-[var(--color-text-muted)]">Loading...</div>
    </div>
  `,
})
export class SalesMetricsComponent implements OnInit {

  overview: AnalyticsOverview | null = null;

  loading = false;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  from = '';
  to = '';

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    this.from = start.toISOString().slice(0, 16);
    this.to = now.toISOString().slice(0, 16);
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = `${this.config.apiBaseUrl}/v1/admin/analytics/overview?from=${this.from}&to=${this.to}`;
    this.http.get<AnalyticsOverview>(url, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load sales metrics';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.overview = res ?? null;
      }
    });
  }
}

