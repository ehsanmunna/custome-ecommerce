// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminShellComponent } from './admin-shell.component';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

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
      { path: 'dashboard', component: MarkerComponent, data: { menu: { label: 'Dashboard' } } },
      { path: 'orders', component: MarkerComponent, data: { menu: { label: 'Orders', group: 'Orders' } } },
      { path: 'orders/:orderId', component: MarkerComponent },
      { path: 'unlisted', component: MarkerComponent },
    ],
  },
];

function shellRoot(harness: RouterTestingHarness): HTMLElement {
  return harness.fixture.nativeElement as HTMLElement;
}

function menuLink(harness: RouterTestingHarness, href: string): HTMLAnchorElement | null {
  return shellRoot(harness).querySelector(`a[href="${href}"]`);
}

describe('AdminShellComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(testRoutes)],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders menu entries derived from the route configuration', async () => {
    const harness = await RouterTestingHarness.create('/dashboard');

    expect(shellRoot(harness).querySelector('[data-testid="admin-sidebar"]')).not.toBeNull();
    expect(menuLink(harness, '/dashboard')?.textContent?.trim()).toBe('Dashboard');
    expect(menuLink(harness, '/orders')?.textContent?.trim()).toBe('Orders');
    expect(menuLink(harness, '/orders/:orderId')).toBeNull();
    expect(menuLink(harness, '/unlisted')).toBeNull();
  });

  it('renders a protected route inside the shell', async () => {
    const harness = await RouterTestingHarness.create('/orders');

    expect(shellRoot(harness).querySelector('[data-testid="admin-sidebar"]')).not.toBeNull();
    expect(shellRoot(harness).querySelector('[data-testid="marker"]')).not.toBeNull();
  });

  it('renders the login route without the shell', async () => {
    const harness = await RouterTestingHarness.create('/login');

    expect(shellRoot(harness).querySelector('[data-testid="login-marker"]')).not.toBeNull();
    expect(shellRoot(harness).querySelector('[data-testid="admin-sidebar"]')).toBeNull();
  });

  it('indicates the active entry for an exact route match', async () => {
    const harness = await RouterTestingHarness.create('/orders');

    expect(menuLink(harness, '/orders')?.classList.contains('active')).toBe(true);
    expect(menuLink(harness, '/dashboard')?.classList.contains('active')).toBe(false);
  });

  it('indicates the parent entry for a nested route match', async () => {
    const harness = await RouterTestingHarness.create('/orders');

    await harness.navigateByUrl('/orders/abc');
    harness.detectChanges();

    expect(menuLink(harness, '/orders')?.classList.contains('active')).toBe(true);
  });

  it('leaves no entry active when the location has no menu entry', async () => {
    const harness = await RouterTestingHarness.create('/unlisted');

    expect(shellRoot(harness).querySelectorAll('a.active').length).toBe(0);
  });
});
