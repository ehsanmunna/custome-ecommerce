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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Returns
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Return Requests</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <select [(ngModel)]="statusFilter" class="w-auto p-2 border border-[var(--color-border)] rounded-md">
          <option value="">All statuses</option>
          <option *ngFor="let s of returnStatuses">{{ s }}</option>
        </select>
        <button (click)="loadReturns()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Filter</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="returns.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Return #</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Order</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Refund</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Date</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of returns">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.id }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.orderId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ r.status }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ (r.refundTotal.amount / 100).toFixed(2) }} {{ r.refundTotal.currency }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.createdAt }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <a [routerLink]="['/returns', r.id]" *ngIf="auth.hasPermission('orders.returns.read')" class="text-[var(--color-primary)] underline">View</a>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No return requests found.</p>
      </ng-template>
    </div>
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
    @Inject(AuthService) readonly auth: AuthService,
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

