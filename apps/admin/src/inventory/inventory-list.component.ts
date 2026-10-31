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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Inventory
      </nav>

      <h1>Inventory</h1>

      <div class="toolbar">
        <label>
          <input type="checkbox" [(ngModel)]="lowStockFilter" /> Low stock only
        </label>
        <button (click)="loadInventory()">Refresh</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="inventory.length; else emptyState">
        <thead>
          <tr>
            <th>Variant SKU</th>
            <th>On Hand</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Low Stock Threshold</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of inventory" [class.low-stock]="item.lowStock">
            <td>{{ variantSkus[item.variantId] || item.variantId }}</td>
            <td>{{ item.onHand }}</td>
            <td>{{ item.reserved }}</td>
            <td>{{ item.available }}</td>
            <td>{{ item.lowStockThreshold }}</td>
            <td>
              <span class="status {{ item.lowStock ? 'low-stock' : 'ok' }}">
                {{ item.lowStock ? 'LOW STOCK' : 'OK' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No inventory items found.</p>
      </ng-template>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .toolbar label { font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 0.25rem; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 3px; }
    .status.low-stock { background: #f8d7da; color: #721c24; }
    .status.ok { background: #d4edda; color: #155724; }
    tr.low-stock { background: #fdecea; }
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
    @Inject(AuthService) private readonly auth: AuthService,
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
