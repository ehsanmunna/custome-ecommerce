import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ADMIN_AUTH_CONFIG, AdminAuthConfig } from '../auth/auth.config';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['received', 'cancelled'],
  received: ['refunded'],
  rejected: [],
  refunded: [],
  cancelled: [],
};

@Component({
  selector: 'app-return-status',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './return-status.component.html',
})
export class ReturnStatusComponent implements OnInit {

  returnId = '';
  ret: { id: string; orderId: string; status: string } | null = null;

  statusForm: FormGroup;
  allowedNextStatuses: string[] = [];

  loading = false;
  changing = false;
  error: string | null = null;
  success: string | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: AdminAuthConfig,
    @Inject(ActivatedRoute) private readonly route: ActivatedRoute,
    @Inject(Router) private readonly router: Router,
  ) {
    this.returnId = this.route.snapshot.paramMap.get('returnId') || '';
    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      note: [''],
    });
  }

  ngOnInit(): void {
    if (!this.returnId) {
      this.error = 'No return ID specified';
      return;
    }
    this.loadReturn();
  }

  loadReturn(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http.get<{ id: string; orderId: string; status: string }>(
      `${this.config.apiBaseUrl}/v1/admin/returns/${this.returnId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to load return';
        return EMPTY;
      }),
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        if (res) {
          this.ret = res;
          const currentStatus = res.status;
          this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
          this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
        }
      }
    });
  }

  changeStatus(): void {
    if (this.statusForm.invalid || !this.ret) return;
    this.changing = true;
    this.error = null;
    this.success = null;
    const token = this.auth.token;
    const value = this.statusForm.value;
    const body: { status: string; note?: string } = { status: value.status };
    if (value.note) body.note = value.note;
    this.http.patch(
      `${this.config.apiBaseUrl}/v1/admin/returns/${this.returnId}/status`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    ).pipe(
      switchMap(() => this.http.get<{ id: string; orderId: string; status: string }>(
        `${this.config.apiBaseUrl}/v1/admin/returns/${this.returnId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )),
      catchError((err: any) => {
        this.error = err?.message ?? 'Failed to update return status';
        return EMPTY;
      }),
      finalize(() => this.changing = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        this.success = `Return status updated to ${value.status}`;
        this.ret = res;
        const currentStatus = res.status;
        this.allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? [];
        this.statusForm.patchValue({ status: this.allowedNextStatuses[0] || '' });
      }
    });
  }
}

