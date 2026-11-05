import { Injectable, inject } from '@angular/core';
import { AdminApiService } from '../../core/api/admin-api.service';
import { Observable, of, forkJoin, map, catchError } from 'rxjs';
import type { DashboardDataSource, DashboardRange, OrderStatusCount, RecentOrder, RevenuePoint, TopProduct, LowStockAlert, OrderStatus } from './dashboard.models';

const DHAKA_OFFSET = 6 * 60;

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayInDhaka(): string {
  const now = new Date();
  const utc = Date.now() + now.getTimezoneOffset() * 60000;
  const dhaka = new Date(utc + DHAKA_OFFSET * 60000);
  return formatDateKey(dhaka);
}

function yesterdayInDhaka(): string {
  const now = new Date();
  const utc = Date.now() + now.getTimezoneOffset() * 60000;
  const dhaka = new Date(utc + DHAKA_OFFSET * 60000);
  dhaka.setDate(dhaka.getDate() - 1);
  return formatDateKey(dhaka);
}

@Injectable({ providedIn: 'root' })
export class HttpDashboardDataSource implements DashboardDataSource {
  private readonly api = inject(AdminApiService);

  getOverviewToday(): Observable<{ orderCount: number; revenue: number }> {
    return this.api.getAnalyticsOverview({ date: todayInDhaka() } as never).pipe(
      map((res) => ({
        orderCount: res.orderCount,
        revenue: res.revenue,
      })),
      catchError((error) => {
        console.error('Failed to load overview today:', error);
        return of({ orderCount: 0, revenue: 0 });
      })
    );
  }

  getOverviewYesterday(): Observable<{ orderCount: number; revenue: number }> {
    return this.api.getAnalyticsOverview({ date: yesterdayInDhaka() } as never).pipe(
      map((res) => ({
        orderCount: res.orderCount,
        revenue: res.revenue,
      })),
      catchError((error) => {
        console.error('Failed to load overview yesterday:', error);
        return of({ orderCount: 0, revenue: 0 });
      })
    );
  }

  getSales(range: DashboardRange): Observable<RevenuePoint[]> {
    return this.api.getSales({ range, interval: 'day' } as never).pipe(
      map((res: RevenuePoint[]) => res.map((p: RevenuePoint) => ({
        periodStart: p.periodStart,
        orderCount: p.orderCount,
        revenue: p.revenue,
      }))),
      catchError((error) => {
        console.error('Failed to load sales:', error);
        return of([]);
      })
    );
  }

  getRecentOrders(limit = 8): Observable<RecentOrder[]> {
    return this.api.getOrders({ pageSize: String(limit) } as never).pipe(
      map((res: Record<string, unknown>) => res.items.map((o: Record<string, unknown>) => ({
        id: o.id,
        number: o.number,
        customerName: o.contactName,
        status: o.status as OrderStatus,
        total: o.total,
        createdAt: o.createdAt ?? '',
      }))),
      catchError((error) => {
        console.error('Failed to load recent orders:', error);
        return of([]);
      })
    );
  }

  getLowStockCount(): Observable<number> {
    return this.api.getInventory({ lowStock: 'true', pageSize: '1' } as never).pipe(
      map((res) => res.total),
      catchError((error) => {
        console.error('Failed to load low-stock count:', error);
        return of(0);
      })
    );
  }

  getOrderStatusCounts(): Observable<OrderStatusCount[]> {
    const statuses: OrderStatus[] = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'partially_delivered',
    ];

    return forkJoin(
      statuses.map((status) =>
        this.api.getOrders({ status, pageSize: '1' } as never).pipe(
          map((res) => ({ status, total: res.total })),
          catchError((error) => {
            console.error(`Failed to load ${status} count:`, error);
            return of({ status, total: 0 });
          })
        )
      )
    ).pipe(
      map((results) => results.map((r) => ({
        status: r.status,
        count: r.total,
      })))
    );
  }

  getLowStockAlerts(limit = 5): Observable<LowStockAlert[]> {
    return forkJoin([
      this.api.getInventory({ lowStock: 'true', pageSize: String(limit) } as never),
      this.api.getProducts({ pageSize: '100' } as never),
    ]).pipe(
      map(([inventoryRes, productsRes]) => {
        const productMap = new Map(
          productsRes.items.map((p) => [
            p.id,
            p.content?.['en']?.name || p.content?.['bn']?.name || '',
          ])
        );
        const variantToProduct = new Map<string, string>();
        for (const p of productsRes.items) {
          for (const v of p.variants) {
            variantToProduct.set(v.id, p.id);
          }
        }

        return inventoryRes.items.map((item) => {
          const productId = variantToProduct.get(item.variantId);
          const productName =
            productId && productMap.has(productId)
              ? productMap.get(productId)!
              : item.variantId;
          return {
            variantId: item.variantId,
            productName,
            sku: item.variantId,
            available: item.available,
            threshold: item.lowStockThreshold,
          };
        });
      }),
      catchError((error) => {
        console.error('Failed to load low-stock alerts:', error);
        return of([]);
      })
    );
  }

  getNewCustomers(): Observable<number> {
    return of(0);
  }

  getTopSellingProducts(): Observable<TopProduct[]> {
    return of([]);
  }
}
