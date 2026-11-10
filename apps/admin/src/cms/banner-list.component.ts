import { Component, DestroyRef, Inject, OnInit, inject } from '@angular/core';

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
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import {
  NOTIFICATION_MESSAGES,
  isGlobalHttpError,
  extractErrorMessage,
} from '../core/notifications/notification-messages';

export interface BannerContent {
  title?: string;
  body?: string;
  destinationUrl?: string;
}

export interface Banner {
  id: string;
  placement: string;
  sortOrder: number;
  active: boolean;
  mediaId?: string;
  content: Record<string, BannerContent>;
}

export interface BannerPage {
  items: Banner[];
  total: number;
  page: number;
  pageSize: number;
}

function localeBannerTitle(banner: Banner): string {
  const entry = banner.content['en'] ?? Object.values(banner.content)[0];
  return entry?.title || '';
}

@Component({
  selector: 'app-banner-list',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './banner-list.component.html',
})
export class BannerListComponent implements OnInit {
  banners: Banner[] = [];

  loading = false;
  error: string | null = null;

  createModal = false;
  editModal = false;
  creating = false;
  updating = false;
  editingBanner: Banner | null = null;

  private readonly destroyRef = inject(DestroyRef);

  createForm: FormGroup;
  editForm: FormGroup;

  readonly localeBannerTitle = localeBannerTitle;

  constructor(
    @Inject(HttpClient) private readonly http: HttpClient,
    @Inject(AuthService) readonly auth: AuthService,
    @Inject(FormBuilder) private readonly fb: FormBuilder,
    @Inject(ADMIN_AUTH_CONFIG) private readonly config: { apiBaseUrl: string },
    private readonly notification: NotificationService,
  ) {
    this.createForm = this.fb.group({
      placement: ['', Validators.required],
      sortOrder: [0, Validators.required],
      mediaId: [''],
      active: [true],
      titleEn: [''],
      bodyEn: [''],
      destinationUrlEn: [''],
      titleBn: [''],
      bodyBn: [''],
      destinationUrlBn: [''],
    });
    this.editForm = this.fb.group({
      placement: ['', Validators.required],
      sortOrder: [0, Validators.required],
      mediaId: [''],
      active: [true],
      titleEn: [''],
      bodyEn: [''],
      destinationUrlEn: [''],
      titleBn: [''],
      bodyBn: [''],
      destinationUrlBn: [''],
    });
  }

  ngOnInit(): void {
    this.loadBanners();
  }

  loadBanners(): void {
    this.loading = true;
    this.error = null;
    const token = this.auth.token;
    this.http
      .get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        catchError((err: any) => {
          this.error = err?.message ?? 'Failed to load banners';
          return EMPTY;
        }),
        finalize(() => (this.loading = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.banners = res?.items ?? [];
        },
        error: (err) => {
          this.loading = false;
          this.error = extractErrorMessage(err, 'Failed to load banners');
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  buildContent(value: any): Record<string, BannerContent> {
    const content: Record<string, BannerContent> = {};
    if (value.titleEn || value.bodyEn || value.destinationUrlEn) {
      content['en'] = {
        title: value.titleEn,
        body: value.bodyEn,
        destinationUrl: value.destinationUrlEn,
      };
    }
    if (value.titleBn || value.bodyBn || value.destinationUrlBn) {
      content['bn'] = {
        title: value.titleBn,
        body: value.bodyBn,
        destinationUrl: value.destinationUrlBn,
      };
    }
    return content;
  }

  openCreateModal(): void {
    this.createForm.reset({
      placement: '',
      sortOrder: 0,
      mediaId: '',
      active: true,
      titleEn: '',
      bodyEn: '',
      destinationUrlEn: '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    this.createModal = true;
  }

  closeCreateModal(): void {
    this.createModal = false;
  }

  createBanner(): void {
    if (this.createForm.invalid) return;
    this.creating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.createForm.value;
    const body = {
      placement: value.placement,
      sortOrder: Math.round(parseFloat(value.sortOrder)),
      active: value.active === true || value.active === 'true',
      ...(value.mediaId ? { mediaId: value.mediaId } : {}),
      content: this.buildContent(value),
    };
    this.http
      .post(`${this.config.apiBaseUrl}/v1/admin/banners`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        finalize(() => (this.creating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeCreateModal();
          this.banners = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.banner.create);
        },
        error: (err) => {
          this.creating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.banner.createFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  openEditModal(banner: Banner): void {
    this.editingBanner = banner;
    const content = banner.content['en'] ?? Object.values(banner.content)[0] ?? {};
    this.editForm.reset({
      placement: banner.placement,
      sortOrder: banner.sortOrder,
      mediaId: banner.mediaId || '',
      active: banner.active,
      titleEn: content.title || '',
      bodyEn: content.body || '',
      destinationUrlEn: content.destinationUrl || '',
      titleBn: '',
      bodyBn: '',
      destinationUrlBn: '',
    });
    this.editModal = true;
  }

  closeEditModal(): void {
    this.editModal = false;
    this.editingBanner = null;
  }

  updateBanner(): void {
    if (!this.editingBanner || this.editForm.invalid) return;
    this.updating = true;
    this.error = null;
    const token = this.auth.token;
    const value = this.editForm.value;
    const body = {
      placement: value.placement,
      sortOrder: Math.round(parseFloat(value.sortOrder)),
      active: value.active === true || value.active === 'true',
      ...(value.mediaId ? { mediaId: value.mediaId } : {}),
      content: this.buildContent(value),
    };
    this.http
      .patch(`${this.config.apiBaseUrl}/v1/admin/banners/${this.editingBanner.id}`, body, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        finalize(() => (this.updating = false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.closeEditModal();
          this.banners = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.banner.update);
        },
        error: (err) => {
          this.updating = false;
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.banner.updateFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }

  deleteBanner(id: string): void {
    if (!confirm('Delete this banner?')) return;
    this.error = null;
    const token = this.auth.token;
    this.http
      .delete(`${this.config.apiBaseUrl}/v1/admin/banners/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .pipe(
        switchMap(() =>
          this.http.get<BannerPage>(`${this.config.apiBaseUrl}/v1/admin/banners`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.banners = res?.items ?? [];
          this.notification.success(NOTIFICATION_MESSAGES.banner.delete);
        },
        error: (err) => {
          this.error = extractErrorMessage(err, NOTIFICATION_MESSAGES.banner.deleteFailed);
          if (!isGlobalHttpError(err?.status)) {
            this.notification.error(this.error);
          }
        },
      });
  }
}
