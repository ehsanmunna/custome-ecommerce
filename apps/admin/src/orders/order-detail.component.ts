import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface OrderDetail {
  id: string;
  number: string;
  customerId?: string;
  status: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  delivery: any;
  subtotal: { amount: number; currency: string };
  discount: { amount: number; currency: string };
  deliveryFee: { amount: number; currency: string };
  tax: { amount: number; currency: string };
  total: { amount: number; currency: string };
  items: Array<{
    variantId: string;
    productName: string;
    sku: string;
    attributes: Record<string, unknown>;
    quantity: number;
    unitPrice: { amount: number; currency: string };
    lineTotal: { amount: number; currency: string };
  }>;
  history: Array<{
    previousStatus?: string;
    status: string;
    actorAdminId?: string;
    note?: string;
    createdAt: string;
  }>;
  createdAt: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {

  orderId: string | null = null;
  order: OrderDetail | null = null;

  loading = false;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    if (!this.orderId) {
      this.error = 'No order ID specified';
      return;
    }
    this.loadOrder();
  }

  loadOrder(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<OrderDetail>(
      `${this.config.apiBaseUrl}/v1/admin/orders/${this.orderId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load order';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.order = res ?? null;
      }
    });
  }
}
