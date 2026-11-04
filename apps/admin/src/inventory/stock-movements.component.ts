import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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

export interface MovementLedgerEntry {
  id: string;
  variantId: string;
  type: 'adjustment' | 'reservation' | 'release' | 'commit';
  quantity: number;
  reason?: string;
  status: string;
  createdAt?: string;
}

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/inventory" class="text-[var(--color-primary)] underline">Inventory</a> &gt; Stock Movements
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Stock Movements Ledger</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="loadMovements()" class="px-4 py-2 border-none rounded-md cursor-pointer border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">Refresh</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <p class="text-[var(--color-text-muted)] text-sm italic mb-4">
        Note: Stock adjustments (write-only via API) and reservation lifecycle events are shown here.
        A dedicated movements read endpoint is not yet available in the API contract.
      </p>

      <table *ngIf="movements.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Variant ID</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Type</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Quantity</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of movements">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ m.variantId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)] uppercase">{{ m.type }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ m.quantity }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left"><span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]">{{ m.status }}</span></td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ m.reason || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No stock movements found.</p>
      </ng-template>
    </div>
  `,
})
export class StockMovementsComponent implements OnInit {

  movements: MovementLedgerEntry[] = [];

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
  }

  async ngOnInit(): Promise<void> {
    await this.loadMovements();
  }

  async loadMovements(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = (await this.http.get<{ items: Reservation[] }>(
        `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
        { headers: { Authorization: `Bearer ${token}` } },
      )) as unknown as { items: Reservation[] };
      const reservations = res?.items ?? [];
      this.movements = reservations.map((r) => ({
        id: r.id,
        variantId: r.variantId,
        type: this.mapType(r.status),
        quantity: r.quantity,
        reason: r.source,
        status: r.status,
        createdAt: r.expiresAt,
      }));
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load stock movements';
    } finally {
      this.loading = false;
    }
  }

  private mapType(status: string): MovementLedgerEntry['type'] {
    switch (status) {
      case 'active': return 'reservation';
      case 'released': return 'release';
      case 'committed': return 'commit';
      case 'expired': return 'release';
      default: return 'reservation';
    }
  }
}

