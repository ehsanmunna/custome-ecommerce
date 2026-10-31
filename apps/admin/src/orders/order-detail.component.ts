import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

export interface OrderDetail {
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

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/orders">Orders</a> &gt; #{{ order?.number }}
      </nav>

      <h1>Order #{{ order?.number }}</h1>

      <div *ngIf="error" class="error">{{ error }}</div>

      <div *ngIf="order" class="order-detail">
        <div class="order-header">
          <div class="order-meta">
            <p><strong>Status:</strong> <span class="status {{ order.status }}">{{ order.status }}</span></p>
            <p><strong>Order date:</strong> {{ order.createdAt }}</p>
            <p><strong>Customer:</strong> {{ order.contactName }}</p>
            <p><strong>Email:</strong> {{ order.contactEmail || '-' }}</p>
            <p><strong>Phone:</strong> {{ order.contactPhone }}</p>
          </div>
          <div class="order-totals">
            <p><strong>Subtotal:</strong> {{ (order.subtotal.amount / 100).toFixed(2) }} {{ order.subtotal.currency }}</p>
            <p><strong>Discount:</strong> {{ (order.discount.amount / 100).toFixed(2) }} {{ order.discount.currency }}</p>
            <p><strong>Delivery fee:</strong> {{ (order.deliveryFee.amount / 100).toFixed(2) }} {{ order.deliveryFee.currency }}</p>
            <p><strong>Tax:</strong> {{ (order.tax.amount / 100).toFixed(2) }} {{ order.tax.currency }}</p>
            <p><strong>Total:</strong> {{ (order.total.amount / 100).toFixed(2) }} {{ order.total.currency }}</p>
          </div>
        </div>

        <div class="delivery-section">
          <h3>Delivery Address</h3>
          <p>{{ order.delivery?.name || '-' }}</p>
          <p>{{ order.delivery?.addressLine1 || '-' }}</p>
          <p>{{ order.delivery?.addressLine2 || '-' }}</p>
          <p>{{ order.delivery?.area || '' }} {{ order.delivery?.district || '' }}, {{ order.delivery?.division || '' }}</p>
          <p>{{ order.delivery?.postalCode || '-' }}, {{ order.delivery?.countryCode || 'BD' }}</p>
        </div>

        <div class="items-section">
          <h3>Items ({{ order.items.length }})</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of order.items">
                <td>{{ item.productName }}</td>
                <td>{{ item.sku }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ (item.unitPrice.amount / 100).toFixed(2) }} {{ item.unitPrice.currency }}</td>
                <td>{{ (item.lineTotal.amount / 100).toFixed(2) }} {{ item.lineTotal.currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="history-section">
          <h3>Lifecycle History</h3>
          <table *ngIf="order.history.length; else noHistory">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Note</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of order.history">
                <td>{{ h.previousStatus || '-' }}</td>
                <td>{{ h.status }}</td>
                <td>{{ h.note || '-' }}</td>
                <td>{{ h.createdAt }}</td>
              </tr>
            </tbody>
          </table>
          <ng-template #noHistory>
            <p>No history entries.</p>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .order-detail { display: flex; gap: 2rem; flex-wrap: wrap; }
    .order-header { flex: 1; min-width: 300px; }
    .order-meta, .order-totals { margin-bottom: 1rem; }
    .order-meta p, .order-totals p { margin: 0.25rem 0; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.pending { background: #e2e3e5; color: #383d41; }
    .status.confirmed { background: #cce5ff; color: #004085; }
    .status.processing { background: #fff3cd; color: #856404; }
    .status.shipped { background: #e2e3e5; color: #383d41; }
    .status.delivered { background: #d4edda; color: #155724; }
    .status.cancelled { background: #f8d7da; color: #721c24; }
    .status.returned { background: #f8d7da; color: #721c24; }
    .status.partially_delivered { background: #e2e3e5; color: #383d41; }
    .delivery-section, .items-section, .history-section { flex: 1; min-width: 300px; margin-bottom: 1rem; }
    .delivery-section h3, .items-section h3, .history-section h3 { margin-top: 0; border-bottom: 1px solid #ddd; padding-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; font-size: 0.9rem; }
    th { background: #f5f5f5; }
    a { color: #007bff; text-decoration: none; }
  `,
})
export class OrderDetailComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly config: AdminAuthConfig;
  private readonly route: ActivatedRoute;

  orderId = '';
  order: OrderDetail | null = null;

  loading = false;
  error: string | null = null;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    configOrInjector: AdminAuthConfig = inject(ADMIN_AUTH_CONFIG),
    routeOrInjector: ActivatedRoute = inject(ActivatedRoute),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.config = configOrInjector;
    this.route = routeOrInjector;
    this.orderId = this.route.snapshot.paramMap.get('orderId') || '';
  }

  async ngOnInit(): Promise<void> {
    if (!this.orderId) {
      this.error = 'No order ID specified';
      return;
    }
    await this.loadOrder();
  }

  async loadOrder(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<OrderDetail>(
        `${this.config.apiBaseUrl}/admin/orders/${this.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.order = res ?? null;
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load order';
    } finally {
      this.loading = false;
    }
  }
}
