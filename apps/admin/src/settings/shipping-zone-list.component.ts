import { Component, DestroyRef, Inject, OnInit, inject, signal } from '@angular/core';
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
import { ADMIN_PERMISSIONS } from '../core/auth/admin-permissions';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

export interface ShippingZone {
  id: string;
  code: string;
  name: string;
  fee: number;
  active: boolean;
  districts: string[];
}

export interface ShippingZonePage {
  items: ShippingZone[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-shipping-zone-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './shipping-zone-list.component.html',
})
export class ShippingZoneListComponent implements OnInit {

  zones = signal<ShippingZone[]>([]);

  loading = signal(false);
  error = signal<string | null>(null);

  editingZone: ShippingZone | null = null;

  creating = false;
  updating = false;
  createModal = false;
  editModal = false;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  protected readonly permissions = ADMIN_PERMISSIONS;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      fee: [0, [Validators.required, Validators.min(0)]],
      active: [true, Validators.required],
    });
    this.editForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      fee: [0, [Validators.required, Validators.min(0)]],
      active: [true, Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadZones();
  }

  loadZones(): void {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.token;
    this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error.set(err?.message ?? 'Failed to load shipping zones');
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.zones.set(res?.items ?? []);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractErrorMessage(err, 'Failed to load shipping zones'));
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error()!);
        }
      },
    });
  }

  createZone(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error.set(null);
    const token = this.auth.token;
    const value = this.createForm.value;
    const body = {
      code: value.code,
      name: value.name,
      fee: Math.round(parseFloat(value.fee) * 100),
      active: value.active === true || value.active === 'true',
    };
    this.http.post(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error.set(err?.message ?? 'Failed to create shipping zone');
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.zones.set(res?.items ?? []);
        this.notification.success(NOTIFICATION_MESSAGES.shippingZone.create);
      },
      error: (err) => {
        this.creating = false;
        this.error.set(extractErrorMessage(err, NOTIFICATION_MESSAGES.shippingZone.createFailed));
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error()!);
        }
      },
    });
  }

  updateZone(): void {
    if (!this.editingZone || this.editForm.invalid) return;
    this.updating = true;
    this.error.set(null);
    const token = this.auth.token;
    const value = this.editForm.value;
    const body = {
      code: value.code,
      name: value.name,
      fee: Math.round(parseFloat(value.fee) * 100),
      active: value.active === true || value.active === 'true',
    };
    this.http.patch(`${this.config.apiBaseUrl}/v1/admin/shipping/zones/${this.editingZone.id}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error.set(err?.message ?? 'Failed to update shipping zone');
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.zones.set(res?.items ?? []);
        this.notification.success(NOTIFICATION_MESSAGES.shippingZone.update);
      },
      error: (err) => {
        this.updating = false;
        this.error.set(extractErrorMessage(err, NOTIFICATION_MESSAGES.shippingZone.updateFailed));
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error()!);
        }
      },
    });
  }

  deleteZone(id: string): void {
    if (!confirm('Delete this shipping zone?')) return;
    this.error.set(null);
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/shipping/zones/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error.set(err?.message ?? 'Failed to delete shipping zone');
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.zones.set(res?.items ?? []);
        this.notification.success(NOTIFICATION_MESSAGES.shippingZone.delete);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, NOTIFICATION_MESSAGES.shippingZone.deleteFailed));
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error()!);
        }
      },
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ code: '', name: '', fee: 0, active: true });
    this.creating = true;
    this.error.set(null);
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
    this.creating = false;
  }

  openEditModal(zone: ShippingZone): void {
    this.editingZone = zone;
    this.editForm.reset({
      code: zone.code,
      name: zone.name,
      fee: zone.fee / 100,
      active: zone.active,
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingZone = null;
  }
}

