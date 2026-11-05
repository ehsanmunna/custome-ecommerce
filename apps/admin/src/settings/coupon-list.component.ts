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
import { RouterLink } from '@angular/router';
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

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minimumOrder: number;
  startsAt: string;
  expiresAt: string;
  active: boolean;
}

export interface CouponPage {
  items: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-coupon-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './coupon-list.component.html',
})
export class CouponListComponent implements OnInit {

  coupons: Coupon[] = [];

  loading = false;
  error: string | null = null;

  editingCoupon: Coupon | null = null;

  creating = false;
  updating = false;
  createModal = false;
  editModal = false;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      code: ['', Validators.required],
      discountType: ['percentage', Validators.required],
      discountValue: [0, [Validators.required, Validators.min(0)]],
      minimumOrder: [0, Validators.required],
      startsAt: [''],
      expiresAt: [''],
      active: [true],
    });
    this.editForm = this.fb.group({
      code: ['', Validators.required],
      discountType: ['percentage', Validators.required],
      discountValue: [0, [Validators.required, Validators.min(0)]],
      minimumOrder: [0, Validators.required],
      startsAt: [''],
      expiresAt: [''],
      active: [true],
    });
  }

  ngOnInit(): void {
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<CouponPage>(`${this.config.apiBaseUrl}/v1/admin/coupons`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load coupons';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.coupons = res?.items ?? [];
      },
      error: (err) => {
        this.loading = false;
        this.error = extractErrorMessage(err, 'Failed to load coupons');
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      },
    });
  }

  createCoupon(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body = {
      code: value.code,
      discountType: value.discountType,
      discountValue: Math.round(parseFloat(value.discountValue)),
      minimumOrder: Math.round(parseFloat(value.minimumOrder) * 100),
      startsAt: value.startsAt,
      expiresAt: value.expiresAt,
      active: value.active === true || value.active === 'true',
    };
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/coupons`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CouponPage>(`${this.config.apiBaseUrl}/v1/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to create coupon';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.coupons = res?.items ?? [];
        this.notification.success(NOTIFICATION_MESSAGES.coupon.create);
      },
      error: (err) => {
        this.creating = false;
        this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.coupon.createFailed);
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      },
    });
  }

  updateCoupon(): void {
    if (!this.editingCoupon || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body = {
      code: value.code,
      discountType: value.discountType,
      discountValue: Math.round(parseFloat(value.discountValue)),
      minimumOrder: Math.round(parseFloat(value.minimumOrder) * 100),
      startsAt: value.startsAt,
      expiresAt: value.expiresAt,
      active: value.active === true || value.active === 'true',
    };
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/coupons/${this.editingCoupon.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CouponPage>(`${this.config.apiBaseUrl}/v1/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update coupon';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.coupons = res?.items ?? [];
        this.notification.success(NOTIFICATION_MESSAGES.coupon.update);
      },
      error: (err) => {
        this.updating = false;
        this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.coupon.updateFailed);
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      },
    });
  }

  deleteCoupon(id: string): void {
    if (!confirm('Delete this coupon?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/coupons/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<CouponPage>(`${this.config.apiBaseUrl}/v1/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete coupon';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.coupons = res?.items ?? [];
        this.notification.success(NOTIFICATION_MESSAGES.coupon.delete);
      },
      error: (err) => {
        this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.coupon.deleteFailed);
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      },
    });
  }

  openCreateModal(): void {
    this.createForm.reset({
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      minimumOrder: 0,
      startsAt: '',
      expiresAt: '',
      active: true,
    });
    this.creating = true;
    this.error = null;
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
    this.creating = false;
  }

  openEditModal(coupon: Coupon): void {
    this.editingCoupon = coupon;
    this.editForm.reset({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrder: coupon.minimumOrder,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      active: coupon.active,
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingCoupon = null;
  }
}
