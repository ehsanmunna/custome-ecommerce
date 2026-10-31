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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Low Stock
      </nav>

      <h1>Low Stock Indicators</h1>

      <div *ngIf="!auth.hasPermission('inventory.read')" class="error">
        You do not have permission to view low-stock indicators.
      </div>

      <div *ngIf="auth.hasPermission('inventory.read')" class="toolbar">
        <button (click)="loadLowStock()">Refresh</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="lowStockItems.length; else emptyState">
        <thead>
          <tr>
            <th>Variant ID</th>
            <th>On Hand</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Low Stock Threshold</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of lowStockItems">
            <td>{{ item.variantId }}</td>
            <td>{{ item.onHand }}</td>
            <td>{{ item.reserved }}</td>
            <td>{{ item.available }}</td>
            <td>{{ item.lowStockThreshold }}</td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No low-stock variants found.</p>
      </ng-template>

      <div *ngIf="loading">Loading...</div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
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
