import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  DASHBOARD_WIDGET_PERMISSIONS,
  type DashboardWidget,
} from './dashboard.models';
import { DashboardService } from './dashboard.service';
import { DashboardStore } from './dashboard.store';
import { HttpDashboardDataSource } from './http-dashboard-data-source';
import { SampleDashboardDataSource } from './sample-dashboard-data-source';
import { AuthService } from '../../auth/auth.service';

const widgetPermissionCases: Array<[DashboardWidget, string]> = [
  ['orders', 'analytics.read'],
  ['revenue', 'analytics.read'],
  ['revenueChart', 'analytics.read'],
  ['topProducts', 'analytics.read'],
  ['newCustomers', 'customers.read'],
  ['recentOrders', 'orders.read'],
  ['orderStatus', 'orders.read'],
  ['lowStockCount', 'inventory.read'],
  ['lowStockAlerts', 'inventory.read'],
];

const permissionsOf = (granted: string[]) => ({
  hasPermission: (permission: string) => granted.includes(permission),
});

const createHttpDataSource = () => ({
  getOverviewToday: vi.fn(() => of({ orderCount: 1, revenue: 100 })),
  getOverviewYesterday: vi.fn(() => of({ orderCount: 1, revenue: 100 })),
  getSales: vi.fn(() => of([])),
  getRecentOrders: vi.fn(() => of([])),
  getLowStockCount: vi.fn(() => of(0)),
  getOrderStatusCounts: vi.fn(() => of([])),
  getLowStockAlerts: vi.fn(() => of([])),
  getNewCustomers: vi.fn(() => of(0)),
  getTopSellingProducts: vi.fn(() => of([])),
});

const createService = (granted: string[]) => {
  const http = createHttpDataSource();
  const sample = {
    getSales: vi.fn(() => of([])),
    getNewCustomers: vi.fn(() => of(0)),
    getTopSellingProducts: vi.fn(() => of([])),
  };

  const injector = Injector.create({
    providers: [
      { provide: HttpDashboardDataSource, useValue: http },
      { provide: SampleDashboardDataSource, useValue: sample },
      { provide: AuthService, useValue: permissionsOf(granted) },
    ],
  });

  const service = runInInjectionContext(injector, () => new DashboardService());
  return { service, http, sample };
};

describe('dashboard widget permissions', () => {
  it('maps every widget to the permission its data requires', () => {
    for (const [widget, permission] of widgetPermissionCases) {
      expect(DASHBOARD_WIDGET_PERMISSIONS[widget]).toBe(permission);
    }
  });
});

