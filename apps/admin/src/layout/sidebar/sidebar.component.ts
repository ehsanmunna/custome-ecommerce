import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LayoutService } from '../layout.service';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [MenuComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="layout-sidebar" data-testid="admin-sidebar">
      <div class="sidebar-mobile-header">
        <button
          type="button"
          class="close-button"
          data-testid="sidebar-close"
          [attr.aria-label]="'shell.closeMenu' | transloco"
          (click)="layout.closeMenu()"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </div>
      <app-menu />
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }

    .layout-sidebar {
      position: fixed;
      inset-block: 4rem 0;
      inset-inline-start: 0;
      z-index: 30;
      display: flex;
      width: 17rem;
      flex-direction: column;
      overflow-y: auto;
      border-inline-end: 1px solid var(--p-content-border-color);
      background: var(--p-surface-0);
      transition: transform 0.2s ease;
    }

    :host-context(.layout-static-inactive) .layout-sidebar {
      transform: translateX(-100%);
    }

    :host-context(.layout-overlay) .layout-sidebar {
      transform: translateX(-100%);
    }

    :host-context(.layout-overlay.layout-overlay-active) .layout-sidebar {
      transform: translateX(0);
    }

    .sidebar-mobile-header {
      display: none;
      justify-content: flex-end;
      padding: 0.75rem 0.75rem 0;
    }

    .close-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--p-text-muted-color);
      cursor: pointer;
    }

    .close-button:hover {
      background: var(--p-surface-100);
      color: var(--p-text-color);
    }

    @media (max-width: 991px) {
      .layout-sidebar {
        transform: translateX(-100%);
      }

      :host-context(.layout-mobile-active) .layout-sidebar {
        transform: translateX(0);
      }

      .sidebar-mobile-header {
        display: flex;
      }
    }
  `,
})
export class SidebarComponent {
  readonly layout = inject(LayoutService);
}
