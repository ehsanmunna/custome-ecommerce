import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

export interface Order {
  id: string;
  number: string;
  customerId?: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  delivery: any;
  subtotal: { amount: number; currency: string };
  discount: { amount: number; currency: string };
  deliveryFee: { amount: number; currency: string };
  tax: { amount: number; currency: string };
  total: { amount: number; currency: string };
  items: Array<{
    variantId: string;
    productName: string;
    sku: string;
    attributes: Record<string, unknown>;
    quantity: number;
    unitPrice: { amount: number; currency: string };
    lineTotal: { amount: number; currency: string };
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

export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'partially_delivered',
] as const;

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1200px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Orders
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Orders</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <select [(ngModel)]="statusFilter" class="w-auto p-2 border border-[var(--color-border)] rounded-md">
          <option value="">All statuses</option>
          <option *ngFor="let s of orderStatuses">{{ s }}</option>
        </select>
        <input
          type="datetime-local"
          [(ngModel)]="createdFrom"
          placeholder="From"
          class="w-auto p-2 border border-[var(--color-border)] rounded-md" />
        <input
          type="datetime-local"
          [(ngModel)]="createdTo"
          placeholder="To"
          class="w-auto p-2 border border-[var(--color-border)] rounded-md" />
        <button (click)="loadOrders()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Filter</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="orders.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Order #</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Customer</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Total</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Date</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let o of orders">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ o.number }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ o.contactName }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ o.status }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ (o.total.amount / 100).toFixed(2) }} {{ o.total.currency }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ o.createdAt }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <a [routerLink]="['/orders', o.id]" *ngIf="auth.hasPermission('orders.read')" class="text-[var(--color-primary)] underline">View</a>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No orders found.</p>
      </ng-template>
    </div>
  `,
})
export class OrderListComponent implements OnInit {

  orders: Order[] = [];
  orderStatuses = ORDER_STATUSES;

  statusFilter = '';
  createdFrom = '';
  createdTo = '';

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
  }

  async ngOnInit(): Promise<void> {
    await this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/v1/admin/orders`);
      if (this.statusFilter) url.searchParams.set('status', this.statusFilter);
      if (this.createdFrom) url.searchParams.set('createdFrom', this.createdFrom);
      if (this.createdTo) url.searchParams.set('createdTo', this.createdTo);
      const res = await this.http.get<OrderPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.orders = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load orders';
    } finally {
      this.loading = false;
    }
  }
}

