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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/inventory">Inventory</a> &gt; Stock Movements
      </nav>

      <h1>Stock Movements Ledger</h1>

      <div class="toolbar">
        <button (click)="loadMovements()" class="secondary">Refresh</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <p class="note">
        Note: Stock adjustments (write-only via API) and reservation lifecycle events are shown here.
        A dedicated movements read endpoint is not yet available in the API contract.
      </p>

      <table *ngIf="movements.length; else emptyState">
        <thead>
          <tr>
            <th>Variant ID</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of movements">
            <td>{{ m.variantId }}</td>
            <td><span class="type {{ m.type }}">{{ m.type }}</span></td>
            <td>{{ m.quantity }}</td>
            <td><span class="status {{ m.status }}">{{ m.status }}</span></td>
            <td>{{ m.reason || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No stock movements found.</p>
      </ng-template>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .secondary { background: transparent; color: #007bff; border: 1px solid #007bff; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .note { color: #666; font-size: 0.85rem; margin-bottom: 1rem; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .type { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; text-transform: uppercase; }
    .type.adjustment { background: #e2e3e5; color: #383d41; }
    .type.reservation { background: #cce5ff; color: #004085; }
    .type.release { background: #f8d7da; color: #721c24; }
    .type.commit { background: #d4edda; color: #155724; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.active { background: #d4edda; color: #155724; }
    .status.released { background: #e2e3e5; color: #383d41; }
    .status.committed { background: #cce5ff; color: #004085; }
    .status.expired { background: #f8d7da; color: #721c24; }
  `,
})
export class StockMovementsComponent implements OnInit {

  movements: MovementLedgerEntry[] = [];

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
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
      const res = await this.http.get<{ items: Reservation[] }>(
        `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();

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
