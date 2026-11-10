// @vitest-environment jsdom
import '@angular/compiler';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BreakpointService } from './breakpoint.service';
import { LayoutService } from './layout.service';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

describe('LayoutService', () => {
  let service: LayoutService;
  let isDesktop: WritableSignal<boolean>;

  beforeEach(() => {
    isDesktop = signal(true);
    TestBed.configureTestingModule({
      providers: [{ provide: BreakpointService, useValue: { isDesktop } }],
    });
    service = TestBed.inject(LayoutService);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    service.closeMenu();
    document.body.style.overflow = '';
    TestBed.resetTestingModule();
  });

  it('collapses and expands the desktop sidebar in static mode', () => {
    service.setMenuMode('static');

    service.toggleMenu();
    expect(service.staticMenuDesktopInactive()).toBe(true);
    expect(service.isSidebarActive()).toBe(false);

    service.toggleMenu();
    expect(service.staticMenuDesktopInactive()).toBe(false);
    expect(service.isSidebarActive()).toBe(true);
  });

  it('opens and closes the desktop sidebar in overlay mode', () => {
    service.setMenuMode('overlay');

    service.toggleMenu();
    expect(service.overlayMenuActive()).toBe(true);
    expect(service.isSidebarActive()).toBe(true);

    service.closeMenu();
    expect(service.overlayMenuActive()).toBe(false);
    expect(service.isSidebarActive()).toBe(false);
  });

  it('opens and closes the mobile drawer while locking body scroll', () => {
    isDesktop.set(false);

    service.toggleMenu();
    expect(service.mobileMenuActive()).toBe(true);
    expect(service.isSidebarActive()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    service.toggleMenu();
    expect(service.mobileMenuActive()).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the mobile drawer and restores scroll on route change', () => {
    isDesktop.set(false);
    document.body.style.overflow = 'auto';
    service.toggleMenu();

    service.onRouteChange('/orders');

    expect(service.activePath()).toBe('/orders');
    expect(service.mobileMenuActive()).toBe(false);
    expect(document.body.style.overflow).toBe('auto');
  });

  it('closes overlay and mobile menus when the route changes', () => {
    service.setMenuMode('overlay');
    service.toggleMenu();
    service.onRouteChange('/dashboard');

    expect(service.overlayMenuActive()).toBe(false);
    expect(service.activePath()).toBe('/dashboard');

    isDesktop.set(false);
    service.toggleMenu();
    service.onRouteChange('/inventory');

    expect(service.mobileMenuActive()).toBe(false);
    expect(service.activePath()).toBe('/inventory');
  });
});
