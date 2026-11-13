// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ListToolbarComponent } from './list-toolbar.component';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

@Component({
  standalone: true,
  imports: [ListToolbarComponent],
  template: `
    <app-list-toolbar>
      <input class="projected-search" placeholder="Search" />
      <select class="projected-filter">
        <option value="all">All</option>
      </select>
    </app-list-toolbar>
  `,
})
class HostComponent {}

describe('ListToolbarComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders projected controls inside the toolbar row', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const toolbar = fixture.nativeElement.querySelector('.list-toolbar') as HTMLElement;

    expect(toolbar).not.toBeNull();
    expect(toolbar.querySelector('.projected-search')).not.toBeNull();
    expect(toolbar.querySelector('.projected-filter')).not.toBeNull();
  });
});
