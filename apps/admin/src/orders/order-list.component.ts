import { Component, inject, OnInit } from '@angular/core';
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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Orders
      </nav>

      <h1>Orders</h1>

      <div class="toolbar">
        <select [(ngModel)]="statusFilter">
          <option value="">All statuses</option>
          <option *ngFor="let s of orderStatuses">{{ s }}</option>
        </select>
        <input
          type="datetime-local"
          [(ngModel)]="createdFrom"
          placeholder="From"
        />
        <input
          type="datetime-local"
          [(ngModel)]="createdTo"
          placeholder="To"
        />
        <button (click)="loadOrders()">Filter</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="orders.length; else emptyState">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Total</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let o of orders">
            <td>{{ o.number }}</td>
            <td>{{ o.contactName }}</td>
            <td><span class="status {{ o.status }}">{{ o.status }}</span></td>
            <td>{{ (o.total.amount / 100).toFixed(2) }} {{ o.total.currency }}</td>
            <td>{{ o.createdAt }}</td>
            <td>
              <a [routerLink]="['/orders', o.id]" *ngIf="auth.hasPermission('orders.read')">View</a>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No orders found.</p>
      </ng-template>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1200px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .toolbar select, .toolbar input { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.pending { background: #e2e3e5; color: #383d41; }
    .status.confirmed { background: #cce5ff; color: #004085; }
    .status.processing { background: #fff3cd; color: #856404; }
    .status.shipped { background: #e2e3e5; color: #383d41; }
    .status.delivered { background: #d4edda; color: #155724; }
    .status.cancelled { background: #f8d7da; color: #721c24; }
    .status.returned { background: #f8d7da; color: #721c24; }
    .status.partially_delivered { background: #e2e3e5; color: #383d41; }
  `,
})
export class OrderListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly config: AdminAuthConfig;

  orders: Order[] = [];
  orderStatuses = ORDER_STATUSES;

  statusFilter = '';
  createdFrom = '';
  createdTo = '';

  loading = false;
  error: string | null = null;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    configOrInjector: AdminAuthConfig = inject(ADMIN_AUTH_CONFIG),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.config = configOrInjector;
  }

  async ngOnInit(): Promise<void> {
    await this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/admin/orders`);
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
