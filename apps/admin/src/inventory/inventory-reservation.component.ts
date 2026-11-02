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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/inventory" class="text-[var(--color-primary)] underline">Inventory</a> &gt; Reservations
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Stock Reservations</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="loadReservations()" class="px-4 py-2 border-none rounded-md cursor-pointer border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">Refresh</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>
      <div *ngIf="success" class="text-[var(--color-success)] bg-[var(--color-success-foreground)]/10 p-2 rounded mb-4 border border-[var(--color-success)]/20">{{ success }}</div>

      <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Reservation</h2>
      <form [formGroup]="createForm" (ngSubmit)="createReservation()" class="flex gap-2 mb-6 items-end flex-wrap">
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm text-[var(--color-text-secondary)]">Variant ID</label>
          <input formControlName="variantId" placeholder="Variant UUID" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm text-[var(--color-text-secondary)]">Quantity</label>
          <input type="number" formControlName="quantity" min="1" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="font-medium text-sm text-[var(--color-text-secondary)]">Expires At (optional)</label>
          <input type="datetime-local" formControlName="expiresAt" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
        </div>
        <button type="submit" [disabled]="createForm.invalid || creating || !auth.hasPermission('inventory.adjust')" class="px-4 py-2 border-none rounded-md cursor-pointer opacity-60:cursor-not-allowed bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create Reservation</button>
      </form>

      <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Existing Reservations</h2>
      <table *ngIf="reservations.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">ID</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Variant ID</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Quantity</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Source</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Expires At</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of reservations" [class.bg-yellow-50]="processingId === r.id">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.id }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.variantId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.quantity }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ r.status }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.source || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ r.expiresAt || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button
                *ngIf="r.status === 'active' && auth.hasPermission('inventory.adjust')"
                (click)="releaseReservation(r.id)"
                [disabled]="processingId === r.id"
                class="px-4 py-2 border-none rounded-md cursor-pointer opacity-60:cursor-not-allowed bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              >
                Release
              </button>
              <button
                *ngIf="r.status === 'active' && auth.hasPermission('inventory.adjust')"
                (click)="commitReservation(r.id)"
                [disabled]="processingId === r.id"
                class="px-4 py-2 border-none rounded-md cursor-pointer opacity-60:cursor-not-allowed ml-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              >
                Commit
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No reservations found.</p>
      </ng-template>
    </div>
  `,
})
export class InventoryReservationComponent implements OnInit {

  reservations: Reservation[] = [];

  loading = false;
  creating = false;
  processingId: string | null = null;
  error: string | null = null;
  success: string | null = null;

  createForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
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
      const res = await this.http.get<ReservationPage>(`${this.config.apiBaseUrl}/v1/admin/inventory/reservations`, {
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
        `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
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
        `${this.config.apiBaseUrl}/v1/admin/inventory/reservations/${reservationId}/status`,
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

