// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  provideZonelessChangeDetection,
  signal,
  type WritableSignal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  TranslocoService,
  TranslocoTestingModule,
} from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AdminUser } from '../../auth/auth.service';
import { AuthService } from '../../auth/auth.service';
import { ClientConfigService } from '../../core/config/client-config.service';
import { type ClientConfig } from '../../core/config/client-config.model';
import { PreferencesService } from '../../core/preferences/preferences.service';
import { BreakpointService } from '../breakpoint.service';
import { LayoutService } from '../layout.service';
import { AdminShellComponent } from './admin-shell.component';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

const en = {
  shell: {
    brandFallback: 'Admin',
    toggleSidebar: 'Toggle sidebar',
    toggleDarkMode: 'Toggle dark mode',
    language: 'Language',
    english: 'English',
    bangla: 'Bangla',
    userMenu: 'User menu',
    profile: 'Profile',
    signOut: 'Sign out',
    signedInAs: 'Signed in as',
    skipToContent: 'Skip to content',
    closeMenu: 'Close menu',
    navigation: 'Main navigation',
  },
  menu: {
    dashboard: 'Dashboard',
    products: 'Products',
    orders: 'Orders',
    customers: 'Customers',
    inventory: 'Inventory',
    settings: 'Settings',
    categories: 'Categories',
    brands: 'Brands',
    attributes: 'Attributes',
    media: 'Media',
    adjustStock: 'Adjust stock',
    reservations: 'Reservations',
    stockMovements: 'Stock movements',
    returns: 'Returns',
    shippingZones: 'Shipping zones',
    coupons: 'Coupons',
    cmsPages: 'Pages',
    cmsBanners: 'Banners',
    salesReport: 'Sales report',
    lowStockReport: 'Low-stock report',
  },
};

const bn = {
  shell: {
    brandFallback: 'অ্যাডমিন',
    toggleSidebar: 'সাইডবার দেখান বা লুকান',
    toggleDarkMode: 'ডার্ক মোড পরিবর্তন',
    language: 'ভাষা',
    english: 'English',
    bangla: 'বাংলা',
    userMenu: 'ব্যবহারকারী মেনু',
    profile: 'প্রোফাইল',
    signOut: 'সাইন আউট',
    signedInAs: 'সাইন ইন করেছেন',
    skipToContent: 'মূল বিষয়বস্তুতে যান',
    closeMenu: 'মেনু বন্ধ করুন',
    navigation: 'প্রধান নেভিগেশন',
  },
  menu: {
    dashboard: 'ড্যাশবোর্ড',
    products: 'পণ্য',
    orders: 'অর্ডার',
    customers: 'গ্রাহক',
    inventory: 'ইনভেন্টরি',
    settings: 'সেটিংস',
    categories: 'ক্যাটাগরি',
    brands: 'ব্র্যান্ড',
    attributes: 'অ্যাট্রিবিউট',
    media: 'মিডিয়া',
    adjustStock: 'স্টক সমন্বয়',
    reservations: 'রিজার্ভেশন',
    stockMovements: 'স্টক মুভমেন্ট',
    returns: 'রিটার্ন',
    shippingZones: 'শিপিং জোন',
    coupons: 'কুপন',
    cmsPages: 'পেজ',
    cmsBanners: 'ব্যানার',
    salesReport: 'বিক্রয় প্রতিবেদন',
    lowStockReport: 'কম স্টক প্রতিবেদন',
  },
};

@Component({
  selector: 'app-test-marker',
  standalone: true,
  template: '<p data-testid="marker">marker</p>',
})
class MarkerComponent {}

@Component({
  selector: 'app-test-login-marker',
  standalone: true,
  template: '<p data-testid="login-marker">sign in</p>',
})
class LoginMarkerComponent {}

const testRoutes: Routes = [
  { path: 'login', component: LoginMarkerComponent },
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: 'dashboard', component: MarkerComponent },
      { path: 'orders', component: MarkerComponent },
      { path: 'orders/:orderId', component: MarkerComponent },
    ],
  },
];

const adminUser: AdminUser = {
  id: 'admin-1',
  email: 'owner@example.com',
  displayName: 'Owner User',
  status: 'active',
  role: {
    id: 'role-1',
    key: 'owner',
    name: 'Owner',
    scope: 'store',
    system: true,
    permissions: [],
  },
  permissions: [],
};

function shellRoot(harness: RouterTestingHarness): HTMLElement {
  return harness.fixture.nativeElement as HTMLElement;
}

function menuLink(harness: RouterTestingHarness, href: string): HTMLAnchorElement | null {
  return (
    shellRoot(harness)
      .querySelector('[data-testid="admin-sidebar"]')
      ?.querySelector(`a[href="${href}"]`) ?? null
  );
}

