import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';

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
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

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
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './order-status.component.html',
})
export class OrderStatusComponent implements OnInit {
  orderId: string | null = null;
  orderNumber = '';
  order: any = null;

  loading = false;
  error: string | null = null;
  success: string | null = null;

  changing = false;

  statusForm: FormGroup;
  allowedNextStatuses: string[] = [];

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notification: NotificationService,
  ) {
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      note: [''],
    });
  }

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
    this.http
      .get<{ id: string; number: string; status: string }>(
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load order';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.order = res;
            this.orderNumber = res.number;
            const currentStatus = res.status;
            this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
            this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
          }
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load order');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
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
    this.http
      .patch(`${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}/status`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<{ id: string; number: string; status: string }>(
            `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
        finalize(() => (this.changing = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.success = `Order status updated to ${value.status}`;
          this.order = res;
          this.orderNumber = res.number;
          const currentStatus = res.status;
          this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
          this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
          this.notification.success(NOTIFICATION_MESSAGES.order.statusUpdate);
        },
        error: (err) => {
          this.changing = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.order.statusUpdateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
