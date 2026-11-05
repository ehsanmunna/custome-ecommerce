import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
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
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    <div class="p-4 max-w-[600px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/orders" class="text-[var(--color-primary)] underline">Orders</a> &gt; #{{ orderNumber }} &gt; Status
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Change Order Status</h1>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>
      <div *ngIf="success" class="text-[var(--color-success)] bg-[var(--color-success-foreground)]/10 p-2 rounded mb-4 border border-[var(--color-success)]/20">{{ success }}</div>

      <div *ngIf="order" class="border border-[var(--color-border)] rounded-md p-4 mb-4 bg-[var(--color-surface-secondary)]">
        <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Order #:</strong> {{ order.number }}</p>
        <p class="mb-1"><strong class="font-medium text-[var(--color-text-secondary)]">Current status:</strong> <span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ order.status }}</span></p>
      </div>

      <form [formGroup]="statusForm" (ngSubmit)="changeStatus()" *ngIf="order">
        <div class="mb-3">
          <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">New status</label>
          <select formControlName="status" class="w-full p-2 border border-[var(--color-border)] rounded-md">
            <option *ngFor="let s of allowedNextStatuses" [value]="s">{{ s }}</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Note (optional)</label>
          <input formControlName="note" placeholder="Reason for status change" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
        </div>
        <button type="submit" [disabled]="statusForm.invalid || changing" class="px-4 py-2 border-none rounded-md cursor-pointer opacity-60:cursor-not-allowed bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
          {{ changing ? 'Updating...' : 'Update Status' }}
        </button>
        <a routerLink="/orders" class="px-4 py-2 border-none rounded-md cursor-pointer border border-[var(--color-primary)] text-[var(--color-primary)] ml-2 hover:bg-[var(--color-primary)]/10">Back to orders</a>
      </form>
    </div>
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

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
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

  ngOnInit(): void {
    if (!this.orderId) {
      this.error = 'No order ID specified';
      return;
    }
    this.loadOrder();
  }

  loadOrder(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<{ id: string; number: string; status: string }>(
      `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load order';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        if (res) {
          this.order = res;
          this.orderNumber = res.number;
          const currentStatus = res.status;
          this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
          this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
        }
      }
    });
  }

  changeStatus(): void {
    if (this.statusForm.invalid || !this.order) return;
    this.changing = true;
    this.error = null;
    this.success = null;
    const token = this.auth.token;
    const value = this.statusForm.value;
    const body: { status: string; note?: string } = { status: value.status };
    if (value.note) body.note = value.note;
    this.http.patch(
      `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}/status`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<{ id: string; number: string; status: string }>(
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update order status';
        return EMPTY;
      }),
      finalize(() => this.changing = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.success = `Order status updated to ${value.status}`;
        this.order = res;
        this.orderNumber = res.number;
        const currentStatus = res.status;
        this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
        this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
      }
    });
  }
}

