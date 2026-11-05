import { Component, OnInit } from '@angular/core';

const STORAGE_KEY = 'admin_theme';
type ThemeName = 'light' | 'dark' | 'client-branded';

const THEME_LABELS: Record<ThemeName, string> = {
  light: 'Light',
  dark: 'Dark',
  'client-branded': 'Client',
};

export function applyTheme(theme: ThemeName): void {
  document.documentElement.classList.remove('light', 'dark', 'client-branded');
  document.documentElement.classList.add(theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function loadTheme(): ThemeName {
  if (typeof window === 'undefined' || !window.localStorage) return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
  if (stored === 'light' || stored === 'dark' || stored === 'client-branded') {
    return stored;
  }
  return 'light';
}

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [],
  template: `
    <div class="theme-toggle" role="group" aria-label="Theme">
      @for (theme of themes; track theme) {
        <button
          [attr.aria-pressed]="currentTheme === theme"
          (click)="selectTheme(theme)"
          class="theme-btn"
          [class.active]="currentTheme === theme"
        >
          {{ getThemeLabel(theme) }}
        </button>
      }
    </div>
  `,
  styles: `
    .theme-toggle {
      display: flex;
      gap: 0.25rem;
      padding: 0.25rem;
      background: var(--color-surface-secondary);
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
    }
    .theme-btn {
      flex: 1;
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 500;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: all 0.2s;
    }
    .theme-btn:hover {
      background: var(--color-border);
      color: var(--color-text);
    }
    .theme-btn.active {
      background: var(--color-primary);
      color: var(--color-primary-foreground);
    }
    .theme-btn.active:hover {
      background: var(--color-primary);
    }
  `,
})
export class ThemeToggleComponent implements OnInit {
  currentTheme: ThemeName = 'light';
  themes: ThemeName[] = ['light', 'dark', 'client-branded'];
  readonly THEME_LABELS = THEME_LABELS;

  ngOnInit(): void {
    this.currentTheme = loadTheme();
    applyTheme(this.currentTheme);
  }

  selectTheme(theme: ThemeName): void {
    this.currentTheme = theme;
    applyTheme(theme);
  }

  getThemeLabel(theme: ThemeName): string {
    return THEME_LABELS[theme];
  }
}
