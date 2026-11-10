import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LayoutService } from '../layout.service';
import { type AdminMenuItem } from './admin-menu.config';
import { MenuService } from './menu.service';

export function isMenuEntryActive(entry: AdminMenuItem, currentUrl: string): boolean {
  const path = currentUrl.split('?')[0].split('#')[0];
  const target = entry.routerLink;

  if (path === target || path.startsWith(`${target}/`)) {
    return true;
  }

  return entry.children?.some((child) => isMenuEntryActive(child, path)) ?? false;
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="layout-menu" [attr.aria-label]="'shell.navigation' | transloco">
      <ul class="menu-list">
        @for (entry of menu.menu(); track entry.id) {
          <li class="menu-section">
            <a
              [routerLink]="entry.routerLink"
              class="menu-link"
              [class.menu-link-active]="isActive(entry)"
              [attr.aria-current]="isActive(entry) ? 'page' : null"
              (click)="onNavigate()"
            >
              <i [class]="entry.icon" aria-hidden="true"></i>
              <span class="menu-label">{{ entry.labelKey | transloco }}</span>
            </a>

            @if (entry.children?.length) {
              <ul class="submenu-list">
                @for (child of entry.children; track child.id) {
                  <li>
                    <a
                      [routerLink]="child.routerLink"
                      class="menu-link submenu-link"
                      [class.menu-link-active]="isActive(child)"
                      [attr.aria-current]="isActive(child) ? 'page' : null"
                      (click)="onNavigate()"
                    >
                      <i [class]="child.icon" aria-hidden="true"></i>
                      <span class="menu-label">{{ child.labelKey | transloco }}</span>
                    </a>
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    :host {
      display: block;
      padding: 0.75rem;
    }

    .menu-list,
    .submenu-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .menu-section + .menu-section {
      margin-top: 0.25rem;
    }

    .menu-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.65rem 0.75rem;
      border-radius: 0.5rem;
      color: var(--p-text-muted-color);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .menu-link:hover {
      background: var(--p-surface-100);
      color: var(--p-text-color);
    }

    .menu-link-active {
      background: color-mix(in srgb, var(--p-primary-500) 12%, transparent);
      color: var(--p-primary-500);
      font-weight: 600;
    }

    .menu-link-active:hover {
      background: color-mix(in srgb, var(--p-primary-500) 18%, transparent);
      color: var(--p-primary-500);
    }

    .menu-link .pi {
      width: 1rem;
      font-size: 1rem;
      text-align: center;
    }

    .submenu-list {
      margin-top: 0.125rem;
      padding-inline-start: 1.5rem;
    }

    .submenu-link {
      padding-block: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 400;
    }
  `,
})
export class MenuComponent {
  readonly menu = inject(MenuService);

  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  private readonly currentPath = computed(
    () => this.layout.activePath() ?? this.router.url,
  );

  isActive(entry: AdminMenuItem): boolean {
    return isMenuEntryActive(entry, this.currentPath());
  }

  onNavigate(): void {
    this.layout.closeMenu();
  }
}
