import { Component, Inject, OnInit } from '@angular/core';
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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/orders" class="text-[var(--color-primary)] underline">Orders</a> &gt; #{{ order?.number }}
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Order #{{ order?.number }}</h1>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <div *ngIf="order" class="flex gap-8 flex-wrap">
        <div class="flex-1 min-w-[300px]">
          <div class="mb-1">
            <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Status:</p>
            <span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ order.status }}</span>
          </div>
          <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Order date:</strong> {{ order.createdAt }}</p>
          <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Customer:</strong> {{ order.contactName }}</p>
          <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Email:</strong> {{ order.contactEmail || '-' }}</p>
          <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Phone:</strong> {{ order.contactPhone }}</p>
        </div>
        <div class="flex-1 min-w-[300px]">
          <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Subtotal:</p>
          <p class="mb-1">{{ (order.subtotal.amount / 100).toFixed(2) }} {{ order.subtotal.currency }}</p>
          <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Discount:</p>
          <p class="mb-1">{{ (order.discount.amount / 100).toFixed(2) }} {{ order.discount.currency }}</p>
          <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Delivery fee:</p>
          <p class="mb-1">{{ (order.deliveryFee.amount / 100).toFixed(2) }} {{ order.deliveryFee.currency }}</p>
          <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Tax:</p>
          <p class="mb-1">{{ (order.tax.amount / 100).toFixed(2) }} {{ order.tax.currency }}</p>
          <p class="font-medium text-sm text-[var(--color-text-secondary)] mb-1">Total:</p>
          <p class="mb-1">{{ (order.total.amount / 100).toFixed(2) }} {{ order.total.currency }}</p>
        </div>
        <div class="flex-1 min-w-[300px] mb-4">
          <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-1">Delivery Address</h3>
          <p class="text-[var(--color-text-muted)]">{{ order.delivery?.name || '-' }}</p>
          <p class="text-[var(--color-text-muted)]">{{ order.delivery?.addressLine1 || '-' }}</p>
          <p class="text-[var(--color-text-muted)]">{{ order.delivery?.addressLine2 || '-' }}</p>
          <p class="text-[var(--color-text-muted)]">{{ order.delivery?.area || '' }} {{ order.delivery?.district || '' }}, {{ order.delivery?.division || '' }}</p>
          <p class="text-[var(--color-text-muted)]">{{ order.delivery?.postalCode || '-' }}, {{ order.delivery?.countryCode || 'BD' }}</p>
        </div>
        <div class="flex-1 min-w-[300px] mb-4">
          <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-1">Items ({{ order.items.length }})</h3>
          <table class="w-full border-collapse mt-1">
            <thead>
              <tr>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Product</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">SKU</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Qty</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Unit Price</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of order.items">
                <td class="border border-[var(--color-border)] p-2 text-left">{{ item.productName }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ item.sku }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ item.quantity }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ (item.unitPrice.amount / 100).toFixed(2) }} {{ item.unitPrice.currency }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ (item.lineTotal.amount / 100).toFixed(2) }} {{ item.lineTotal.currency }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex-1 min-w-[300px] mb-4">
          <h3 class="mt-0 text-lg font-semibold text-[var(--color-text)] border-b border-[var(--color-border)] pb-1">Lifecycle History</h3>
          <table *ngIf="order.history.length; else noHistory" class="w-full border-collapse mt-1">
            <thead>
              <tr>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">From</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">To</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Note</th>
                <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)] text-xs">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of order.history">
                <td class="border border-[var(--color-border)] p-2 text-left">{{ h.previousStatus || '-' }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ h.status }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ h.note || '-' }}</td>
                <td class="border border-[var(--color-border)] p-2 text-left">{{ h.createdAt }}</td>
              </tr>
            </tbody>
          </table>
          <ng-template #noHistory>
            <p class="text-[var(--color-text-muted)]">No history entries.</p>
          </ng-template>
        </div>
      </div>
    </div>
  `,
})
export class OrderDetailComponent implements OnInit {

  orderId = '';
  order: OrderDetail | null = null;

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
  ) {
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
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
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
