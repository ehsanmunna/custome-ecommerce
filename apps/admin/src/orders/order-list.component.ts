import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Order {
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
}

export interface OrderPage {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './order-list.component.html',
})
export class OrderListComponent implements OnInit {

  orders: Order[] = [];

  loading = false;
  error: string | null = null;

  statusFilter = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/orders`);
    if (this.statusFilter) url.searchParams.set('status', this.statusFilter);
    this.http.get<OrderPage>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load orders';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.orders = res?.items ?? [];
      }
    });
  }
}
