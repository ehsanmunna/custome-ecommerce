import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
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
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  templateUrl: './inventory-adjustment.component.html',
})
export class InventoryAdjustmentComponent implements OnInit {

  inventory: InventoryItem[] = [];

  loading = false;
  error: string | null = null;
  success: string | null = null;

  adjustingId: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  adjustmentForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {
    this.adjustmentForm = this.fb.group({
      variantId: ['', Validators.required],
      quantityDelta: [0, [Validators.required, Validators.min(1)]],
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.loading = true;
    this.error = null;
    this.success = null;
    const token = this.auth.token;
    this.http.get<InventoryPage>(`${this.config.apiBaseUrl}/v1/admin/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load inventory';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.inventory = (res?.items ?? []).map((item: any) => ({
          ...item,
          sku: item.variantId,
        }));
        for (const item of this.inventory) {
          this.adjustmentForm.addControl('delta_' + item.variantId, this.fb.control(''));
          this.adjustmentForm.addControl('reason_' + item.variantId, this.fb.control('', Validators.required));
        }
      }
    });
  }

  adjustStock(variantId: string): void {
    const deltaCtrl = this.adjustmentForm.get('delta_' + variantId);
    const reasonCtrl = this.adjustmentForm.get('reason_' + variantId);
    const delta = Number(deltaCtrl?.value);
    const reason = reasonCtrl?.value;

    if (!delta || !reason) return;

    const item = this.inventory.find(i => i.variantId === variantId);
    if (!item) return;

    if (delta < 0 && Math.abs(delta) > item.available) {
      this.error = `Cannot reduce stock below zero. Available: ${item.available}`;
      return;
    }

    this.adjustingId = variantId;
    this.error = null;
    this.success = null;

    const token = this.auth.token;
    const body: InventoryAdjustmentInput = {
      quantityDelta: delta,
      reason,
    };
    this.http.post(
      `${this.config.apiBaseUrl}/v1/admin/inventory/${variantId}/adjustments`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<InventoryPage>(`${this.config.apiBaseUrl}/v1/admin/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to adjust stock';
        return EMPTY;
      }),
      finalize(() => this.adjustingId = null),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        deltaCtrl?.setValue('');
        reasonCtrl?.setValue('');
        this.inventory = (res?.items ?? []).map((item: any) => ({
          ...item,
          sku: item.variantId,
        }));
        this.success = `Stock adjusted for ${variantId}`;
      }
    });
  }
}
