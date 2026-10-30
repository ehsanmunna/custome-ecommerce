import { Injectable } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import type { AnalyticsOverviewQuery, AnalyticsSalesQuery } from './analytics.schemas';

export interface Money {
  amount: number;
  currency: string;
}

export interface AnalyticsOverview {
  orderCount: number;
  revenue: Money;
  averageOrderValue: Money;
}

export interface SalesSeriesPoint {
  periodStart: string;
  orderCount: number;
  revenue: Money;
}

export interface SalesAnalytics {
  series: SalesSeriesPoint[];
}

function toMoney(poisha: number | null): Money {
  return { amount: poisha ?? 0, currency: 'BDT' };
}

function periodStartFor(date: Date, interval: 'day' | 'week' | 'month'): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (interval === 'week') {
    const day = d.getDay();
    d.setDate(d.getDate() - day);
  } else if (interval === 'month') {
    d.setDate(1);
  }
  return d.toISOString();
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(input: AnalyticsOverviewQuery): Promise<AnalyticsOverview> {
    const from = new Date(input.from);
    const to = new Date(input.to);

    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: from, lte: to },
    };

    const [orderCount, aggregate] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where,
        _sum: { totalPoisha: true },
      }),
    ]);

    const revenuePoisha = aggregate._sum.totalPoisha ?? 0;
    const averageOrderValue = orderCount > 0 ? Math.floor(revenuePoisha / orderCount) : 0;

    return {
      orderCount,
      revenue: toMoney(revenuePoisha),
      averageOrderValue: toMoney(averageOrderValue),
    };
  }

  async getSales(input: AnalyticsSalesQuery): Promise<SalesAnalytics> {
    const from = new Date(input.from);
    const to = new Date(input.to);

    const where: Prisma.OrderWhereInput = {
      createdAt: { gte: from, lte: to },
    };

    const orders = await this.prisma.order.findMany({
      where,
      select: { id: true, totalPoisha: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    const grouped = new Map<string, { orderCount: number; revenue: number }>();

    for (const order of orders) {
      const periodKey = periodStartFor(order.createdAt, input.interval);
      const existing = grouped.get(periodKey) ?? { orderCount: 0, revenue: 0 };
      grouped.set(periodKey, {
        orderCount: existing.orderCount + 1,
        revenue: existing.revenue + order.totalPoisha,
      });
    }

    const series: SalesSeriesPoint[] = Array.from(grouped.entries()).map(
      ([periodStart, data]) => ({
        periodStart,
        orderCount: data.orderCount,
        revenue: toMoney(data.revenue),
      }),
    );

    return { series };
  }
}