function button(harness: RouterTestingHarness, testId: string): HTMLButtonElement | null {
  return shellRoot(harness).querySelector(`[data-testid="${testId}"]`);
}

describe('AdminShellComponent', () => {
  let isDesktop: WritableSignal<boolean>;
  let clientConfig: WritableSignal<ClientConfig>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.body.style.overflow = '';
    isDesktop = signal(true);
    clientConfig = signal<ClientConfig>({
      name: 'Acme Store',
      primaryColor: '#2563eb',
      defaultLanguage: 'en',
    });
    logout = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en, bn },
          preloadLangs: true,
          translocoConfig: {
            availableLangs: ['en', 'bn'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
          },
        }),
      ],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(testRoutes),
        { provide: BreakpointService, useValue: { isDesktop } },
        { provide: ClientConfigService, useValue: { config: clientConfig, value: clientConfig() } },
        {
          provide: AuthService,
          useValue: {
            user: adminUser,
            role: adminUser.role,
            roleKey: adminUser.role.key,
            logout,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
    document.documentElement.className = '';
    document.body.style.overflow = '';
  });

  it('renders the topbar, sidebar, menu, and routed content', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    expect(shellRoot(harness).querySelector('[data-testid="admin-topbar"]')).not.toBeNull();
    expect(shellRoot(harness).querySelector('[data-testid="admin-sidebar"]')).not.toBeNull();
    expect(shellRoot(harness).querySelector('[data-testid="marker"]')).not.toBeNull();
    expect(menuLink(harness, '/dashboard')?.textContent?.trim()).toBe('Dashboard');
  });

  it('shows the client name when no logo is configured', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    expect(shellRoot(harness).querySelector('[data-testid="admin-brand"]')?.textContent?.trim()).toBe(
      'Acme Store',
    );
    expect(shellRoot(harness).querySelector('.brand-logo')).toBeNull();
  });

  it('shows the configured logo when one is provided', async () => {
    clientConfig.set({
      name: 'Acme Store',
      logo: '/assets/logo.svg',
      primaryColor: '#2563eb',
      defaultLanguage: 'en',
    });
    const harness = await RouterTestingHarness.create('/dashboard');

    expect(shellRoot(harness).querySelector('.brand-logo')?.getAttribute('src')).toBe(
      '/assets/logo.svg',
    );
  });

  it('indicates the parent entry for a nested active route', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    await harness.navigateByUrl('/orders/abc');
    harness.detectChanges();

    expect(menuLink(harness, '/orders')?.classList.contains('menu-link-active')).toBe(true);
    expect(menuLink(harness, '/dashboard')?.classList.contains('menu-link-active')).toBe(false);
  });

  it('changes language from the topbar and re-renders labels', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    button(harness, 'language-bn')?.click();
    harness.detectChanges();

    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('bn');
    expect(menuLink(harness, '/dashboard')?.textContent?.trim()).toBe('ড্যাশবোর্ড');
    expect(TestBed.inject(PreferencesService).preferences().language).toBe('bn');
  });

  it('toggles dark mode from the topbar and persists it for the user', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    expect(document.documentElement.classList.contains('app-dark')).toBe(false);

    button(harness, 'dark-mode-toggle')?.click();
    harness.detectChanges();

    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(TestBed.inject(PreferencesService).preferences().darkMode).toBe(true);
    expect(window.localStorage.getItem('admin.prefs.admin-1')).toContain('"darkMode":true');
  });

  it('signs out from the user menu and returns to the sign-in page', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    button(harness, 'user-menu-button')?.click();
    harness.detectChanges();
    expect(shellRoot(harness).querySelector('[data-testid="user-menu"]')).not.toBeNull();

    button(harness, 'sign-out')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(logout).toHaveBeenCalledOnce();
    expect(shellRoot(harness).querySelector('[data-testid="login-marker"]')).not.toBeNull();
    expect(shellRoot(harness).querySelector('[data-testid="admin-sidebar"]')).toBeNull();
  });

  it('closes the mobile drawer and restores scroll when the mask is clicked', async () => {
    isDesktop.set(false);
    const harness = await RouterTestingHarness.create('/dashboard');
    const layout = TestBed.inject(LayoutService);

    button(harness, 'sidebar-toggle')?.click();
    harness.detectChanges();

    expect(layout.mobileMenuActive()).toBe(true);
    expect(shellRoot(harness).querySelector('[data-testid="layout-mask"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    shellRoot(harness)
      .querySelector<HTMLElement>('[data-testid="layout-mask"]')
      ?.click();
    harness.detectChanges();

    expect(layout.mobileMenuActive()).toBe(false);
    expect(shellRoot(harness).querySelector('[data-testid="layout-mask"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
