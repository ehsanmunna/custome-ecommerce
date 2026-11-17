// @vitest-environment jsdom
import '@angular/compiler';
import { Component, Input, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { TranslocoPipe, TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardService } from './dashboard.service';
import { AuthService } from '../../auth/auth.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

type StubState = { status: string; data?: unknown; error?: string };

@Component({
  selector: 'app-stat-cards-widget',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <div class="stat-stub">
      @if (showOrders) {
        <div class="stub-card orders" [attr.data-status]="orders?.status">
          {{ orders?.data?.today?.orderCount }}
        </div>
      }
      @if (showRevenue) {
        <div class="stub-card revenue" [attr.data-status]="revenue?.status">
          {{ revenue?.data?.today?.revenue }}
        </div>
      }
      @if (showNewCustomers) {
        <div class="stub-card new-customers" [attr.data-status]="newCustomers?.status">
          {{ newCustomers?.data }}
        </div>
      }
      @if (showLowStock) {
        <div class="stub-card low-stock-count" [attr.data-status]="lowStockCount?.status">
          {{ lowStockCount?.data }}
        </div>
      }
    </div>
  `,
})
class StatCardsStubComponent {
  @Input() orders: StubState | null = null;
  @Input() revenue: StubState | null = null;
  @Input() newCustomers: StubState | null = null;
  @Input() lowStockCount: StubState | null = null;
  @Input() showOrders = true;
  @Input() showRevenue = true;
  @Input() showNewCustomers = true;
  @Input() showLowStock = true;
}

@Component({
  selector: 'app-revenue-chart-widget',
  standalone: true,
  template: `<div class="stub revenue-chart" [attr.data-status]="state?.status"></div>`,
})
class RevenueChartStubComponent {
  @Input() state: StubState | null = null;
}

@Component({
  selector: 'app-recent-orders-widget',
  standalone: true,
  template: `<div class="stub recent-orders" [attr.data-status]="state?.status"></div>`,
})
class RecentOrdersStubComponent {
  @Input() state: StubState | null = null;
}

@Component({
  selector: 'app-top-products-widget',
  standalone: true,
  template: `<div class="stub top-products" [attr.data-status]="state?.status"></div>`,
})
class TopProductsStubComponent {
  @Input() state: StubState | null = null;
}

@Component({
  selector: 'app-order-status-widget',
  standalone: true,
  template: `<div class="stub order-status" [attr.data-status]="state?.status"></div>`,
})
class OrderStatusStubComponent {
  @Input() state: StubState | null = null;
}

@Component({
  selector: 'app-low-stock-widget',
  standalone: true,
  template: `<div class="stub low-stock-alerts" [attr.data-status]="state?.status">
    {{ state?.data }}
  </div>`,
})
class LowStockStubComponent {
  @Input() state: StubState | null = null;
}

const overviewForAnalytics = {
  orders: {
    status: 'ready' as const,
    data: { today: { orderCount: 4, revenue: 200000 }, yesterday: { orderCount: 2, revenue: 100000 } },
  },
  revenue: {
    status: 'ready' as const,
    data: { today: { orderCount: 4, revenue: 1234500 }, yesterday: { orderCount: 2, revenue: 100000 } },
  },
  revenueChart: { status: 'ready' as const, data: { points: [], range: '7' as const } },
  topProducts: { status: 'ready' as const, data: [{ rank: 1, productName: 'Shirt', unitsSold: 9 }] },
};

const overviewForOrders = {
  recentOrders: {
    status: 'ready' as const,
    data: [
      { id: 'order-1', number: 'ORD-1', customerName: 'A', status: 'pending', total: 1000, createdAt: '' },
    ],
  },
  orderStatus: { status: 'ready' as const, data: [{ status: 'pending', count: 1 }] },
};

const overviewForInventory = {
  lowStockCount: { status: 'ready' as const, data: 2 },
  lowStockAlerts: {
    status: 'ready' as const,
    data: [{ variantId: 'var-1', productName: 'Shirt', sku: 'SKU-1', available: 1, threshold: 5 }],
  },
};

const overviewForCustomers = {
  newCustomers: { status: 'ready' as const, data: 7 },
};

const createFixture = (granted: string[], overview: Record<string, unknown>) => {
  const service = {
    loadOverview: () => of(overview),
    dashboardRange: () => '7' as const,
    setRange: () => {},
  };

  TestBed.configureTestingModule({
    imports: [
      DashboardComponent,
      TranslocoTestingModule.forRoot({
        langs: {
          en: {
            dashboard: {
              title: 'Dashboard',
              subtitle: 'Overview',
              range7: '7 days',
              range30: '30 days',
              range90: '90 days',
              widgetRetry: 'Retry',
            },
          },
        },
        translocoConfig: { defaultLang: 'en', availableLangs: ['en'] },
      }),
    ],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: DashboardService, useValue: service },
      { provide: AuthService, useValue: { hasPermission: (p: string) => granted.includes(p) } },
    ],
  });

  TestBed.overrideComponent(DashboardComponent, {
    set: {
      imports: [
        TranslocoPipe,
        StatCardsStubComponent,
        RevenueChartStubComponent,
        RecentOrdersStubComponent,
        TopProductsStubComponent,
        OrderStatusStubComponent,
        LowStockStubComponent,
      ],
    },
  });

  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.detectChanges();
  return fixture;
};

const selectors = (element: HTMLElement) => ({
  statCards: element.querySelector('app-stat-cards-widget'),
  statCardCount: element.querySelectorAll('.stub-card').length,
  revenueChart: element.querySelector('app-revenue-chart-widget'),
  recentOrders: element.querySelector('app-recent-orders-widget'),
  topProducts: element.querySelector('app-top-products-widget'),
  orderStatus: element.querySelector('app-order-status-widget'),
  lowStock: element.querySelector('app-low-stock-widget'),
});

const hasClasses = (element: Element | null, classes: string[]): boolean =>
  element !== null && classes.every((name) => element.classList.contains(name));

describe('DashboardComponent widget rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders analytics widgets only for analytics.read', () => {
    const element: HTMLElement = createFixture(['analytics.read'], overviewForAnalytics).nativeElement;
    const found = selectors(element);

    expect(found.statCards).not.toBeNull();
    expect(found.statCardCount).toBe(2);
    expect(found.revenueChart).not.toBeNull();
    expect(found.topProducts).not.toBeNull();
    expect(found.recentOrders).toBeNull();
    expect(found.orderStatus).toBeNull();
    expect(found.lowStock).toBeNull();

    const statGrid = element.querySelector('app-stat-cards-widget .stat-stub');
    expect(hasClasses(statGrid, ['stat-stub'])).toBe(true);

    const widgetGrid = element.querySelector('div.mt-6.grid');
    expect(hasClasses(widgetGrid, ['mt-6', 'grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-6'])).toBe(true);
    expect(hasClasses(found.revenueChart?.parentElement ?? null, ['lg:col-span-2'])).toBe(true);
  });

  it('renders order widgets only for orders.read', () => {
    const element: HTMLElement = createFixture(['orders.read'], overviewForOrders).nativeElement;
    const found = selectors(element);

    expect(found.statCards).toBeNull();
    expect(found.recentOrders).not.toBeNull();
    expect(found.orderStatus).not.toBeNull();
    expect(found.revenueChart).toBeNull();
    expect(found.topProducts).toBeNull();
    expect(found.lowStock).toBeNull();
  });

  it('renders inventory widgets only for inventory.read', () => {
    const element: HTMLElement = createFixture(['inventory.read'], overviewForInventory).nativeElement;
    const found = selectors(element);

    expect(found.statCards).not.toBeNull();
    expect(found.statCardCount).toBe(1);
    expect(found.lowStock).not.toBeNull();
    expect(found.revenueChart).toBeNull();
    expect(found.recentOrders).toBeNull();
    expect(found.topProducts).toBeNull();
    expect(found.orderStatus).toBeNull();
  });

  it('renders only the mixed snapshot widgets the administrator may use', () => {
    const element: HTMLElement = createFixture(
      ['analytics.read', 'customers.read', 'orders.read'],
      { ...overviewForAnalytics, ...overviewForCustomers, ...overviewForOrders, ...overviewForInventory },
    ).nativeElement;
    const found = selectors(element);

    expect(found.statCards).not.toBeNull();
    expect(found.statCardCount).toBe(3);
    expect(found.revenueChart).not.toBeNull();
    expect(found.topProducts).not.toBeNull();
    expect(found.recentOrders).not.toBeNull();
    expect(found.orderStatus).not.toBeNull();
    expect(found.lowStock).toBeNull();
    expect(element.querySelector('.stub-card.new-customers')?.textContent).toContain('7');
  });

  it('renders no widget and no dashboard error when the snapshot holds no dashboard permission', () => {
    const fixture = createFixture([], {});
    const element: HTMLElement = fixture.nativeElement;
    const found = selectors(element);

    expect(found.statCards).toBeNull();
    expect(found.revenueChart).toBeNull();
    expect(found.recentOrders).toBeNull();
    expect(found.topProducts).toBeNull();
    expect(found.orderStatus).toBeNull();
    expect(found.lowStock).toBeNull();
    expect(fixture.componentInstance.store.error()).toBeNull();
  });
});

describe('DashboardComponent widget isolation', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('keeps a failed permitted widget local and never surfaces restricted values', () => {
    const fixture = createFixture(['analytics.read'], {
      orders: { status: 'error', error: 'Forbidden' },
      revenue: {
        status: 'ready',
        data: { today: { orderCount: 4, revenue: 1234500 }, yesterday: { orderCount: 2, revenue: 100000 } },
      },
      revenueChart: { status: 'ready', data: { points: [], range: '7' } },
      topProducts: { status: 'ready', data: [{ rank: 1, productName: 'Shirt', unitsSold: 9 }] },
      lowStockCount: { status: 'ready', data: 99 },
      lowStockAlerts: {
        status: 'ready',
        data: [
          { variantId: 'var-secret', productName: 'Secret', sku: 'SECRET-SKU', available: 1, threshold: 5 },
        ],
      },
    });
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('.stub-card.orders')?.getAttribute('data-status')).toBe('error');
    expect(element.querySelector('.stub-card.revenue')?.getAttribute('data-status')).toBe('ready');
    expect(element.querySelector('.stub-card.revenue')?.textContent).toContain('1234500');
    expect(element.querySelector('app-top-products-widget')).not.toBeNull();
    expect(selectors(element).lowStock).toBeNull();
    expect(element.textContent).not.toContain('SECRET-SKU');
    expect(element.textContent).not.toContain('99');
    expect(fixture.componentInstance.store.error()).toBeNull();
    expect(fixture.componentInstance.store.loading()).toBe(false);
  });
});
