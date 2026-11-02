import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from './auth.service';

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

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  loading = false;
  error: string | null = null;

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const value = this.form.value;
      const email = value.email ?? '';
      const password = value.password ?? '';
      await this.auth.login(email, password);
      await this.router.navigateByUrl(
        this.safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
      );
    } catch {
      this.error = this.transloco.translate('auth.invalidCredentials');
    } finally {
      this.loading = false;
    }
  }

  private safeReturnUrl(value: string | null): string {
    return value && value.startsWith('/') && !value.startsWith('//')
      ? value
      : '/dashboard';
  }
}
