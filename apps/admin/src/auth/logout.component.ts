import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  template: `<p>Logging out...</p>`,
})
export class LogoutComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