describe('DashboardService permission filtering', () => {
  it('loads only analytics widgets for analytics.read', async () => {
    const { service, http } = createService(['analytics.read']);

    const overview = await firstValueFrom(service.loadOverview());

    expect(Object.keys(overview).sort()).toEqual(
      ['orders', 'revenue', 'revenueChart', 'topProducts'].sort(),
    );
    // The order and revenue stat cards each request today's and yesterday's overview.
    expect(http.getOverviewToday).toHaveBeenCalledTimes(2);
    expect(http.getOverviewYesterday).toHaveBeenCalledTimes(2);
    expect(http.getSales).toHaveBeenCalledTimes(1);
    expect(http.getTopSellingProducts).toHaveBeenCalledTimes(1);
    expect(http.getNewCustomers).not.toHaveBeenCalled();
    expect(http.getRecentOrders).not.toHaveBeenCalled();
    expect(http.getLowStockCount).not.toHaveBeenCalled();
    expect(http.getOrderStatusCounts).not.toHaveBeenCalled();
    expect(http.getLowStockAlerts).not.toHaveBeenCalled();
  });

  it('loads only order widgets for orders.read', async () => {
    const { service, http } = createService(['orders.read']);

    const overview = await firstValueFrom(service.loadOverview());

    expect(Object.keys(overview).sort()).toEqual(['orderStatus', 'recentOrders']);
    expect(http.getRecentOrders).toHaveBeenCalledTimes(1);
    expect(http.getOrderStatusCounts).toHaveBeenCalledTimes(1);
    expect(http.getOverviewToday).not.toHaveBeenCalled();
    expect(http.getSales).not.toHaveBeenCalled();
    expect(http.getTopSellingProducts).not.toHaveBeenCalled();
    expect(http.getNewCustomers).not.toHaveBeenCalled();
    expect(http.getLowStockCount).not.toHaveBeenCalled();
    expect(http.getLowStockAlerts).not.toHaveBeenCalled();
  });

  it('loads only inventory widgets for inventory.read', async () => {
    const { service, http } = createService(['inventory.read']);

    const overview = await firstValueFrom(service.loadOverview());

    expect(Object.keys(overview).sort()).toEqual(['lowStockAlerts', 'lowStockCount']);
    expect(http.getLowStockCount).toHaveBeenCalledTimes(1);
    expect(http.getLowStockAlerts).toHaveBeenCalledTimes(1);
    expect(http.getOverviewToday).not.toHaveBeenCalled();
    expect(http.getSales).not.toHaveBeenCalled();
    expect(http.getTopSellingProducts).not.toHaveBeenCalled();
    expect(http.getRecentOrders).not.toHaveBeenCalled();
    expect(http.getOrderStatusCounts).not.toHaveBeenCalled();
    expect(http.getNewCustomers).not.toHaveBeenCalled();
  });

  it('loads only the customer widget for customers.read', async () => {
    const { service, http } = createService(['customers.read']);

    const overview = await firstValueFrom(service.loadOverview());

    expect(Object.keys(overview)).toEqual(['newCustomers']);
    expect(http.getNewCustomers).toHaveBeenCalledTimes(1);
    expect(http.getOverviewToday).not.toHaveBeenCalled();
    expect(http.getSales).not.toHaveBeenCalled();
    expect(http.getTopSellingProducts).not.toHaveBeenCalled();
    expect(http.getRecentOrders).not.toHaveBeenCalled();
    expect(http.getOrderStatusCounts).not.toHaveBeenCalled();
    expect(http.getLowStockCount).not.toHaveBeenCalled();
    expect(http.getLowStockAlerts).not.toHaveBeenCalled();
  });

  it('makes no request when no dashboard permission is held', async () => {
    const { service, http } = createService([]);

    const overview = await firstValueFrom(service.loadOverview());

    expect(overview).toEqual({});
    for (const spy of Object.values(http)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('DashboardStore widget gating', () => {
  const createStore = (granted: string[], overview: unknown = {}) => {
    const service = {
      loadOverview: vi.fn(() => of(overview)),
      dashboardRange: () => '7' as const,
      setRange: vi.fn(),
    };

    const injector = Injector.create({
      providers: [
        { provide: DashboardService, useValue: service },
        { provide: AuthService, useValue: permissionsOf(granted) },
      ],
    });

    return {
      store: runInInjectionContext(injector, () => new DashboardStore()),
      service,
    };
  };

  it('exposes canView per widget permission', () => {
    const { store } = createStore(['analytics.read', 'inventory.read']);

    expect(store.canView('orders')).toBe(true);
    expect(store.canView('revenueChart')).toBe(true);
    expect(store.canView('topProducts')).toBe(true);
    expect(store.canView('lowStockCount')).toBe(true);
    expect(store.canView('lowStockAlerts')).toBe(true);
    expect(store.canView('newCustomers')).toBe(false);
    expect(store.canView('recentOrders')).toBe(false);
    expect(store.canView('orderStatus')).toBe(false);
  });

  it('lists only permitted widgets for a mixed snapshot', () => {
    const { store } = createStore(['orders.read']);

    expect(store.visibleWidgets()).toEqual(['recentOrders', 'orderStatus']);
  });

  it('lists no widgets when no dashboard permission is held', () => {
    const { store } = createStore([]);

    expect(store.visibleWidgets()).toEqual([]);
  });

  it('stores only the permitted widget data returned by the service', () => {
    const { store, service } = createStore(
      ['customers.read'],
      { newCustomers: { status: 'ready', data: 4 } },
    );

    store.load();

    expect(service.loadOverview).toHaveBeenCalledTimes(1);
    expect(Object.keys(store.state() ?? {})).toEqual(['newCustomers']);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });
});
