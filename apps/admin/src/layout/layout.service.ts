import { computed, DOCUMENT, DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import { BreakpointService } from './breakpoint.service';

export type MenuMode = 'static' | 'overlay';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly breakpoint = inject(BreakpointService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private previousBodyOverflow: string | null = null;

  readonly isDesktop: Signal<boolean> = this.breakpoint.isDesktop;
  readonly menuMode = signal<MenuMode>('static');
  readonly staticMenuDesktopInactive = signal(false);
  readonly overlayMenuActive = signal(false);
  readonly mobileMenuActive = signal(false);
  readonly activePath = signal<string | null>(null);

  readonly isSidebarActive = computed(() => {
    if (this.isDesktop()) {
      return this.menuMode() === 'overlay'
        ? this.overlayMenuActive()
        : !this.staticMenuDesktopInactive();
    }

    return this.mobileMenuActive();
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.unlockBodyScroll());
  }

  setMenuMode(mode: MenuMode): void {
    this.menuMode.set(mode);
    this.staticMenuDesktopInactive.set(false);
    this.overlayMenuActive.set(false);
    this.closeMenu();
  }

  toggleMenu(): void {
    if (this.isDesktop()) {
      if (this.menuMode() === 'overlay') {
        this.overlayMenuActive.update((active) => !active);
      } else {
        this.staticMenuDesktopInactive.update((inactive) => !inactive);
      }
      return;
    }

    this.setMobileMenuActive(!this.mobileMenuActive());
  }

  closeMenu(): void {
    this.overlayMenuActive.set(false);
    this.setMobileMenuActive(false);
  }

  onRouteChange(url: string): void {
    this.activePath.set(url);
    this.closeMenu();
  }

  private setMobileMenuActive(active: boolean): void {
    if (this.mobileMenuActive() === active) return;

    this.mobileMenuActive.set(active);
    if (active) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  private lockBodyScroll(): void {
    const body = this.document.body;
    if (!body || this.previousBodyOverflow !== null) return;

    this.previousBodyOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    const body = this.document.body;
    if (!body || this.previousBodyOverflow === null) return;

    body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }
}
