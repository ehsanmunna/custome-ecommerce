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
    <div class="p-4 max-w-[1200px] mx-auto">
      <nav class="mb-4 text-sm text-[var(--color-text-muted)]">
        <a routerLink="/" class="text-[var(--color-primary)] underline">Dashboard</a> &gt; Coupons
      </nav>

      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Coupons</h1>

      <div class="flex gap-2 mb-4 items-center flex-wrap">
        <button (click)="openCreateModal()" *ngIf="auth.hasPermission('promotions.coupons.create')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">+ New Coupon</button>
      </div>

      <div *ngIf="error" class="text-[var(--color-danger)] mb-4">{{ error }}</div>

      <table *ngIf="coupons.length; else emptyState" class="w-full border-collapse mb-4">
        <thead>
          <tr>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Code</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Type</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Value</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Min Order (BDT)</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Starts At</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Expires At</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Active</th>
            <th class="border border-[var(--color-border)] p-2 text-left bg-[var(--color-surface-secondary)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of coupons">
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.code }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.discountType }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.discountValue }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ (c.minimumOrder / 100).toFixed(2) }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.startsAt }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.expiresAt }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">{{ c.active ? 'Yes' : 'No' }}</td>
            <td class="border border-[var(--color-border)] p-2 text-left">
              <button (click)="openEditModal(c)" *ngIf="auth.hasPermission('promotions.coupons.update')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">Edit</button>
              <button (click)="deleteCoupon(c.id)" *ngIf="auth.hasPermission('promotions.coupons.delete')" class="px-4 py-2 border-none rounded-md cursor-pointer bg-[var(--color-danger)] text-[var(--color-danger-foreground)]">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <ng-template #emptyState>
        <p class="text-[var(--color-text-muted)]">No coupons found.</p>
      </ng-template>

      <div *ngIf="createModal" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Create Coupon</h2>
          <form [formGroup]="createForm" (ngSubmit)="createCoupon()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Code</label>
              <input formControlName="code" placeholder="e.g. SAVE10" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Discount Type</label>
              <select formControlName="discountType" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Discount Value</label>
              <input type="number" formControlName="discountValue" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Minimum Order (BDT)</label>
              <input type="number" formControlName="minimumOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Starts At</label>
              <input type="datetime-local" formControlName="startsAt" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Expires At</label>
              <input type="datetime-local" formControlName="expiresAt" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
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

      <div *ngIf="editModal && editingCoupon" class="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div class="bg-[var(--color-surface)] p-6 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <h2 class="mt-0 text-lg font-semibold text-[var(--color-text)]">Edit Coupon</h2>
          <form [formGroup]="editForm" (ngSubmit)="updateCoupon()">
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Code</label>
              <input formControlName="code" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Discount Type</label>
              <select formControlName="discountType" class="w-full p-2 border border-[var(--color-border)] rounded-md">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Discount Value</label>
              <input type="number" formControlName="discountValue" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Minimum Order (BDT)</label>
              <input type="number" formControlName="minimumOrder" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Starts At</label>
              <input type="datetime-local" formControlName="startsAt" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
            </div>
            <div class="mb-3">
              <label class="block mb-1 font-medium text-sm text-[var(--color-text-secondary)]">Expires At</label>
              <input type="datetime-local" formControlName="expiresAt" class="w-full p-2 border border-[var(--color-border)] rounded-md" />
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
export class CouponListComponent implements OnInit {

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
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
  ) {
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
      const res = (await this.http.get<CouponPage>(`${this.config.apiBaseUrl}/v1/admin/coupons`, {
        headers: { Authorization: `Bearer ${token}` },
      })) as unknown as CouponPage;
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
      await this.http.post(`${this.config.apiBaseUrl}/v1/admin/coupons`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      await this.http.patch(`${this.config.apiBaseUrl}/v1/admin/coupons/${this.editingCoupon.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      await this.http.delete(`${this.config.apiBaseUrl}/v1/admin/coupons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await this.loadCoupons();
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to delete coupon';
    }
  }
}

