import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, type AdminUser } from '../auth/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile" *ngIf="user; else loading">
      <h1>Profile</h1>
      <p><strong>Email:</strong> {{ user.email }}</p>
      <p><strong>Display name:</strong> {{ user.displayName }}</p>
      <p><strong>Status:</strong> {{ user.status }}</p>
      <p><strong>Role:</strong> {{ user.role.name }}</p>
      <p><strong>Permissions:</strong> {{ (user.permissions || []).join(', ') }}</p>
      <button (click)="logout()">Sign out</button>
    </div>
    <ng-template #loading><p>Loading profile...</p></ng-template>
  `,
  styles: `
    .profile { padding: 2rem; }
    .profile h1 { margin-top: 0; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; background: var(--color-danger); color: var(--color-danger-foreground); border: none; border-radius: 4px; cursor: pointer; }
  `,
})
export class ProfileComponent implements OnInit {
  private readonly auth = inject(AuthService);
  user: AdminUser | null = null;

  async ngOnInit(): Promise<void> {
    try {
      this.user = await this.auth.me();
    } catch {
      this.user = null;
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }
}
