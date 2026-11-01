import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminMenuSection, buildAdminMenu } from '../navigation/admin-menu';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex min-h-screen bg-[rgb(var(--color-surface-secondary))]">
      <nav
        data-testid="admin-sidebar"
        class="w-60 shrink-0 border-r border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4"
      >
        <p class="mb-4 mt-0 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">Admin</p>
        @for (section of menuSections; track section.group) {
          <div class="mb-4">
            @if (section.group) {
              <p class="mb-1 mt-0 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                {{ section.group }}
              </p>
            }
            <ul class="m-0 list-none p-0">
              @for (entry of section.entries; track entry.path) {
                <li>
                  <a
                    [routerLink]="entry.path"
                    routerLinkActive="active"
                    class="block rounded-md px-2 py-1 text-sm text-[rgb(var(--color-text-secondary))] no-underline hover:bg-[rgb(var(--color-surface-secondary))]"
                    >{{ entry.label }}</a
                  >
                </li>
              }
            </ul>
          </div>
        }
      </nav>
      <main class="min-w-0 flex-1">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: `
    a.active {
      background-color: rgb(var(--color-primary) / 0.1);
      color: rgb(var(--color-primary));
      font-weight: 600;
    }
  `,
})
export class AdminShellComponent {
  private readonly router = inject(Router);
  readonly menuSections: AdminMenuSection[] = buildAdminMenu(this.router.config);
}
