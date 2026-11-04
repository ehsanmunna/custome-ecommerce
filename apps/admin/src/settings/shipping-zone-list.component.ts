import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../auth/auth.config';

export interface ShippingZone {
  id: string;
  code: string;
  name: string;
  fee: number;
  active: boolean;
  districts: string[];
}

export interface ShippingZonePage {
  items: ShippingZone[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-shipping-zone-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-4 max-w-[1000px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Shipping Zones
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Shipping Zones</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('shipping.zones.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Zone</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="zones.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Code</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Name</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Fee (BDT)</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Active</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Districts</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let z of zones">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ z.code }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ z.name }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ (z.fee / 100).toFixed(2) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ z.active ? 'Yes' : 'No' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ z.districts.join(', ') || '-' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(z)" *ngIf="auth.hasPermission('shipping.zones.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteZone(z.id)" *ngIf="auth.hasPermission('shipping.zones.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No shipping zones found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Shipping Zone</h2>
          <form [formGroup]="createForm" (ngSubmit)="createZone()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Code</label>
              <input formControlName="code" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name</label>
              <input formControlName="name" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Fee (BDT)</label>
              <input type="number" formControlName="fee" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Active</label>
              <select formControlName="active" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Create</button>
            <button type="button" (click)="closeCreateModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingZone" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Shipping Zone</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateZone()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Code</label>
              <input formControlName="code" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Name</label>
              <input formControlName="name" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Fee (BDT)</label>
              <input type="number" formControlName="fee" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Active</label>
              <select formControlName="active" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Save</button>
            <button type="button" (click)="closeEditModal()" class="px-4 py-2 border-none rounded-md cursor-pointer ml-2">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class ShippingZoneListComponent implements OnInit {

  zones: ShippingZone[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingZone: ShippingZone | null = null;

  createForm: FormGroup;
  editForm: FormGroup;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {
    this.createForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      fee: [0, Validators.required],
      active: [true],
    });
    this.editForm = this.fb.group({
      code: ['', Validators.required],
      name: ['', Validators.required],
      fee: [0, Validators.required],
      active: [true],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadZones();
  }

  async loadZones(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = (await this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as unknown as ShippingZonePage;
      this.zones = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load shipping zones';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.createForm.reset({ code: '', name: '', fee: 0, active: true });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createZone(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body = {
        code: value.code,
        name: value.name,
        fee: Math.round(parseFloat(value.fee) * 100),
        active: value.active === true || value.active === 'true',
      };
      await this.http.post(`${this.config.apiBaseUrl}/v1/admin/shipping/zones`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.closeCreateModal();
      await this.loadZones();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create shipping zone';
    } finally {
      this.creating = false;
    }
  }

  openEditModal(zone: ShippingZone): void {
    this.editingZone = zone;
    this.editForm.reset({
      code: zone.code,
      name: zone.name,
      fee: zone.fee / 100,
      active: zone.active,
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingZone = null;
  }

  async updateZone(): Promise<void> {
    if (!this.editingZone || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body = {
        code: value.code,
        name: value.name,
        fee: Math.round(parseFloat(value.fee) * 100),
        active: value.active === true || value.active === 'true',
      };
      await this.http.patch(`${this.config.apiBaseUrl}/v1/admin/shipping/zones/${this.editingZone.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.closeEditModal();
      await this.loadZones();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update shipping zone';
    } finally {
      this.updating = false;
    }
  }

  async deleteZone(id: string): Promise<void> {
    if (!confirm('Delete this shipping zone?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/shipping/zones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await this.loadZones();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete shipping zone';
    }
  }
}

