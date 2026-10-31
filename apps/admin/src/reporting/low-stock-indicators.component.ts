import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface InventoryItem {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  lowStock: boolean;
}

export interface InventoryPage {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-low-stock-indicators',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Low Stock
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Low Stock Indicators</h1>

      <div *ngIf="!auth.hasPermission('inventory.read')" class="text-[var(--color-danger)] mb-4">
        You do not have permission to view low-stock indicators.
      </div>

      <div *ngIf="auth.hasPermission('inventory.read')" class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="loadLowStock()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Refresh</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="lowStockItems.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Variant ID</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">On Hand</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Reserved</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Available</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Low Stock Threshold</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of lowStockItems">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.variantId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.onHand }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.reserved }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.available }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.lowStockThreshold }}</td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No low-stock variants found.</p>
      </ng-template>

      <div *ngIf="loading" class="text-[var(--color-text-muted)]">Loading...</div>
    </div>
  `,
})
export class LowStockIndicatorsComponent implements OnInit {

  lowStockItems: InventoryItem[] = [];

  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadLowStock();
  }

  async loadLowStock(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/v1/admin/inventory`);
      url.searchParams.set('lowStock', 'true');
      const res = await this.http.get<InventoryPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.lowStockItems = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load low-stock indicators';
    } finally {
      this.loading = false;
    }
  }
}
