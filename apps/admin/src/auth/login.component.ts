import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex items-center justify-center min-h-screen bg-[var(--color-surface-secondary)]">
      <div class="bg-[var(--color-surface)] p-8 rounded-lg shadow-sm w-full max-w-md">
        <h1 class="mt-0 text-xl font-semibold text-[var(--color-text)]">Sign in</h1>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label for="email" class="block mb-2 font-medium text-[var(--color-text-secondary)]">Email</label>
            <input id="email" type="email" formControlName="email" class="w-full p-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-primary)]" />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <p class="text-[var(--color-danger)] text-sm mt-1">Valid email is required</p>
            }
          </div>
          <div class="mb-4">
            <label for="password" class="block mb-2 font-medium text-[var(--color-text-secondary)]">Password</label>
            <input id="password" type="password" formControlName="password" class="w-full p-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-primary)]" />
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <p class="text-[var(--color-danger)] text-sm mt-1">Password is required</p>
            }
          </div>
          @if (error) {
            <p class="text-[var(--color-danger)] text-sm mt-1">{{ error }}</p>
          }
          <button type="submit" [disabled]="loading" class="w-full p-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] border-none rounded-md text-base cursor-pointer opacity-60:cursor-not-allowed">{{ loading ? 'Signing in...' : 'Sign in' }}</button>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
      await this.loginWithFallback(email, password);
      await this.router.navigateByUrl('/');
    } catch (err: any) {
      this.error = err?.message ?? 'Login failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  private async loginWithFallback(email: string, password: string): Promise<void> {
    try {
      await this.auth.login(email, password);
    } catch {
      await this.auth.refresh();
      await this.auth.login(email, password);
    }
  }
}
