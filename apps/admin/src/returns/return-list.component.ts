import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { AdminAuthConfig } from '../auth/auth.config';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface Return {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  refundTotal: { amount: number; currency: string };
  items: Array<{
    orderItemId: string;
    quantity: number;
    refundAmount: { amount: number; currency: string };
  }>;
  history: Array<{
    previousStatus?: string;
    status: string;
    actorAdminId?: string;
    note?: string;
    createdAt: string;
  }>;
  createdAt: string;
}

export interface ReturnPage {
  items: Return[];
  total: number;
  page: number;
  pageSize: number;
}

const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled'] as const;

@Component({
  selector: 'app-return-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Returns
      </nav>

      <h1>Return Requests</h1>

      <div class="toolbar">
        <select [(ngModel)]="statusFilter">
          <option value="">All statuses</option>
          <option *ngFor="let s of returnStatuses">{{ s }}</option>
        </select>
        <button (click)="loadReturns()">Filter</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="returns.length; else emptyState">
        <thead>
          <tr>
            <th>Return #</th>
            <th>Order</th>
            <th>Status</th>
            <th>Refund</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of returns">
            <td>{{ r.id }}</td>
            <td>{{ r.orderId }}</td>
            <td><span class="status {{ r.status }}">{{ r.status }}</span></td>
            <td>{{ (r.refundTotal.amount / 100).toFixed(2) }} {{ r.refundTotal.currency }}</td>
            <td>{{ r.createdAt }}</td>
            <td>
              <a [routerLink]="['/returns', r.id]" *ngIf="auth.hasPermission('orders.returns.read')">View</a>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No return requests found.</p>
      </ng-template>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .toolbar select { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.requested { background: #fff3cd; color: #856404; }
    .status.approved { background: #cce5ff; color: #004085; }
    .status.rejected { background: #f8d7da; color: #721c24; }
    .status.received { background: #e2e3e5; color: #383d41; }
    .status.refunded { background: #d4edda; color: #155724; }
    .status.cancelled { background: #f8d7da; color: #721c24; }
  `,
})
export class ReturnListComponent implements OnInit {

  returns: Return[] = [];
  returnStatuses = RETURN_STATUSES;

  statusFilter = '';

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
  }

  async ngOnInit(): Promise<void> {
    await this.loadReturns();
  }

  async loadReturns(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/v1/admin/returns`);
      if (this.statusFilter) url.searchParams.set('status', this.statusFilter);
      const res = await this.http.get<ReturnPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.returns = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load returns';
    } finally {
      this.loading = false;
    }
  }
}
