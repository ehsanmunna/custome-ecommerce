import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';

import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

export interface Reservation {
  id: string;
  variantId: string;
  quantity: number;
  status: string;
  source?: string;
  sourceId?: string;
  expiresAt?: string;
}

export interface ReservationPage {
  items: Reservation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReservationInput {
  variantId: string;
  quantity: number;
  expiresAt?: string;
}

@Component({
  selector: 'app-inventory-reservation',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './inventory-reservation.component.html',
})
export class InventoryReservationComponent implements OnInit {
  reservations: Reservation[] = [];

  loading = false;
  creating = false;
  processingId: string | null = null;
  error: string | null = null;
  success: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      variantId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      expiresAt: [''],
    });
  }

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.loading = true;
    this.error = null;
    this.success = null;
    const token = this.auth.token;
    this.http
      .get<ReservationPage>(`${this.config.apiBaseUrl}/v1/admin/inventory/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load reservations';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.reservations = res?.items ?? [];
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load reservations');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  createReservation(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    this.success = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body: ReservationInput = {
      variantId: value.variantId,
      quantity: value.quantity,
    };
    if (value.expiresAt) {
      body.expiresAt = value.expiresAt;
    }
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/inventory/reservations`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<ReservationPage>(
            `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ),
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.createForm.reset({ variantId: '', quantity: 1, expiresAt: '' });
          this.reservations = res?.items ?? [];
          this.success = 'Reservation created';
          this.notification.success(NOTIFICATION_MESSAGES.inventory.reservationCreate);
        },
        error: (err) => {
          this.creating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.inventory.reservationCreateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  releaseReservation(reservationId: string): void {
    this.updateReservationStatus(reservationId, 'released');
  }

  commitReservation(reservationId: string): void {
    this.updateReservationStatus(reservationId, 'committed');
  }

  private updateReservationStatus(reservationId: string, status: string): void {
    this.processingId = reservationId;
    this.error = null;
    const token = this.auth.token;
    this.http
      .patch(
        `${this.config.apiBaseUrl}/v1/admin/inventory/reservations/${reservationId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .pipe(
        switchMap(() =>
          this.http.get<ReservationPage>(
            `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ),
        finalize(() => (this.processingId = null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.success = `Reservation ${status}`;
          this.reservations = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.inventory.reservationUpdate);
        },
        error: (err) => {
          this.processingId = null;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.inventory.reservationUpdateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
