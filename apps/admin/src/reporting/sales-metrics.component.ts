import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface AnalyticsOverview {
  orderCount: number;
  revenue: { amount: number; currency: string };
  averageOrderValue: { amount: number; currency: string };
}

@Component({
  selector: 'app-sales-metrics',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Sales Metrics
      </nav>

      <h1>Sales Metrics</h1>

      <div *ngIf="!auth.hasPermission('analytics.read')" class="error">
        You do not have permission to view sales metrics.
      </div>

      <div *ngIf="auth.hasPermission('analytics.read')" class="toolbar">
        <label>
          From
          <input type="datetime-local" [(ngModel)]="from" />
        </label>
        <label>
          To
          <input type="datetime-local" [(ngModel)]="to" />
        </label>
        <button (click)="loadOverview()">Load</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="overview" class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Orders</div>
          <div class="metric-value">{{ overview.orderCount }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Revenue</div>
          <div class="metric-value">{{ (overview.revenue.amount / 100).toFixed(2) }} {{ overview.revenue.currency }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Average Order Value</div>
          <div class="metric-value">{{ (overview.averageOrderValue.amount / 100).toFixed(2) }} {{ overview.averageOrderValue.currency }}</div>
        </div>
      </div>

      <div *ngIf="loading">Loading...</div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .toolbar label { font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 0.25rem; }
    .toolbar input { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .metrics-grid { display: flex; gap: 1rem; }
    .metric-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; flex: 1; background: #fafafa; }
    .metric-label { font-size: 0.85rem; color: #666; margin-bottom: 0.5rem; }
    .metric-value { font-size: 1.5rem; font-weight: 600; color: #333; }
  `,
})
export class SalesMetricsComponent implements OnInit {

  overview: AnalyticsOverview | null = null;

  loading = false;
  error: string | null = null;

  from = '';
  to = '';

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {}

  async ngOnInit(): Promise<void> {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    this.from = start.toISOString().slice(0, 16);
    this.to = now.toISOString().slice(0, 16);
    await this.loadOverview();
  }

  async loadOverview(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = `${this.config.apiBaseUrl}/v1/admin/analytics/overview?from=${this.from}&to=${this.to}`;
      const res = await this.http.get<AnalyticsOverview>(url, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.overview = res ?? null;
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load sales metrics';
    } finally {
      this.loading = false;
    }
  }
}
