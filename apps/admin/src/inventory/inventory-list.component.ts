import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  templateUrl: './inventory-list.component.html',
})
export class InventoryListComponent implements OnInit {

  inventory: InventoryItem[] = [];
  variantSkus: Record<string, string> = {};

  lowStockFilter = false;
  loading = false;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {
  }

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/inventory`);
    if (this.lowStockFilter) url.searchParams.set('lowStock', 'true');
    this.http.get<InventoryPage>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      switchMap(() => this.http.get<VariantPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load inventory';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const variants: Variant[] = (res?.items as any[] ?? []).flatMap((p: any) => p.variants || []);
        this.variantSkus = {};
        for (const v of variants) {
          this.variantSkus[v.id] = v.sku;
        }
      }
    });
  }
}

