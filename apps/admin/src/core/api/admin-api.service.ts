import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { components, paths } from 'api-sdk';
import { ADMIN_AUTH_CONFIG, type AdminAuthConfig } from '../../auth/auth.config';

export type AnalyticsOverview =
  paths['/admin/analytics/overview']['get']['responses'][200]['content']['application/json'];
export type SalesSeries =
  paths['/admin/analytics/sales']['get']['responses'][200]['content']['application/json'];
export type AdminOrderPage =
  paths['/admin/orders']['get']['responses'][200]['content']['application/json'];
export type AdminCustomerPage =
  paths['/admin/customers']['get']['responses'][200]['content']['application/json'];
export type InventoryPage =
  paths['/admin/inventory']['get']['responses'][200]['content']['application/json'];
export type ProductPage =
  paths['/admin/products']['get']['responses'][200]['content']['application/json'];

export type AdminOrder = components['schemas']['Order'];
export type AdminCustomer = components['schemas']['AdminCustomer'];
export type InventoryItem = components['schemas']['InventoryItem'];
export type AdminProduct = components['schemas']['Product'];

type OverviewQuery = NonNullable<
  paths['/admin/analytics/overview']['get']['parameters']['query']
>;
type SalesQuery = NonNullable<paths['/admin/analytics/sales']['get']['parameters']['query']>;
type OrdersQuery = NonNullable<paths['/admin/orders']['get']['parameters']['query']>;
type CustomersQuery = NonNullable<paths['/admin/customers']['get']['parameters']['query']>;
type InventoryQuery = NonNullable<paths['/admin/inventory']['get']['parameters']['query']>;
type ProductsQuery = NonNullable<paths['/admin/products']['get']['parameters']['query']>;

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
  ) {}

  getAnalyticsOverview(query: OverviewQuery): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(this.url('/admin/analytics/overview'), {
      params: this.toParams(query),
    });
  }

  getSales(query: SalesQuery): Observable<SalesSeries> {
    return this.http.get<SalesSeries>(this.url('/admin/analytics/sales'), {
      params: this.toParams(query),
    });
  }

  getOrders(query: OrdersQuery = {}): Observable<AdminOrderPage> {
    return this.http.get<AdminOrderPage>(this.url('/admin/orders'), {
      params: this.toParams(query),
    });
  }

  getCustomers(query: CustomersQuery = {}): Observable<AdminCustomerPage> {
    return this.http.get<AdminCustomerPage>(this.url('/admin/customers'), {
      params: this.toParams(query),
    });
  }

  getInventory(query: InventoryQuery = {}): Observable<InventoryPage> {
    return this.http.get<InventoryPage>(this.url('/admin/inventory'), {
      params: this.toParams(query),
    });
  }

  getProducts(query: ProductsQuery = {}): Observable<ProductPage> {
    return this.http.get<ProductPage>(this.url('/admin/products'), {
      params: this.toParams(query),
    });
  }

  private url(path: string): string {
    return `${this.config.apiBaseUrl.replace(/\/+$/, '')}/v1${path}`;
  }

  private toParams(query: object): HttpParams {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(query) as Array<[string, unknown]>) {
      if (value !== undefined && value !== null) {
        params = params.set(key, String(value));
      }
    }

    return params;
  }
}
