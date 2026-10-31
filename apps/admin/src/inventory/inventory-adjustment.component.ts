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

export interface InventoryItem {
  variantId: string;
  sku: string;
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

export interface InventoryAdjustmentInput {
  quantityDelta: number;
  reason: string;
  lowStockThreshold?: number;
}

export interface InventoryAdjustmentResult {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  lowStock: boolean;
}

@Component({
  selector: 'app-inventory-adjustment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/inventory">Inventory</a> &gt; Stock Adjustment
      </nav>

      <h1>Stock Adjustment</h1>

      <div class="toolbar">
        <button (click)="loadInventory()" class="secondary">Refresh</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>
      <div *ngIf="success" class="success">{{ success }}</div>

      <table *ngIf="inventory.length; else emptyState" [formGroup]="adjustmentForm">
        <thead>
          <tr>
            <th>Variant SKU</th>
            <th>Available</th>
            <th>Adjustment</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of inventory" [class.adjusting]="adjustingId === item.variantId">
            <td>{{ item.sku }}</td>
            <td>{{ item.available }}</td>
            <td>
              <input
                type="number"
                [formControlName]="'delta_' + item.variantId"
                placeholder="e.g. +10 or -5"
              />
            </td>
            <td>
              <input
                [formControlName]="'reason_' + item.variantId"
                placeholder="Reason for adjustment"
              />
            </td>
            <td>
              <button
                (click)="adjustStock(item.variantId)"
                [disabled]="adjustingId === item.variantId || !canAdjust(item.variantId) || !auth.hasPermission('inventory.adjust')"
              >
                {{ adjustingId === item.variantId ? 'Applying...' : 'Adjust' }}
              </button>
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
    .secondary { background: transparent; color: #007bff; border: 1px solid #007bff; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .success { color: #155724; background: #d4edda; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    tr.adjusting { background: #fff3cd; }
    input { padding: 0.375rem; border: 1px solid #ddd; border-radius: 4px; width: 100%; box-sizing: border-box; }
  `,
})
export class InventoryAdjustmentComponent implements OnInit {

  inventory: InventoryItem[] = [];

  loading = false;
  adjustingId: string | null = null;
  error: string | null = null;
  success: string | null = null;

  adjustmentForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
    this.adjustmentForm = this.fb.group({});
  }

  async ngOnInit(): Promise<void> {
    await this.loadInventory();
  }

  async loadInventory(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.success = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<InventoryPage>(`${this.config.apiBaseUrl}/v1/admin/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.inventory = (res?.items ?? []).map((item: any) => ({
        ...item,
        sku: item.variantId, // Will be resolved from variant data
      }));
      // Initialize form controls for each variant
      for (const item of this.inventory) {
        this.adjustmentForm.addControl('delta_' + item.variantId, this.fb.control(''));
        this.adjustmentForm.addControl('reason_' + item.variantId, this.fb.control('', Validators.required));
      }
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load inventory';
    } finally {
      this.loading = false;
    }
  }

  canAdjust(variantId: string): boolean {
    const deltaCtrl = this.adjustmentForm.get('delta_' + variantId);
    const reasonCtrl = this.adjustmentForm.get('reason_' + variantId);
    return !!(deltaCtrl?.value && reasonCtrl?.value);
  }

  async adjustStock(variantId: string): Promise<void> {
    const deltaCtrl = this.adjustmentForm.get('delta_' + variantId);
    const reasonCtrl = this.adjustmentForm.get('reason_' + variantId);
    const delta = Number(deltaCtrl?.value);
    const reason = reasonCtrl?.value;

    if (!delta || !reason) return;

    const item = this.inventory.find(i => i.variantId === variantId);
    if (!item) return;

    // Client-side validation: reject adjustments that would drive stock below zero
    if (delta < 0 && Math.abs(delta) > item.available) {
      this.error = `Cannot reduce stock below zero. Available: ${item.available}`;
      return;
    }

    this.adjustingId = variantId;
    this.error = null;
    this.success = null;

    try {
      const token = this.auth.token;
      const body: InventoryAdjustmentInput = {
        quantityDelta: delta,
        reason,
      };
      await this.http.post(
        `${this.config.apiBaseUrl}/v1/admin/inventory/${variantId}/adjustments`,
        body,
        { headers: { Authorization: `Bearer ${token}` } },
      ).toPromise();

      deltaCtrl?.setValue('');
      reasonCtrl?.setValue('');
      await this.loadInventory();
      this.success = `Stock adjusted for ${variantId}`;
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to adjust stock';
    } finally {
      this.adjustingId = null;
    }
  }
}
