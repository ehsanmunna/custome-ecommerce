import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Return {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  refundTotal: { amount: number; currency: string };
  items: Array<{
    orderItemId: string;
    quantity: number;
    refundAmount: { amount: number; currency: string };
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

export interface ReturnPage {
  items: Return[];
  total: number;
  page: number;
  pageSize: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'received', 'refunded', 'cancelled'];

@Component({
  selector: 'app-return-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './return-list.component.html',
})
export class ReturnListComponent implements OnInit {

  returns: Return[] = [];
  return_statuses: string[] = RETURN_STATUSES
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
    this.loadReturns();
  }

  loadReturns(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    const url = new URL(`${this.config.apiBaseUrl}/v1/admin/returns`);
    if (this.statusFilter) url.searchParams.set('status', this.statusFilter);
    this.http.get<ReturnPage>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    }).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load returns';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.returns = res?.items ?? [];
      }
    });
  }
}
