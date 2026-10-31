import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="p-8">
      <h1 class="mt-0 text-2xl font-semibold text-[var(--color-text)]">Dashboard</h1>
      <p class="text-[var(--color-text-secondary)]">Welcome to the admin dashboard.</p>
    </div>
  `,
})
export class DashboardComponent {}
