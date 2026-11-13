// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminUserFormComponent, type AdminRole } from './admin-users-list.component';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

const roles: AdminRole[] = [
  { id: 'role-1', key: 'owner', name: 'Owner' },
  { id: 'role-2', key: 'manager', name: 'Manager' },
];

@Component({
  standalone: true,
  imports: [AdminUserFormComponent],
  template: `
    <app-admin-user-form mode="create" [roles]="roles" (cancel)="onCancel()" />
  `,
})
class HostComponent {
  roles = roles;
  cancelled = 0;

  onCancel(): void {
    this.cancelled++;
  }
}

describe('AdminUserFormComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render the modal from the values passed by the parent', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.modal-title')?.textContent?.trim()).toBe('Add administrator');
    expect(element.querySelectorAll('.form-select option').length).toBe(3);
  });

  it('should notify the parent when the header close button is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.modal-close') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    closeButton.click();

    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('should notify the parent when the Cancel button is clicked', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.modal-footer button'),
    ) as HTMLButtonElement[];
    const cancelButton = buttons.find((button) => button.textContent?.trim() === 'Cancel');
    cancelButton?.click();

    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('should require at least 8 password characters in create mode', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const formComponent = fixture.debugElement.query(
      By.directive(AdminUserFormComponent),
    ).componentInstance as AdminUserFormComponent;

    formComponent.form.patchValue({
      email: 'operator@example.com',
      password: '1234567',
      displayName: 'Operator',
      roleId: 'role-1',
    });

    expect(formComponent.form.valid).toBe(false);
    expect(formComponent.form.get('password')?.hasError('minlength')).toBe(true);

    formComponent.form.patchValue({ password: '12345678' });

    expect(formComponent.form.get('password')?.hasError('minlength')).toBe(false);
    expect(formComponent.form.valid).toBe(true);
  });
});
