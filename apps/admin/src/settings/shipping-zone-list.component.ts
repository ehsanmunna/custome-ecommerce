import { Component, inject, OnInit } from '@angular/core';
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
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Shipping Zones
      </nav>

      <h1>Shipping Zones</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('shipping.zones.create')">+ New Zone</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="zones.length; else emptyState">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Fee (BDT)</th>
            <th>Active</th>
            <th>Districts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let z of zones">
            <td>{{ z.code }}</td>
            <td>{{ z.name }}</td>
            <td>{{ (z.fee / 100).toFixed(2) }}</td>
            <td>{{ z.active ? 'Yes' : 'No' }}</td>
            <td>{{ z.districts.join(', ') || '-' }}</td>
            <td>
              <button (click)="openEditModal(z)" *ngIf="auth.hasPermission('shipping.zones.update')">Edit</button>
              <button class="danger" (click)="deleteZone(z.id)" *ngIf="auth.hasPermission('shipping.zones.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No shipping zones found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Shipping Zone</h2>
          <form [formGroup]="createForm" (ngSubmit)="createZone()">
            <div class="field">
              <label>Code</label>
              <input formControlName="code" />
            </div>
            <div class="field">
              <label>Name</label>
              <input formControlName="name" />
            </div>
            <div class="field">
              <label>Fee (BDT)</label>
              <input type="number" formControlName="fee" />
            </div>
            <div class="field">
              <label>Active</label>
              <select formControlName="active">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <button type="submit" [disabled]="createForm.invalid || creating">Create</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </form>
        </div>
      </div>

      <div *ngIf="editModal && editingZone" class="modal">
        <div class="modal-content">
          <h2>Edit Shipping Zone</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateZone()">
            <div class="field">
              <label>Code</label>
              <input formControlName="code" />
            </div>
            <div class="field">
              <label>Name</label>
              <input formControlName="name" />
            </div>
            <div class="field">
              <label>Fee (BDT)</label>
              <input type="number" formControlName="fee" />
            </div>
            <div class="field">
              <label>Active</label>
              <select formControlName="active">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <button type="submit" [disabled]="editForm.invalid || updating">Save</button>
            <button type="button" (click)="closeEditModal()">Cancel</button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: `
    .page { padding: 1rem; max-width: 1000px; margin: 0 auto; }
    .navbar { margin-bottom: 1rem; font-size: 0.9rem; color: #666; }
    .navbar a { color: #007bff; text-decoration: none; }
    h1 { margin-top: 0; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    button { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; }
    button.primary { background: #007bff; color: white; }
    button.danger { background: #dc3545; color: white; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .error { color: #dc3545; margin-bottom: 1rem; }
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; }
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
  `,
})
export class ShippingZoneListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: { apiBaseUrl: string };

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
    httpOrInjector: HttpClient = inject(HttpClient),
    authOrInjector: AuthService = inject(AuthService),
    fbOrInjector: FormBuilder = inject(FormBuilder),
    configOrInjector: { apiBaseUrl: string } = inject(ADMIN_AUTH_CONFIG),
  ) {
    this.http = httpOrInjector;
    this.auth = authOrInjector;
    this.fb = fbOrInjector;
    this.config = configOrInjector;
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
      const res = await this.http.get<ShippingZonePage>(`${this.config.apiBaseUrl}/admin/shipping/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
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
      await this.http.post(`${this.config.apiBaseUrl}/admin/shipping/zones`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
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
      await this.http.patch(`${this.config.apiBaseUrl}/admin/shipping/zones/${this.editingZone.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
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
      await this.http.delete(`${this.config.apiBaseUrl}/admin/shipping/zones/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadZones();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete shipping zone';
    }
  }
}
