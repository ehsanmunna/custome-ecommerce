import { Injectable, inject } from '@angular/core';
import { AdminApiService } from '../../core/api/admin-api.service';
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

  async getOverviewToday(): Promise<{ orderCount: number; revenue: number }> {
    const res = await this.api.getAnalyticsOverview({ date: todayInDhaka() } as never).toPromise();
    return {
      orderCount: res.orderCount,
      revenue: res.revenue,
    };
  }

  async getOverviewYesterday(): Promise<{ orderCount: number; revenue: number }> {
    const res = await this.api.getAnalyticsOverview({ date: yesterdayInDhaka() } as never).toPromise();
    return {
      orderCount: res.orderCount,
      revenue: res.revenue,
    };
  }

  async getSales(range: DashboardRange): Promise<RevenuePoint[]> {
    const res = await this.api.getSales({ range, interval: 'day' } as never).toPromise();
    return res.map((p: { periodStart: string; orderCount: number; revenue: number }) => ({
      periodStart: p.periodStart,
      orderCount: p.orderCount,
      revenue: p.revenue,
    }));
  }

  async getRecentOrders(limit = 8): Promise<RecentOrder[]> {
    const res = await this.api.getOrders({ pageSize: String(limit) } as never).toPromise();
    return res.items.map((o: { id: string; number: string; contactName: string; status: string; total: number; createdAt?: string }) => ({
      id: o.id,
      number: o.number,
      customerName: o.contactName,
      status: o.status as OrderStatus,
      total: o.total,
      createdAt: o.createdAt ?? '',
    }));
  }

  async getLowStockCount(): Promise<number> {
    const res = await this.api.getInventory({ lowStock: 'true', pageSize: '1' } as never).toPromise();
    return res.total;
  }

  async getOrderStatusCounts(): Promise<OrderStatusCount[]> {
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

    const results = await Promise.all(
      statuses.map((status) =>
        this.api.getOrders({ status, pageSize: '1' } as never).toPromise(),
      ),
    );

    return results.map((res: { total: number }, i: number) => ({
      status: statuses[i],
      count: res.total,
    }));
  }

  async getLowStockAlerts(limit = 5): Promise<LowStockAlert[]> {
    const inventoryRes = await this.api.getInventory({ lowStock: 'true', pageSize: String(limit) } as never).toPromise();
    const productsRes = await this.api.getProducts({ pageSize: '100' } as never).toPromise();

    const productMap = new Map(
      productsRes.items.map((p: { id: string; content?: Record<string, { name?: string }> }) => [
        p.id,
        p.content?.['en']?.name || p.content?.['bn']?.name || '',
      ]),
    );
    const variantToProduct = new Map<string, string>();
    for (const p of productsRes.items) {
      for (const v of p.variants) {
        variantToProduct.set(v.id, p.id);
      }
    }

    return inventoryRes.items.map((item: { variantId: string; available: number; lowStockThreshold: number }) => {
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
  }

  async getNewCustomers(): Promise<number> {
    throw new Error('Not backed by a contract operation; use sample source');
  }

  async getTopSellingProducts(): Promise<TopProduct[]> {
    throw new Error('Not backed by a contract operation; use sample source');
  }
}
