import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, map, switchMap } from 'rxjs';
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
  imports: [FormsModule, RouterLink],
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
  ) {}

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/inventory`);
    if (this.lowStockFilter) url.searchParams.set('lowStock', 'true');
    this.http
      .get<InventoryPage>(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap((inventory) =>
          this.http
            .get<VariantPage>(`${this.config.apiBaseUrl}/v1/admin/products`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .pipe(map((variants) => ({ inventory, variants }))),
        ),
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load inventory';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ inventory, variants }) => {
          this.inventory = inventory?.items ?? [];
          const flattened: Variant[] = ((variants?.items as any[]) ?? []).flatMap(
            (p: any) => p.variants || [],
          );
          this.variantSkus = {};
          for (const v of flattened) {
            this.variantSkus[v.id] = v.sku;
          }
        },
      });
  }
}
