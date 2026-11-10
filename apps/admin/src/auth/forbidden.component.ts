import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-[var(--color-surface-secondary)] px-4">
      <div class="w-full max-w-md rounded-lg bg-[var(--color-surface)] p-8 text-center shadow-sm">
        <p class="mb-2 text-5xl font-semibold text-[var(--color-danger)]">403</p>
        <h1 class="mt-0 text-xl font-semibold text-[var(--color-text)]">
          {{ 'auth.forbiddenTitle' | transloco }}
        </h1>
        <p class="mb-6 mt-2 text-sm text-[var(--color-text-muted)]">
          {{ 'auth.forbiddenMessage' | transloco }}
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            routerLink="/dashboard"
            class="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm text-[var(--color-primary-foreground)] no-underline"
          >
            {{ 'auth.backToDashboard' | transloco }}
          </a>
          <a
            routerLink="/login"
            class="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] no-underline"
          >
            {{ 'auth.returnToSignIn' | transloco }}
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ForbiddenComponent {}
