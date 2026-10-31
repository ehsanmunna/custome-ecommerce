import '@angular/compiler';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PageListComponent } from './page-list.component';
import { BannerListComponent } from './banner-list.component';
import { AuthService } from '../auth/auth.service';
import { defaultAdminAuthConfig, AdminAuthConfig } from '../auth/auth.config';
import { FormBuilder } from '@angular/forms';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'window', { value: { localStorage: localStorageMock }, writable: true });
Object.defineProperty(globalThis, 'confirm', { value: () => true, writable: true });

class MockHttpClient {
  private responses: Record<string, any> = {};
  private requests: Array<{ method: string; url: string; body?: any; headers?: Record<string, string> }> = [];

  setResponse(url: string, response: any) {
    this.responses[url] = response;
  }

  setError(url: string, error: Error) {
    this.responses[url] = error;
  }

  private request<T>(method: string, url: string, body?: any, options?: { headers?: Record<string, string> }): any {
    this.requests.push({ method, url, body, headers: options?.headers });
    const response = this.responses[url];
    if (response instanceof Error) {
      return { toPromise: () => Promise.reject(response), pipe: (_fn: any) => response as any };
    }
    return {
      toPromise: () => Promise.resolve(response),
      pipe: <R>(fn: (obs: T) => R) => fn(response),
    };
  }

  get<T>(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('GET', url, undefined, options);
  }

  post<T>(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('POST', url, body, options);
  }

  patch<T>(url: string, body: any, options?: { headers?: Record<string, string> }): any {
    return this.request<T>('PATCH', url, body, options);
  }

  delete(url: string, options?: { headers?: Record<string, string> }): any {
    return this.request('DELETE', url, undefined, options);
  }

  getLastRequest(method: string, url: string) {
    return this.requests.find(r => r.method === method && r.url === url);
  }

  clearRequests() {
    this.requests = [];
  }
}

const baseUrl = 'http://localhost:4000';
const config: AdminAuthConfig = { ...defaultAdminAuthConfig, apiBaseUrl: baseUrl };

describe('PageListComponent', () => {
  let component: PageListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new PageListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load CMS pages successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/pages`, {
      items: [
        {
          id: 'page-1',
          content: {
            en: { slug: 'about-us', title: 'About Us', status: 'published', body: 'We are a store' },
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.pages.length).toBe(1);
    expect(component.pages[0].id).toBe('page-1');
  });

  it('should create a CMS page successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/pages`, { id: 'page-new', content: { en: { slug: 'contact', title: 'Contact', status: 'draft' } } });

    component.createForm.setValue({
      titleEn: 'Contact',
      slugEn: 'contact',
      statusEn: 'draft',
      bodyEn: 'Reach us',
      titleBn: '',
      slugBn: '',
      bodyBn: '',
    });
    await component.createPage();

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/pages`);
    expect(req).toBeDefined();
    expect(req!.body.content.en.slug).toBe('contact');
    expect(component.error).toBeNull();
  });

  it('should reject CMS page with missing slug', async () => {
    http.setError(`${baseUrl}/v1/admin/pages`, new Error('Slug is required'));

    component.createForm.setValue({
      titleEn: 'No Slug',
      slugEn: '',
      statusEn: 'draft',
      bodyEn: '',
      titleBn: '',
      slugBn: '',
      bodyBn: '',
    });
    await component.createPage();

    expect(component.createForm.invalid).toBe(true);
    expect(component.error).toBeNull();
  });

  it('should handle permission-denied page creation', async () => {
    http.setError(`${baseUrl}/v1/admin/pages`, new Error('Forbidden: insufficient permissions'));

    component.createForm.setValue({
      titleEn: 'Restricted',
      slugEn: 'restricted',
      statusEn: 'draft',
      bodyEn: '',
      titleBn: '',
      slugBn: '',
      bodyBn: '',
    });
    await component.createPage();

    expect(component.error).toContain('insufficient permissions');
  });

  it('should delete a CMS page successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/pages`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/v1/admin/pages/page-1`, null);
    await component.deletePage('page-1');

    const req = http.getLastRequest('DELETE', `${baseUrl}/v1/admin/pages/page-1`);
    expect(req).toBeDefined();
  });
});

describe('BannerListComponent', () => {
  let component: BannerListComponent;
  let http: MockHttpClient;
  let auth: AuthService;

  beforeEach(() => {
    http = new MockHttpClient();
    auth = new AuthService(http as any, config);
    auth.clear();
    localStorage.clear();

    component = new BannerListComponent(http as any, auth, new FormBuilder(), config);
  });

  afterEach(() => {
    http.clearRequests();
  });

  it('should load banners successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/banners`, {
      items: [
        {
          id: 'banner-1',
          placement: 'homepage-hero',
          sortOrder: 1,
          active: true,
          content: { en: { title: 'Summer Sale' } },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    await component.ngOnInit();

    expect(component.banners.length).toBe(1);
    expect(component.banners[0].placement).toBe('homepage-hero');
  });

  it('should create a banner successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/banners`, {
      id: 'banner-new',
      placement: 'sidebar',
      sortOrder: 2,
      active: true,
      content: { en: { title: 'Sidebar Promo' } },
    });

    component.createForm.setValue({
      placement: 'sidebar',
      sortOrder: 2,
      mediaId: '',
      active: true,
      titleEn: 'Sidebar Promo',
      bodyEn: '',
      destinationUrlEn: '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    await component.createBanner();

    const req = http.getLastRequest('POST', `${baseUrl}/v1/admin/banners`);
    expect(req).toBeDefined();
    expect(req!.body.placement).toBe('sidebar');
    expect(req!.body.content.en.title).toBe('Sidebar Promo');
    expect(component.error).toBeNull();
  });

  it('should reject banner with missing placement', async () => {
    http.setError(`${baseUrl}/v1/admin/banners`, new Error('Placement is required'));

    component.createForm.setValue({
      placement: '',
      sortOrder: 1,
      mediaId: '',
      active: true,
      titleEn: '',
      bodyEn: '',
      destinationUrlEn: '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    await component.createBanner();

    expect(component.createForm.invalid).toBe(true);
    expect(component.error).toBeNull();
  });

  it('should handle permission-denied banner creation', async () => {
    http.setError(`${baseUrl}/v1/admin/banners`, new Error('Forbidden: insufficient permissions'));

    component.createForm.setValue({
      placement: 'restricted',
      sortOrder: 1,
      mediaId: '',
      active: true,
      titleEn: 'X',
      bodyEn: '',
      destinationUrlEn: '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    await component.createBanner();

    expect(component.error).toContain('insufficient permissions');
  });

  it('should delete a banner successfully', async () => {
    http.setResponse(`${baseUrl}/v1/admin/banners`, { items: [], total: 0, page: 1, pageSize: 20 });
    await component.ngOnInit();

    http.setResponse(`${baseUrl}/v1/admin/banners/banner-1`, null);
    await component.deleteBanner('banner-1');

    const req = http.getLastRequest('DELETE', `${baseUrl}/v1/admin/banners/banner-1`);
    expect(req).toBeDefined();
  });
});
