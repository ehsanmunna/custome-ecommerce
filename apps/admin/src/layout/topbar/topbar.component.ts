import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../auth/auth.service';
import { ClientConfigService } from '../../core/config/client-config.service';
import { type ClientLanguage } from '../../core/config/client-config.model';
import { PreferencesService } from '../../core/preferences/preferences.service';
import { LayoutService } from '../layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="layout-topbar" data-testid="admin-topbar">
      <div class="topbar-start">
        <button
          type="button"
          class="icon-button"
          data-testid="sidebar-toggle"
          [attr.aria-label]="'shell.toggleSidebar' | transloco"
          [attr.aria-expanded]="layout.isSidebarActive()"
          (click)="layout.toggleMenu()"
        >
          <i class="pi pi-bars" aria-hidden="true"></i>
        </button>

        <a routerLink="/dashboard" class="brand" data-testid="admin-brand">
          @if (clientConfig.config().logo; as logo) {
            <img [src]="logo" [alt]="clientConfig.config().name" class="brand-logo" />
          } @else {
            <span class="brand-name">
              {{ clientConfig.config().name || ('shell.brandFallback' | transloco) }}
            </span>
          }
        </a>
      </div>

      <div class="topbar-end">
        <div
          class="language-switcher"
          role="group"
          [attr.aria-label]="'shell.language' | transloco"
        >
          <button
            type="button"
            class="language-button"
            data-testid="language-en"
            [class.language-button-active]="preferences.preferences().language === 'en'"
            [attr.aria-pressed]="preferences.preferences().language === 'en'"
            (click)="setLanguage('en')"
          >
            {{ 'shell.english' | transloco }}
          </button>
          <button
            type="button"
            class="language-button"
            data-testid="language-bn"
            [class.language-button-active]="preferences.preferences().language === 'bn'"
            [attr.aria-pressed]="preferences.preferences().language === 'bn'"
            (click)="setLanguage('bn')"
          >
            {{ 'shell.bangla' | transloco }}
          </button>
        </div>

        <button
          type="button"
          class="icon-button"
          data-testid="dark-mode-toggle"
          [attr.aria-label]="'shell.toggleDarkMode' | transloco"
          [attr.aria-pressed]="preferences.preferences().darkMode"
          (click)="preferences.toggleDarkMode()"
        >
          <i
            class="pi"
            [class.pi-moon]="!preferences.preferences().darkMode"
            [class.pi-sun]="preferences.preferences().darkMode"
            aria-hidden="true"
          ></i>
        </button>

        <div class="topbar-user" (click)="$event.stopPropagation()">
          <button
            type="button"
            class="user-button"
            data-testid="user-menu-button"
            aria-haspopup="menu"
            [attr.aria-expanded]="userMenuOpen()"
            [attr.aria-label]="'shell.userMenu' | transloco"
            (click)="toggleUserMenu()"
          >
            <span class="user-avatar" aria-hidden="true">
              {{ userInitial() }}
            </span>
            <span class="user-details">
              <span class="user-name">{{ displayName() }}</span>
              @if (auth.role?.name; as roleName) {
                <span class="user-role">{{ roleName }}</span>
              }
            </span>
            <i class="pi pi-chevron-down user-chevron" aria-hidden="true"></i>
          </button>

          @if (userMenuOpen()) {
            <div class="user-menu" data-testid="user-menu" role="menu">
              <p class="user-menu-heading">
                {{ 'shell.signedInAs' | transloco }}
                <strong>{{ displayName() }}</strong>
              </p>
              <a
                routerLink="/profile"
                class="user-menu-item"
                role="menuitem"
                data-testid="profile-link"
                (click)="closeUserMenu()"
              >
                <i class="pi pi-user" aria-hidden="true"></i>
                {{ 'shell.profile' | transloco }}
              </a>
              <button
                type="button"
                class="user-menu-item"
                role="menuitem"
                data-testid="sign-out"
                (click)="signOut()"
              >
                <i class="pi pi-sign-out" aria-hidden="true"></i>
                {{ 'shell.signOut' | transloco }}
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .layout-topbar {
      position: fixed;
      inset-block-start: 0;
      inset-inline: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      height: 4rem;
      padding-inline: 1rem;
      border-block-end: 1px solid var(--p-content-border-color);
      background: var(--p-surface-0);
      color: var(--p-text-color);
    }

    .topbar-start,
    .topbar-end {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      min-width: 0;
      color: inherit;
      text-decoration: none;
    }

    .brand-logo {
      display: block;
      max-width: 9rem;
      max-height: 2rem;
      object-fit: contain;
    }

    .brand-name {
      overflow: hidden;
      font-size: 1rem;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--p-text-muted-color);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .icon-button:hover {
      background: var(--p-surface-100);
      color: var(--p-text-color);
    }

    .language-switcher {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      padding: 0.125rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.5rem;
    }

    .language-button {
      padding: 0.3rem 0.5rem;
      border: 0;
      border-radius: 0.35rem;
      background: transparent;
      color: var(--p-text-muted-color);
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
    }

    .language-button:hover {
      color: var(--p-text-color);
    }

    .language-button-active {
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color);
    }

    .language-button-active:hover {
      color: var(--p-primary-contrast-color);
    }

    .topbar-user {
      position: relative;
    }

    .user-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .user-button:hover {
      background: var(--p-surface-100);
    }

    .user-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color);
      font-size: 0.8rem;
      font-weight: 600;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
    }

    .user-name {
      font-size: 0.8125rem;
      font-weight: 600;
    }

    .user-role {
      color: var(--p-text-muted-color);
      font-size: 0.6875rem;
    }

    .user-chevron {
      color: var(--p-text-muted-color);
      font-size: 0.7rem;
    }

    .user-menu {
      position: absolute;
      inset-block-start: calc(100% + 0.5rem);
      inset-inline-end: 0;
      z-index: 50;
      display: flex;
      min-width: 14rem;
      flex-direction: column;
      padding: 0.5rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.5rem;
      background: var(--p-surface-0);
      box-shadow: 0 10px 20px -10px color-mix(in srgb, var(--p-text-color) 35%, transparent);
    }

    .user-menu-heading {
      margin: 0;
      padding: 0.5rem 0.6rem;
      color: var(--p-text-muted-color);
      font-size: 0.75rem;
    }

    .user-menu-heading strong {
      color: var(--p-text-color);
      font-weight: 600;
    }

    .user-menu-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.55rem 0.6rem;
      border: 0;
      border-radius: 0.35rem;
      background: transparent;
      color: var(--p-text-color);
      font-size: 0.8125rem;
      text-align: start;
      text-decoration: none;
      cursor: pointer;
    }

    .user-menu-item:hover {
      background: var(--p-surface-100);
    }

    @media (max-width: 640px) {
      .user-details {
        display: none;
      }

      .language-button {
        padding-inline: 0.35rem;
      }
    }
  `,
})
export class TopbarComponent {
  readonly layout = inject(LayoutService);
  readonly preferences = inject(PreferencesService);
  readonly clientConfig = inject(ClientConfigService);
  readonly auth = inject(AuthService);

  private readonly router = inject(Router);

  readonly userMenuOpen = signal(false);

  displayName(): string {
    return this.auth.user?.displayName ?? '';
  }

  userInitial(): string {
    return this.displayName().charAt(0).toUpperCase();
  }

  setLanguage(language: ClientLanguage): void {
    this.preferences.setLanguage(language);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  async signOut(): Promise<void> {
    this.closeUserMenu();

    try {
      await this.auth.logout();
    } catch {
      // AuthService clears the local session even when the server call fails.
    }

    this.preferences.restore(null);
    await this.router.navigate(['/login']);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeUserMenu();
  }
}
