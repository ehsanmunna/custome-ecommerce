// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PageHeaderComponent, type PageBreadcrumb } from './page-header.component';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

@Component({
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="Roles" [breadcrumbs]="breadcrumbs">
      <button type="button" class="projected-action">New role</button>
    </app-page-header>
  `,
})
class HostComponent {
  readonly breadcrumbs: PageBreadcrumb[] = [
    { label: 'Dashboard', link: '/' },
    { label: 'Settings', link: '/settings' },
    { label: 'Roles' },
  ];
}

describe('PageHeaderComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the breadcrumb before the title row', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const breadcrumb = element.querySelector('.page-header-breadcrumb') as HTMLElement;
    const row = element.querySelector('.page-header-row') as HTMLElement;

    expect(breadcrumb).not.toBeNull();
    expect(row).not.toBeNull();
    expect(breadcrumb.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders breadcrumb labels in order with links where configured', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('.page-header-breadcrumb') as HTMLElement;
    const entries = Array.from(nav.querySelectorAll('a, span')).map((node) =>
      node.textContent?.trim(),
    );

    expect(entries).toEqual(['Dashboard', '>', 'Settings', '>', 'Roles']);
    expect(nav.querySelectorAll('a').length).toBe(2);
  });

  it('renders the title and projects actions in the header row', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const row = element.querySelector('.page-header-row') as HTMLElement;
    const title = row.querySelector('h1') as HTMLElement;
    const actions = row.querySelector('.page-header-actions') as HTMLElement;

    expect(title.textContent?.trim()).toBe('Roles');
    expect(actions.querySelector('.projected-action')?.textContent?.trim()).toBe('New role');
  });
});
