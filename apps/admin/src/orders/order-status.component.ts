import { Component, DestroyRef, Inject, OnInit, inject, signal } from '@angular/core';

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
import { ADMIN_PERMISSIONS } from '../core/auth/admin-permissions';
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
  order = signal<any>(null);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  changing = false;

  statusForm: FormGroup;
  allowedNextStatuses: string[] = [];

  protected readonly permissions = ADMIN_PERMISSIONS;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly notification: NotificationService,
  ) {
    this.orderId = this.route.snapshot.paramMap.get('orderId');
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      note: [''],
    });
  }

  ngOnInit(): void {
    if (!this.orderId) {
      this.error.set('No order ID specified');
      return;
    }
    this.loadOrder();
  }

  loadOrder(): void {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.token;
    this.http
      .get<{ id: string; number: string; status: string }>(
        `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        catchError((err: any) => {
          this.error.set(err?.message ?? 'Failed to load order');
          return EMPTY;
        }),
        finalize(() => (this.loading.set(false))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          if (res) {
            this.order.set(res);
            this.orderNumber = res.number;
            const currentStatus = res.status;
            this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
            this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
          }
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(extractErrorMessage(err, 'Failed to load order'));
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error()!);
          }
        },
      });
  }

  changeStatus(): void {
    if (this.statusForm.invalid || !this.order()) return;
    this.changing = true;
    this.error.set(null);
    this.success.set(null);
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
          this.success.set(`Order status updated to ${value.status}`);
          this.order.set(res);
          this.orderNumber = res.number;
          const currentStatus = res.status;
          this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
          this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
          this.notification.success(NOTIFICATION_MESSAGES.order.statusUpdate);
        },
        error: (err) => {
          this.changing = false;
          this.error.set(extractErrorMessage(err, NOTIFICATION_MESSAGES.order.statusUpdateFailed));
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error()!);
          }
        },
      });
  }
}
