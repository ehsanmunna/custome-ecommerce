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

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minimumOrder: number;
  startsAt: string;
  expiresAt: string;
  active: boolean;
}

export interface CouponPage {
  items: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-coupon-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <nav class="navbar">
        <a routerLink="/">Dashboard</a> &gt; Coupons
      </nav>

      <h1>Coupons</h1>

      <div class="toolbar">
        <button class="primary" (click)="openCreateModal()" *ngIf="auth.hasPermission('promotions.coupons.create')">+ New Coupon</button>
      </div>

      <div *ngIf="error" class="error">{{ error }}</div>

      <table *ngIf="coupons.length; else emptyState">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Value</th>
            <th>Min Order (BDT)</th>
            <th>Starts At</th>
            <th>Expires At</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of coupons">
            <td>{{ c.code }}</td>
            <td>{{ c.discountType }}</td>
            <td>{{ c.discountValue }}</td>
            <td>{{ (c.minimumOrder / 100).toFixed(2) }}</td>
            <td>{{ c.startsAt }}</td>
            <td>{{ c.expiresAt }}</td>
            <td>{{ c.active ? 'Yes' : 'No' }}</td>
            <td>
              <button (click)="openEditModal(c)" *ngIf="auth.hasPermission('promotions.coupons.update')">Edit</button>
              <button class="danger" (click)="deleteCoupon(c.id)" *ngIf="auth.hasPermission('promotions.coupons.delete')">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p>No coupons found.</p>
      </ng-template>

      <div *ngIf="createModal" class="modal">
        <div class="modal-content">
          <h2>Create Coupon</h2>
          <form [formGroup]="createForm" (ngSubmit)="createCoupon()">
            <div class="field">
              <label>Code</label>
              <input formControlName="code" placeholder="e.g. SAVE10" />
            </div>
            <div class="field">
              <label>Discount Type</label>
              <select formControlName="discountType">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div class="field">
              <label>Discount Value</label>
              <input type="number" formControlName="discountValue" />
            </div>
            <div class="field">
              <label>Minimum Order (BDT)</label>
              <input type="number" formControlName="minimumOrder" />
            </div>
            <div class="field">
              <label>Starts At</label>
              <input type="datetime-local" formControlName="startsAt" />
            </div>
            <div class="field">
              <label>Expires At</label>
              <input type="datetime-local" formControlName="expiresAt" />
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

      <div *ngIf="editModal && editingCoupon" class="modal">
        <div class="modal-content">
          <h2>Edit Coupon</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateCoupon()">
            <div class="field">
              <label>Code</label>
              <input formControlName="code" />
            </div>
            <div class="field">
              <label>Discount Type</label>
              <select formControlName="discountType">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div class="field">
              <label>Discount Value</label>
              <input type="number" formControlName="discountValue" />
            </div>
            <div class="field">
              <label>Minimum Order (BDT)</label>
              <input type="number" formControlName="minimumOrder" />
            </div>
            <div class="field">
              <label>Starts At</label>
              <input type="datetime-local" formControlName="startsAt" />
            </div>
            <div class="field">
              <label>Expires At</label>
              <input type="datetime-local" formControlName="expiresAt" />
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
    .page { padding: 1rem; max-width: 1200px; margin: 0 auto; }
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
    .modal-content { background: white; padding: 1.5rem; border-radius: 8px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal-content h2 { margin-top: 0; }
    .field { margin-bottom: 0.75rem; }
    .field label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.9rem; }
    .field input, .field select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .modal-content button { margin-right: 0.5rem; }
    .modal-content button[type="submit"] { background: #007bff; color: white; }
  `,
})
export class CouponListComponent implements OnInit {
  private readonly http: HttpClient;
  private readonly auth: AuthService;
  private readonly fb: FormBuilder;
  private readonly config: { apiBaseUrl: string };

  coupons: Coupon[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingCoupon: Coupon | null = null;

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
      discountType: ['percentage'],
      discountValue: [0, Validators.required],
      minimumOrder: [0, Validators.required],
      startsAt: [''],
      expiresAt: [''],
      active: [true],
    });
    this.editForm = this.fb.group({
      code: ['', Validators.required],
      discountType: ['percentage'],
      discountValue: [0, Validators.required],
      minimumOrder: [0, Validators.required],
      startsAt: [''],
      expiresAt: [''],
      active: [true],
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadCoupons();
  }

  async loadCoupons(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const res = await this.http.get<CouponPage>(`${this.config.apiBaseUrl}/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.coupons = res?.items ?? [];
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to load coupons';
    } finally {
      this.loading = false;
    }
  }

  openCreateModal(): void {
    this.createForm.reset({
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      minimumOrder: 0,
      startsAt: '',
      expiresAt: '',
      active: true,
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  async createCoupon(): Promise<void> {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.createForm.value;
      const body = {
        code: value.code,
        discountType: value.discountType,
        discountValue: Math.round(parseFloat(value.discountValue)),
        minimumOrder: Math.round(parseFloat(value.minimumOrder) * 100),
        startsAt: value.startsAt,
        expiresAt: value.expiresAt,
        active: value.active === true || value.active === 'true',
      };
      await this.http.post(`${this.config.apiBaseUrl}/admin/coupons`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeCreateModal();
      await this.loadCoupons();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to create coupon';
    } finally {
      this.creating = false;
    }
  }

  openEditModal(coupon: Coupon): void {
    this.editingCoupon = coupon;
    this.editForm.reset({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minimumOrder: coupon.minimumOrder / 100,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
      active: coupon.active,
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingCoupon = null;
  }

  async updateCoupon(): Promise<void> {
    if (!this.editingCoupon || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    try {
      const token = this.auth.token;
      const value = this.editForm.value;
      const body = {
        code: value.code,
        discountType: value.discountType,
        discountValue: Math.round(parseFloat(value.discountValue)),
        minimumOrder: Math.round(parseFloat(value.minimumOrder) * 100),
        startsAt: value.startsAt,
        expiresAt: value.expiresAt,
        active: value.active === true || value.active === 'true',
      };
      await this.http.patch(`${this.config.apiBaseUrl}/admin/coupons/${this.editingCoupon.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      this.closeEditModal();
      await this.loadCoupons();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to update coupon';
    } finally {
      this.updating = false;
    }
  }

  async deleteCoupon(id: string): Promise<void> {
    if (!confirm('Delete this coupon?')) return;
    this.error = null;
    try {
      const token = this.auth.token;
      await this.http.delete(`${this.config.apiBaseUrl}/admin/coupons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).toPromise();
      await this.loadCoupons();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete coupon';
    }
  }
}
