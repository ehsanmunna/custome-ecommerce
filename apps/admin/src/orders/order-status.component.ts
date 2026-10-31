import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'partially_delivered'],
  partially_delivered: ['delivered'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

@Component({
  selector: 'app-order-status',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/orders">Orders</a> &gt; #{{ orderNumber }} &gt; Status
      </nav>

      <h1>Change Order Status</h1>

      <div *ngIf="error" class="error">{{ error }}</div>
      <div *ngIf="success" class="success">{{ success }}</div>

      <div *ngIf="order" class="order-card">
        <p><strong>Order #:</strong> {{ order.number }}</p>
        <p><strong>Current status:</strong> <span class="status {{ order.status }}">{{ order.status }}</span></p>
      </div>

      <form [formGroup]="statusForm" (ngSubmit)="changeStatus()" *ngIf="order">
        <div class="field">
          <label>New status</label>
          <select formControlName="status">
            <option *ngFor="let s of allowedNextStatuses" [value]="s">{{ s }}</option>
          </select>
        </div>
        <div class="field">
          <label>Note (optional)</label>
          <input formControlName="note" placeholder="Reason for status change" />
        </div>
        <button type="submit" [disabled]="statusForm.invalid || changing">{{ changing ? 'Updating...' : 'Update Status' }}</button>
        <a routerLink="/orders" class="secondary">Back to orders</a>
      </form>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 600px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .success { color: #155724; background: #d4edda; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }
    .order-card { border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f8f9fa; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.pending { background: #e2e3e5; color: #383d41; }
    .status.confirmed { background: #cce5ff; color: #004085; }
    .status.processing { background: #fff3cd; color: #856404; }
    .status.shipped { background: #e2e3e5; color: #383d41; }
    .status.delivered { background: #d4edda; color: #155724; }
    .status.cancelled { background: #f8d7da; color: #721c24; }
    .status.returned { background: #f8d7da; color: #721c24; }
    .status.partially_delivered { background: #e2e3e5; color: #383d41; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field select, .field input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .secondary { background: transparent; color: #007bff; border: 1px solid #007bff; margin-left: 0.5rem; }
  `,
})
export class OrderStatusComponent implements OnInit {

  orderId = '';
  order: { id: string; number: string; status: string } | null = null;

  statusForm: FormGroup;
  allowedNextStatuses: string[] = [];

  loading = false;
  changing = false;
  error: string | null = null;
  success: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
    @Inject(Router) private readonly router: Router,
  ) {
    this.orderId = this.route.snapshot.paramMap.get('orderId') || '';
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      note: [''],
    });
  }

  orderNumber = '';

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
      const res = await this.http.get<{ id: string; number: string; status: string }>(
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      if (res) {
        this.order = res;
        this.orderNumber = res.number;
        const currentStatus = res.status;
        this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
        this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load order';
    } finally {
      this.loading = false;
    }
  }

  async changeStatus(): Promise<void> {
    if (this.statusForm.invalid || !this.order) return;
    this.changing = true;
    this.error = null;
    this.success = null;
    try {
      const token = this.auth.token;
      const value = this.statusForm.value;
      const body: { status: string; note?: string } = { status: value.status };
      if (value.note) body.note = value.note;
      await this.http.patch(
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}/status`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.success = `Order status updated to ${value.status}`;
      await this.loadOrder();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update order status';
    } finally {
      this.changing = false;
    }
  }
}
