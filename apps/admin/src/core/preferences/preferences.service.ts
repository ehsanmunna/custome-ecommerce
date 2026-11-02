import { Inject, Injectable, signal, type Signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  DEFAULT_CLIENT_CONFIG,
  type ClientLanguage,
} from '../config/client-config.model';
import { ClientConfigService } from '../config/client-config.service';

export interface AdminPreferences {
  darkMode: boolean;
  language: ClientLanguage;
}

export const PREFERENCES_STORAGE_PREFIX = 'admin.prefs.';
export const LEGACY_THEME_STORAGE_KEY = 'admin_theme';

const DARK_MODE_CLASS = 'app-dark';
const LEGACY_THEME_CLASSES = ['light', 'dark', 'client-branded'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLanguage(value: unknown): value is ClientLanguage {
  return value === 'en' || value === 'bn';
}

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly storage = typeof window !== 'undefined' ? window.localStorage : null;

  private readonly current = signal<AdminPreferences>({
    darkMode: false,
    language: DEFAULT_CLIENT_CONFIG.defaultLanguage,
  });

  private activeAdminId: string | null = null;

  readonly preferences: Signal<AdminPreferences> = this.current.asReadonly();

  constructor(
    @Inject(ClientConfigService) private readonly clientConfig: ClientConfigService,
    @Inject(TranslocoService) private readonly transloco: TranslocoService,
  ) {
    this.current.set(this.defaults());
  }

  /**
   * Restores the signed-in administrator's preferences, or the client defaults
   * when no administrator is signed in. Safe to call on every session change.
   */
  restore(adminId: string | null): AdminPreferences {
    this.activeAdminId = adminId;

    if (!adminId) {
      this.apply(this.defaults());
      return this.current();
    }

    const stored = this.read(adminId);
    if (stored) {
      this.apply(stored);
      return this.current();
    }

    const migratedDarkMode = this.consumeLegacyTheme();
    const preferences: AdminPreferences = {
      ...this.defaults(),
      ...(migratedDarkMode === undefined ? {} : { darkMode: migratedDarkMode }),
    };

    this.write(adminId, preferences);
    this.apply(preferences);
    return this.current();
  }

  setDarkMode(enabled: boolean): AdminPreferences {
    return this.update({ darkMode: enabled });
  }

  toggleDarkMode(): AdminPreferences {
    return this.setDarkMode(!this.current().darkMode);
  }

  setLanguage(language: ClientLanguage): AdminPreferences {
    return this.update({ language });
  }

  private update(changes: Partial<AdminPreferences>): AdminPreferences {
    const preferences: AdminPreferences = { ...this.current(), ...changes };

    if (this.activeAdminId) {
      this.write(this.activeAdminId, preferences);
    }

    this.apply(preferences);
    return preferences;
  }

  private defaults(): AdminPreferences {
    return {
      darkMode: false,
      language: this.clientConfig.value.defaultLanguage,
    };
  }

  private apply(preferences: AdminPreferences): void {
    this.current.set(preferences);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.toggle(DARK_MODE_CLASS, preferences.darkMode);
      root.setAttribute('data-theme', preferences.darkMode ? 'dark' : 'light');
      for (const legacyClass of LEGACY_THEME_CLASSES) {
        root.classList.remove(legacyClass);
      }
    }

    this.transloco.setActiveLang(preferences.language);
  }

  private storageKey(adminId: string): string {
    return `${PREFERENCES_STORAGE_PREFIX}${adminId}`;
  }

  private read(adminId: string): AdminPreferences | undefined {
    const raw = this.storage?.getItem(this.storageKey(adminId));

    if (!raw) {
      return undefined;
    }

    try {
      const parsed: unknown = JSON.parse(raw);

      if (!isRecord(parsed) || typeof parsed['darkMode'] !== 'boolean' || !isLanguage(parsed['language'])) {
        return undefined;
      }

      return {
        darkMode: parsed['darkMode'],
        language: parsed['language'],
      };
    } catch {
      return undefined;
    }
  }

  private write(adminId: string, preferences: AdminPreferences): void {
    this.storage?.setItem(this.storageKey(adminId), JSON.stringify(preferences));
  }

  /**
   * Converts the pre-Sakai browser-wide theme value into a dark-mode flag.
   * The legacy key is removed after the first read so it cannot leak across
   * accounts.
   */
  private consumeLegacyTheme(): boolean | undefined {
    const legacy = this.storage?.getItem(LEGACY_THEME_STORAGE_KEY);

    if (legacy === null || legacy === undefined) {
      return undefined;
    }

    this.storage?.removeItem(LEGACY_THEME_STORAGE_KEY);
    return legacy === 'dark' || legacy === 'darks';
  }
}
