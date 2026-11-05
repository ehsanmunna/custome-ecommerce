import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';
import { catchError, EMPTY, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Reservation {
  id: string;
  variantId: string;
  quantity: number;
  status: string;
  source?: string;
  sourceId?: string;
  expiresAt?: string;
}

export interface ReservationPage {
  items: Reservation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementLedgerEntry {
  id: string;
  variantId: string;
  type: string;
  quantity: number;
  reason?: string;
  status: string;
  createdAt?: string;
}

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './stock-movements.component.html',
})
export class StockMovementsComponent implements OnInit {

  movements: MovementLedgerEntry[] = [];

  loading = false;
  error: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {}

  ngOnInit(): void {
    this.loadMovements();
  }

  loadMovements(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<{ items: Reservation[] }>(
      `${this.config.apiBaseUrl}/v1/admin/inventory/reservations`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load stock movements';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const reservations = res?.items ?? [];
        this.movements = reservations.map((r) => ({
          id: r.id,
          variantId: r.variantId,
          type: this.mapType(r.status),
          quantity: r.quantity,
          reason: r.source,
          status: r.status,
          createdAt: r.expiresAt,
        }));
      }
    });
  }

  mapType(status: string): string {
    if (status === 'pending') return 'Adjustment';
    if (status === 'confirmed') return 'Reservation';
    if (status === 'released') return 'Release';
    if (status === 'committed') return 'Commit';
    return status;
  }
}
