import { Component, inject, OnInit } from '@angular/core';
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
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/inventory">Inventory</a> &gt; Reservations
      </nav>

      <h1>Stock Reservations</h1>

      <div class="toolbar">
        <button (click)="loadReservations()" class="secondary">Refresh</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>
      <div *ngIf="success" class="success">{{ success }}</div>

      <h2>Create Reservation</h2>
      <form [formGroup]="createForm" (ngSubmit)="createReservation()" class="create-form">
        <div class="field">
          <label>Variant ID</label>
          <input formControlName="variantId" placeholder="Variant UUID" />
        </div>
        <div class="field">
          <label>Quantity</label>
          <input type="number" formControlName="quantity" min="1" />
        </div>
        <div class="field">
          <label>Expires At (optional)</label>
          <input type="datetime-local" formControlName="expiresAt" />
        </div>
        <button type="submit" [disabled]="createForm.invalid || creating || !auth.hasPermission('inventory.adjust')">Create Reservation</button>
      </form>

      <h2>Existing Reservations</h2>
      <table *ngIf="reservations.length; else emptyState">
        <thead>
          <tr>
            <th>ID</th>
            <th>Variant ID</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Source</th>
            <th>Expires At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of reservations" [class.processing]="processingId === r.id">
            <td>{{ r.id }}</td>
            <td>{{ r.variantId }}</td>
            <td>{{ r.quantity }}</td>
            <td><span class="status {{ r.status }}">{{ r.status }}</span></td>
            <td>{{ r.source || '-' }}</td>
            <td>{{ r.expiresAt || '-' }}</td>
            <td>
              <button
                *ngIf="r.status === 'active' && auth.hasPermission('inventory.adjust')"
                (click)="releaseReservation(r.id)"
                [disabled]="processingId === r.id"
              >
                Release
              </button>
              <button
                *ngIf="r.status === 'active' && auth.hasPermission('inventory.adjust')"
                (click)="commitReservation(r.id)"
                [disabled]="processingId === r.id"
              >
                Commit
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No reservations found.</p>
      </ng-template>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1, h2 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .secondary { background: transparent; color: #007bff; border: 1px solid #007bff; }
    .create-form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: flex-end; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .success { color: #155724; background: #d4edda; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.active { background: #d4edda; color: #155724; }
    .status.released { background: #e2e3e5; color: #383d41; }
    .status.committed { background: #cce5ff; color: #004085; }
    .status.expired { background: #f8d7da; color: #721c24; }
    tr.processing { background: #fff3cd; }
    .field { display: flex; flex-direction: column; gap: 0.25rem; }
    .field label { font-size: 0.9rem; font-weight: 500; }
    .field input { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }
  `,
})
export class InventoryReservationComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: AdminAuthConfig;

  reservations: Reservation[] = [];

  loading = false;
  creating = false;
  processingId: string | null = null;
  error: string | null = null;
  success: string | null = null;

  createForm: FormGroup;

  constructor(
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    fbOrInjector: FormBuilder = inject(FormBuilder),
    configOrInjector: AdminAuthConfig = inject(ADMIN_AUTH_CONFIG),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.fb = fbOrInjector;
    this.config = configOrInjector;
    this.createForm = this.fb.group({
      variantId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      expiresAt: [''],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadReservations();
  }

  async loadReservations(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<ReservationPage>(`${this.config.apiBaseUrl}/admin/inventory/reservations`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.reservations = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load reservations';
    } finally {
      this.loading = false;
    }
  }

  async createReservation(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    this.success = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body: ReservationInput = {
        variantId: value.variantId,
        quantity: value.quantity,
      };
      if (value.expiresAt) {
        body.expiresAt = value.expiresAt;
      }
      await this.http.post(
        `${this.config.apiBaseUrl}/admin/inventory/reservations`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();

      this.createForm.reset({ variantId: '', quantity: 1, expiresAt: '' });
      await this.loadReservations();
      this.success = 'Reservation created';
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create reservation';
    } finally {
      this.creating = false;
    }
  }

  async releaseReservation(reservationId: string): Promise<void> {
    await this.updateReservationStatus(reservationId, 'released');
  }

  async commitReservation(reservationId: string): Promise<void> {
    await this.updateReservationStatus(reservationId, 'committed');
  }

  private async updateReservationStatus(reservationId: string, status: string): Promise<void> {
    this.processingId = reservationId;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.patch(
        `${this.config.apiBaseUrl}/admin/inventory/reservations/${reservationId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();
      this.success = `Reservation ${status}`;
      await this.loadReservations();
    } catch (err: any) {
      this.error = err?.message ?? `Failed to ${status} reservation`;
    } finally {
      this.processingId = null;
    }
  }
}
