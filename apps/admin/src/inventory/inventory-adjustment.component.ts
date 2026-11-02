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
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/inventory" class="text-[var(--color-primary)] underline">Inventory</a> &gt; Stock Adjustment
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Stock Adjustment</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="loadInventory()" class="px-4 py-2 border-none rounded-md cursor-pointer border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10">Refresh</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>
      <div *ngIf="success" class="text-[var(--color-success)] bg-[var(--color-success-foreground)]/10 p-2 rounded mb-4 border border-[var(--color-success)]/20">{{ success }}</div>

      <table *ngIf="inventory.length; else emptyState" [formGroup]="adjustmentForm" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Variant SKU</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Available</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Adjustment</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Reason</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of inventory" [class.bg-yellow-50]="adjustingId === item.variantId">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.sku }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ item.available }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <input
                type="number"
                [formControlName]="'delta_' + item.variantId"
                placeholder="e.g. +10 or -5"
                class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <input
                [formControlName]="'reason_' + item.variantId"
                placeholder="Reason for adjustment"
                class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button
                (click)="adjustStock(item.variantId)"
                [disabled]="adjustingId === item.variantId || !canAdjust(item.variantId) || !auth.hasPermission('inventory.adjust')"
                class="px-4 py-2 border-none rounded-md cursor-pointer opacity-60:cursor-not-allowed bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              >
                {{ adjustingId === item.variantId ? 'Applying...' : 'Adjust' }}
              </button>
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
export class InventoryAdjustmentComponent implements OnInit {

  inventory: InventoryItem[] = [];

  loading = false;
  adjustingId: string | null = null;
  error: string | null = null;
  success: string | null = null;

  adjustmentForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
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

