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
    <div class="login-page">
      <div class="login-card">
        <h1>Sign in</h1>
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-field">
            <label for="email">Email</label>
            <input id="email" type="email" formControlName="email" />
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <p class="error">Valid email is required</p>
            }
          </div>
          <div class="form-field">
            <label for="password">Password</label>
            <input id="password" type="password" formControlName="password" />
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <p class="error">Password is required</p>
            }
          </div>
          @if (error) {
            <p class="error">{{ error }}</p>
          }
          <button type="submit" [disabled]="loading">{{ loading ? 'Signing in...' : 'Sign in' }}</button>
        </form>
      </div>
    </div>
  `,
  styles: `
    .login-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
    .login-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    .login-card h1 { margin-top: 0; font-size: 1.5rem; }
    .form-field { margin-bottom: 1rem; }
    .form-field label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-field input { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .form-field input:focus { outline: none; border-color: #007bff; }
    .error { color: #dc3545; font-size: 0.875rem; margin-top: 0.25rem; }
    button { width: 100%; padding: 0.6rem; background: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
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
      // If login fails due to expired session, try refresh once
      await this.auth.refresh();
      await this.auth.login(email, password);
    }
  }
}
