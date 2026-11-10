import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastModule } from 'primeng/toast';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../auth/auth.service';
import { PreferencesService } from '../../core/preferences/preferences.service';
import { LayoutService } from '../layout.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, TranslocoPipe, ToastModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#main-content">
      {{ 'shell.skipToContent' | transloco }}
    </a>
    <p-toast [baseZIndex]="1100" />

    <div
      class="layout-wrapper"
      [class.layout-static]="layout.menuMode() === 'static'"
      [class.layout-overlay]="layout.menuMode() === 'overlay'"
      [class.layout-static-inactive]="layout.staticMenuDesktopInactive()"
      [class.layout-overlay-active]="layout.overlayMenuActive()"
      [class.layout-mobile-active]="layout.mobileMenuActive()"
    >
      <app-topbar />
      <app-sidebar />

      @if (layout.overlayMenuActive() || layout.mobileMenuActive()) {
        <div
          class="layout-mask"
          data-testid="layout-mask"
          aria-hidden="true"
          (click)="layout.closeMenu()"
        ></div>
      }

      <main id="main-content" class="layout-main" data-testid="shell-content" tabindex="-1">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--p-surface-50);
      color: var(--p-text-color);
    }

    .layout-wrapper {
      min-height: 100vh;
    }

    .layout-main {
      min-height: 100vh;
      margin-inline-start: 17rem;
      padding: 5rem 1.5rem 1.5rem;
      transition: margin-inline-start 0.2s ease;
    }

    .layout-wrapper.layout-static-inactive .layout-main,
    .layout-wrapper.layout-overlay .layout-main {
      margin-inline-start: 0;
    }

    .layout-mask {
      position: fixed;
      inset: 0;
      z-index: 20;
      background: rgb(0 0 0 / 0.45);
    }

    .skip-link {
      position: fixed;
      inset-block-start: 0.5rem;
      inset-inline-start: 0.5rem;
      z-index: 100;
      padding: 0.5rem 0.75rem;
      border-radius: 0.35rem;
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transform: translateY(-200%);
    }

    .skip-link:focus {
      transform: translateY(0);
    }

    @media (max-width: 991px) {
      .layout-main {
        margin-inline-start: 0;
        padding: 5rem 1rem 1rem;
      }
    }
  `,
})
export class AdminShellComponent {
  readonly layout = inject(LayoutService);

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.preferences.restore(this.auth.user?.id ?? null);
    this.layout.onRouteChange(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.layout.onRouteChange(event.urlAfterRedirects));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.layout.closeMenu();
  }
}
