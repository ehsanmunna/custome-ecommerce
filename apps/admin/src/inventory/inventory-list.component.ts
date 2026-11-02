import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';

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

export interface Variant {
  id: string;
  sku: string;
  productId: string;
  attributes: Record<string, unknown>;
}

export interface VariantPage {
  items: Variant[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Inventory
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Inventory</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <label class="flex items-center gap-1">
          <input type="checkbox" [(ngModel)]="lowStockFilter" class="rounded border-[var(--color-border)]" /> Low stock only
        </label>
        <button (click)="loadInventory()" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Refresh</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="inventory.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Variant SKU</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">On Hand</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Reserved</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Available</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Low Stock Threshold</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of inventory" [class.bg-red-50]="item.lowStock">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ variantSkus[item.variantId] || item.variantId }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.onHand }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.reserved }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.available }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.lowStockThreshold }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <span class="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded border border-[var(--color-border)]" [class.text-red-600]="item.lowStock" [class.border-red-200]="item.lowStock" [class.bg-red-50]="item.lowStock">
                {{ item.lowStock ? 'LOW STOCK' : 'OK' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No inventory items found.</p>
      </ng-template>
    </div>
  `,
})
export class InventoryListComponent implements OnInit {

  inventory: InventoryItem[] = [];
  variantSkus: Record<string, string> = {};

  lowStockFilter = false;
  loading = false;
  error: string | null = null;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
  }

  async ngOnInit(): Promise<void> {
    await this.loadInventory();
  }

  async loadInventory(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const url = new URL(`${this.config.apiBaseUrl}/v1/admin/inventory`);
      if (this.lowStockFilter) url.searchParams.set('lowStock', 'true');
      const res = await this.http.get<InventoryPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.inventory = res?.items ?? [];
      await this.loadVariantSkus();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load inventory';
    } finally {
      this.loading = false;
    }
  }

  async loadVariantSkus(): Promise<void> {
    try {
      const token = this.auth.token;
      const res = await this.http.get<VariantPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      const variants: Variant[] = (res?.items as any[] ?? []).flatMap((p: any) => p.variants || []);
      this.variantSkus = {};
      for (const v of variants) {
        this.variantSkus[v.id] = v.sku;
      }
    } catch {
      this.variantSkus = {};
    }
  }
}

