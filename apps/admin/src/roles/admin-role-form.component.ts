import { Component, EventEmitter, Inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import type { Permission, Role } from './roles.models';

export interface RoleFormValue {
  key: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

export interface PermissionGroup {
  name: string;
  permissions: Permission[];
}

@Component({
  selector: 'app-admin-role-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule],
  template: `
    <div class="modal-overlay" (click)="onBackdropClick($event)">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title">{{ isEdit ? 'Edit role' : 'Add role' }}</h3>
          <button type="button" class="modal-close" aria-label="Close" (click)="onCancel()">
            &times;
          </button>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="modal-body">
            <div class="form-field">
              <label class="form-label" for="role-key">Key</label>
              <input
                id="role-key"
                type="text"
                formControlName="key"
                class="form-input"
                [readOnly]="isEdit"
                placeholder="support-lead"
              />
              @if (isEdit) {
                <p class="form-hint">The key cannot be changed after the role is created.</p>
              }
              @if (form.get('key')?.invalid && form.get('key')?.touched) {
                <p class="form-error">
                  Use lowercase letters, digits, dots, dashes, or underscores, starting with a letter
                  (maximum 200 characters).
                </p>
              }
            </div>

            <div class="form-field">
              <label class="form-label" for="role-name">Name</label>
              <input id="role-name" type="text" formControlName="name" class="form-input" />
              @if (form.get('name')?.invalid && form.get('name')?.touched) {
                <p class="form-error">Name is required (maximum 200 characters).</p>
              }
            </div>

            <div class="form-field">
              <label class="form-label" for="role-description">Description</label>
              <textarea
                id="role-description"
                formControlName="description"
                class="form-input"
                rows="2"
              ></textarea>
              @if (form.get('description')?.invalid && form.get('description')?.touched) {
                <p class="form-error">Description must be 2000 characters or fewer.</p>
              }
            </div>

            <div class="form-field">
              <span class="form-label">Scope</span>
              <p class="form-readonly form-scope">Store</p>
              <p class="form-hint">Roles created here always apply to this store.</p>
            </div>

            <div class="form-field">
              <span class="form-label">Permissions</span>

              @if (permissionsLoading) {
                <p class="permissions-loading">Loading permissions…</p>
              } @else if (permissionsError) {
                <div class="permission-error-state">
                  <p class="form-error">{{ permissionsError }}</p>
                  <p-button
                    type="button"
                    label="Retry"
                    severity="secondary"
                    [text]="true"
                    (onClick)="onRetry()"
                  ></p-button>
                </div>
              } @else {
                <div class="permission-groups">
                  @for (group of permissionGroups; track group.name) {
                    <fieldset class="permission-group">
                      <legend class="permission-group-title">
                        {{ group.name }} <span class="permission-group-count">({{ group.permissions.length }})</span>
                      </legend>
                      @for (permission of group.permissions; track permission.key) {
                        <label class="permission-option">
                          <input
                            type="checkbox"
                            class="permission-checkbox"
                            [checked]="isSelected(permission.key)"
                            (change)="togglePermission(permission.key, $event)"
                          />
                          <span class="permission-key">{{ permission.key }}</span>
                          @if (permission.description) {
                            <span class="permission-description">{{ permission.description }}</span>
                          }
                        </label>
                      }
                    </fieldset>
                  } @empty {
                    <p class="permissions-empty">No permissions are available.</p>
                  }
                </div>
                @if (permissionTouched && selected.size === 0) {
                  <p class="form-error permission-error">Select at least one permission.</p>
                }
              }
            </div>
          </div>

          <div class="modal-footer">
            <p-button
              type="button"
              label="Cancel"
              severity="secondary"
              [text]="true"
              (onClick)="onCancel()"
            ></p-button>
            <p-button
              type="submit"
              [label]="isEdit ? 'Save' : 'Create'"
              severity="primary"
              [disabled]="form.invalid || selected.size === 0 || saving"
            ></p-button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1200;
      }
      .modal {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        width: 720px;
        max-width: 92vw;
        max-height: 88vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      }
      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-border);
      }
      .modal-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text);
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 1.5rem;
        line-height: 1;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 0 0.25rem;
      }
      form {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .modal-body {
        padding: 1.25rem;
        overflow-y: auto;
      }
      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        padding: 1rem 1.25rem;
        border-top: 1px solid var(--color-border);
      }
      .form-field {
        margin-bottom: 1rem;
      }
      .form-label {
        display: block;
        margin-bottom: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text);
      }
      .form-input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-secondary);
        color: var(--color-text);
        font-size: 0.9375rem;
        box-sizing: border-box;
      }
      .form-input[readonly] {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .form-readonly {
        margin: 0;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-secondary);
        color: var(--color-text-muted);
        font-size: 0.9375rem;
      }
      .form-hint {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--color-text-muted);
      }
      .form-error {
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--color-danger);
      }
      .permission-groups {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .permission-group {
        margin: 0;
        padding: 0.5rem 0.75rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
      }
      .permission-group-title {
        padding: 0 0.25rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-text);
      }
      .permission-group-count {
        color: var(--color-text-muted);
        font-weight: 400;
      }
      .permission-option {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.125rem 0;
        font-size: 0.8125rem;
      }
      .permission-key {
        font-family: var(--font-mono, monospace);
        color: var(--color-text);
      }
      .permission-description {
        color: var(--color-text-muted);
      }
      .permissions-loading,
      .permissions-empty {
        font-size: 0.875rem;
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AdminRoleFormComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() role: Role | null = null;
  @Input() permissions: Permission[] = [];
  @Input() permissionsLoading = false;
  @Input() permissionsError: string | null = null;
  @Input() saving = false;

  @Output() save = new EventEmitter<RoleFormValue>();
  @Output() cancel = new EventEmitter<void>();
  @Output() retryPermissions = new EventEmitter<void>();

  readonly selected = new Set<string>();
  permissionTouched = false;

  form!: FormGroup;

  private readonly fb: FormBuilder;

  constructor(@Inject(FormBuilder) fb: FormBuilder) {
    this.fb = fb;
  }

  get isEdit(): boolean {
    return this.mode === 'edit';
  }

  get permissionGroups(): PermissionGroup[] {
    const groups = new Map<string, Permission[]>();

    for (const permission of this.permissions) {
      const entries = groups.get(permission.group) ?? [];
      entries.push(permission);
      groups.set(permission.group, entries);
    }

    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, entries]) => ({
        name,
        permissions: entries
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key)),
      }));
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      key: [
        {
          value: this.role?.key ?? '',
          disabled: this.isEdit,
        },
        [
          Validators.required,
          Validators.maxLength(200),
          Validators.pattern(/^[a-z][a-z0-9_.-]*$/),
        ],
      ],
      name: [this.role?.name ?? '', [Validators.required, Validators.maxLength(200)]],
      description: [this.role?.description ?? '', [Validators.maxLength(2000)]],
    });

    for (const permission of this.role?.permissions ?? []) {
      this.selected.add(permission);
    }
  }

  isSelected(key: string): boolean {
    return this.selected.has(key);
  }

  togglePermission(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selected.add(key);
    } else {
      this.selected.delete(key);
    }
    this.permissionTouched = true;
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel.emit();
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onRetry(): void {
    this.retryPermissions.emit();
  }

  submit(): void {
    if (this.form.invalid || this.selected.size === 0) {
      this.form.markAllAsTouched();
      this.permissionTouched = true;
      return;
    }

    const value = this.form.getRawValue();
    const description = typeof value.description === 'string' ? value.description.trim() : '';

    this.save.emit({
      key: value.key,
      name: value.name,
      ...(description.length > 0 ? { description } : {}),
      permissionKeys: [...this.selected],
    });
  }
}
