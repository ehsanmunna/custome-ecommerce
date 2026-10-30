import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>
      <p>Welcome to the admin dashboard.</p>
    </div>
  `,
  styles: `
    .dashboard { padding: 2rem; }
    .dashboard h1 { margin-top: 0; }
  `,
})
export class DashboardComponent {}
