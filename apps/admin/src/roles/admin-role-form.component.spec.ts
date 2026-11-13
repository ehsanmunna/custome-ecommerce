// @vitest-environment jsdom
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AdminRoleFormComponent,
  type RoleFormValue,
} from './admin-role-form.component';
import type { Permission, Role } from './roles.models';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

const permissionCatalog: Permission[] = [
  { key: 'admin.roles.read', description: 'View roles', group: 'admin-roles', sortOrder: 20 },
  { key: 'admin.roles.update', description: 'Update roles', group: 'admin-roles', sortOrder: 10 },
  { key: 'catalog.products.read', description: 'View products', group: 'catalog', sortOrder: 5 },
];

const existingRole: Role = {
  id: 'role-staff',
  key: 'staff',
  name: 'Staff',
  description: 'Store staff',
  scope: 'store',
  system: false,
  permissions: ['admin.roles.read'],
};

@Component({
  standalone: true,
  imports: [AdminRoleFormComponent],
  template: `
    <app-admin-role-form
      [mode]="mode"
      [role]="role"
      [permissions]="permissions"
      [permissionsLoading]="permissionsLoading"
      [permissionsError]="permissionsError"
      [saving]="saving"
      (save)="onSave($event)"
      (cancel)="onCancel()"
      (retryPermissions)="onRetry()"
    ></app-admin-role-form>
  `,
})
class HostComponent {
  mode: 'create' | 'edit' = 'create';
  role: Role | null = null;
  permissions: Permission[] = permissionCatalog;
  permissionsLoading = false;
  permissionsError: string | null = null;
  saving = false;
  saved: RoleFormValue | null = null;
  cancelled = 0;
  retried = 0;

  onSave(value: RoleFormValue): void {
    this.saved = value;
  }

  onCancel(): void {
    this.cancelled++;
  }

  onRetry(): void {
    this.retried++;
  }
}

describe('AdminRoleFormComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  const createFixture = (configure?: (host: HostComponent) => void) => {
    const fixture = TestBed.createComponent(HostComponent);
    if (configure) {
      configure(fixture.componentInstance);
    }
    fixture.detectChanges();
    const form = fixture.debugElement.children[0].componentInstance as AdminRoleFormComponent;
    return { fixture, host: fixture.componentInstance, form };
  };

  it('submits the create payload with key, name, description, and selected permissions', () => {
    const { host, form } = createFixture();

    form.form.get('key')!.setValue('auditor');
    form.form.get('name')!.setValue('Auditor');
    form.form.get('description')!.setValue('Reads everything');
    form.selected.add('admin.roles.read');
    form.submit();

    expect(host.saved).toEqual({
      key: 'auditor',
      name: 'Auditor',
      description: 'Reads everything',
      permissionKeys: ['admin.roles.read'],
    });
  });

  it('omits a blank description from the payload', () => {
    const { host, form } = createFixture();

    form.form.get('key')!.setValue('auditor');
    form.form.get('name')!.setValue('Auditor');
    form.form.get('description')!.setValue('   ');
    form.selected.add('admin.roles.read');
    form.submit();

    expect(host.saved).toEqual({
      key: 'auditor',
      name: 'Auditor',
      permissionKeys: ['admin.roles.read'],
    });
  });

  it('blocks submission when the key pattern does not match', () => {
    const { fixture, host, form } = createFixture();

    form.form.get('key')!.setValue('Bad Key');
    form.form.get('name')!.setValue('Auditor');
    form.selected.add('admin.roles.read');
    form.submit();
    fixture.detectChanges();

    expect(host.saved).toBeNull();
    expect(form.form.get('key')!.touched).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.form-error').length).toBeGreaterThan(0);
  });

  it('blocks submission when no permission is selected', () => {
    const { fixture, host, form } = createFixture();

    form.form.get('key')!.setValue('auditor');
    form.form.get('name')!.setValue('Auditor');
    form.submit();
    fixture.detectChanges();

    expect(host.saved).toBeNull();
    expect(fixture.nativeElement.querySelector('.permission-error')?.textContent).toContain(
      'Select at least one permission',
    );
  });

  it('renders the key and scope read-only when editing', () => {
    const { fixture } = createFixture((host) => {
      host.mode = 'edit';
      host.role = existingRole;
    });

    const keyInput = fixture.nativeElement.querySelector('#role-key') as HTMLInputElement;
    expect(keyInput.readOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('.form-scope')?.textContent?.trim()).toBe('Store');
  });

  it('groups permissions by catalog group and preselects the current grants', () => {
    const { fixture } = createFixture((host) => {
      host.mode = 'edit';
      host.role = existingRole;
    });

    const groups = Array.from(fixture.nativeElement.querySelectorAll('.permission-group')) as HTMLElement[];
    expect(groups).toHaveLength(2);
    expect(groups[0].querySelector('.permission-group-title')?.textContent).toContain('admin-roles');
    expect(groups[0].querySelector('.permission-group-title')?.textContent).toContain('(2)');
    expect(groups[1].querySelector('.permission-group-title')?.textContent).toContain('catalog');

    const checkboxes = Array.from(
      fixture.nativeElement.querySelectorAll('.permission-checkbox'),
    ) as HTMLInputElement[];
    const checkedKeys = checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.closest('.permission-option')?.querySelector('.permission-key')?.textContent?.trim());
    expect(checkedKeys).toEqual(['admin.roles.read']);
  });

  it('shows the catalog failure state without checkboxes and retries on request', () => {
    const { fixture, host } = createFixture((host) => {
      host.permissions = [];
      host.permissionsError = 'Catalog unavailable';
    });

    const state = fixture.nativeElement.querySelector('.permission-error-state') as HTMLElement;
    expect(state.textContent).toContain('Catalog unavailable');
    expect(fixture.nativeElement.querySelectorAll('.permission-checkbox')).toHaveLength(0);

    const retry = state.querySelector('button') as HTMLButtonElement;
    retry.click();
    expect(host.retried).toBe(1);
  });

  it('emits cancel from the Cancel button and the header close button', () => {
    const { fixture, host } = createFixture();

    (fixture.nativeElement.querySelector('.modal-close') as HTMLButtonElement).click();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.modal-footer button'),
    ) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === 'Cancel')!.click();

    expect(host.cancelled).toBe(2);
  });
});
