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

  zones: ShippingZone[] = [];

  loading = false;
  error: string | null = null;

  editingZone: ShippingZone | null = null;

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
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load shipping zones';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.zones = res?.items ?? [];
      }
    });
  }

  createZone(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
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
        this.error = err?.message ?? 'Failed to create shipping zone';
        return EMPTY;
      }),
      finalize(() => this.creating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeCreateModal();
        this.zones = res?.items ?? [];
      }
    });
  }

  updateZone(): void {
    if (!this.editingZone || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
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
        this.error = err?.message ?? 'Failed to update shipping zone';
        return EMPTY;
      }),
      finalize(() => this.updating = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.closeEditModal();
        this.zones = res?.items ?? [];
      }
    });
  }

  deleteZone(id: string): void {
    if (!confirm('Delete this shipping zone?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http.delete(`${this.config.apiBaseUrl}/v1/admin/shipping/zones/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to delete shipping zone';
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.zones = res?.items ?? [];
      }
    });
  }

  openCreateModal(): void {
    this.createForm.reset({ code: '', name: '', fee: 0, active: true });
    this.creating = true;
    this.error = null;
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
