import { Component, DestroyRef, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from './auth.service';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NotificationService } from '../core/notifications/notification.service';
import { isGlobalHttpError, extractErrorMessage } from '../core/notifications/notification-messages';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-[var(--color-surface-secondary)] px-4">
      <div class="w-full max-w-md rounded-lg bg-[var(--color-surface)] p-8 shadow-sm">
        <h1 class="mt-0 text-xl font-semibold text-[var(--color-text)]">
          {{ 'auth.loginTitle' | transloco }}
        </h1>
        <p class="mb-6 mt-2 text-sm text-[var(--color-text-muted)]">
          {{ 'auth.loginSubtitle' | transloco }}
        </p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label for="email" class="mb-2 block font-medium text-[var(--color-text-secondary)]">
              {{ 'auth.email' | transloco }}
            </label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              [placeholder]="'auth.emailPlaceholder' | transloco"
              class="w-full rounded-md border border-[var(--color-border)] p-2 focus:border-[var(--color-primary)] focus:outline-none"
            />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <p class="mt-1 text-sm text-[var(--color-danger)]">
                {{ 'auth.required' | transloco }}
              </p>
            }
          </div>

          <div class="mb-4">
            <label for="password" class="mb-2 block font-medium text-[var(--color-text-secondary)]">
              {{ 'auth.password' | transloco }}
            </label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              [placeholder]="'auth.passwordPlaceholder' | transloco"
              class="w-full rounded-md border border-[var(--color-border)] p-2 focus:border-[var(--color-primary)] focus:outline-none"
            />
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <p class="mt-1 text-sm text-[var(--color-danger)]">
                {{ 'auth.required' | transloco }}
              </p>
            }
          </div>

          @if (error) {
            <p class="mt-1 text-sm text-[var(--color-danger)]">{{ error }}</p>
          }

          <button
            type="submit"
            [disabled]="loading"
            class="mt-2 w-full cursor-pointer rounded-md border-none bg-[var(--color-primary)] p-2 text-base text-[var(--color-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ (loading ? 'auth.signingIn' : 'auth.signIn') | transloco }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = false;
  error: string | null = null;

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    const value = this.form.value;
    const email = value.email ?? '';
    const password = value.password ?? '';
    this.auth.login(email, password).pipe(
      finalize(() => this.loading = false),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        const url = this.safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
        void this.router.navigateByUrl(url);
      },
      error: (err) => {
        const generic = this.transloco.translate('auth.invalidCredentials') ?? 'Invalid credentials';
        this.error = extractErrorMessage(err, generic);
        if (!isGlobalHttpError(err?.status)) {
          this.notification.error(this.error);
        }
      },
    });
  }

  private safeReturnUrl(value: string | null): string {
    return value && value.startsWith('/') && !value.startsWith('//')
      ? value
      : '/dashboard';
  }
}
