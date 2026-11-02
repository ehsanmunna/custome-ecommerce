import { Injectable, inject, signal, type Signal } from '@angular/core';
import { DestroyRef } from '@angular/core';

const DESKTOP_MEDIA_QUERY = '(min-width: 992px)';

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(DESKTOP_MEDIA_QUERY)
      : null;
  private readonly desktop = signal(this.mediaQuery?.matches ?? true);
  private readonly destroyRef = inject(DestroyRef);

  readonly isDesktop: Signal<boolean> = this.desktop.asReadonly();

  constructor() {
    if (!this.mediaQuery) return;

    const onChange = (event: MediaQueryListEvent): void => {
      this.desktop.set(event.matches);
    };

    this.mediaQuery.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => {
      this.mediaQuery?.removeEventListener('change', onChange);
    });
  }
}
