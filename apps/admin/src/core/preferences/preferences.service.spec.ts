// @vitest-environment jsdom
import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranslocoService } from '@jsverse/transloco';
import type { ClientConfigService } from '../config/client-config.service';
import type { ClientLanguage } from '../config/client-config.model';
import {
  LEGACY_THEME_STORAGE_KEY,
  PREFERENCES_STORAGE_PREFIX,
  PreferencesService,
} from './preferences.service';

function createService(defaultLanguage: ClientLanguage = 'en'): {
  service: PreferencesService;
  setActiveLang: ReturnType<typeof vi.fn>;
} {
  const setActiveLang = vi.fn();
  const clientConfig = {
    value: { name: 'Test', primaryColor: '#2563eb', defaultLanguage },
  } as ClientConfigService;
  const transloco = { setActiveLang } as unknown as TranslocoService;

  return {
    service: new PreferencesService(clientConfig, transloco),
    setActiveLang,
  };
}

function storedPreferences(darkMode: boolean, language: ClientLanguage): string {
  return JSON.stringify({ darkMode, language });
}

describe('PreferencesService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('restores persisted preferences and applies them', () => {
    window.localStorage.setItem(
      `${PREFERENCES_STORAGE_PREFIX}admin-1`,
      storedPreferences(true, 'bn'),
    );
    const { service, setActiveLang } = createService();

    const preferences = service.restore('admin-1');

    expect(preferences).toEqual({ darkMode: true, language: 'bn' });
    expect(service.preferences()).toEqual(preferences);
    expect(document.documentElement.classList.contains('app-dark')).toBe(true);
    expect(setActiveLang).toHaveBeenCalledWith('bn');
  });

  it('keeps preferences isolated per administrator', () => {
    window.localStorage.setItem(
      `${PREFERENCES_STORAGE_PREFIX}admin-1`,
      storedPreferences(true, 'bn'),
    );
    window.localStorage.setItem(
      `${PREFERENCES_STORAGE_PREFIX}admin-2`,
      storedPreferences(false, 'en'),
    );
    const { service } = createService();

    expect(service.restore('admin-1')).toEqual({ darkMode: true, language: 'bn' });
    expect(service.restore('admin-2')).toEqual({ darkMode: false, language: 'en' });
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
  });

  it('uses client defaults for anonymous screens without touching stored preferences', () => {
    const stored = storedPreferences(true, 'bn');
    window.localStorage.setItem(`${PREFERENCES_STORAGE_PREFIX}admin-1`, stored);
    const { service, setActiveLang } = createService('bn');

    const preferences = service.restore(null);

    expect(preferences).toEqual({ darkMode: false, language: 'bn' });
    expect(document.documentElement.classList.contains('app-dark')).toBe(false);
    expect(setActiveLang).toHaveBeenCalledWith('bn');
    expect(window.localStorage.getItem(`${PREFERENCES_STORAGE_PREFIX}admin-1`)).toBe(stored);
  });

  it('migrates the legacy admin_theme value for the first signed-in user', () => {
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, 'darks');
    const { service } = createService();

    const preferences = service.restore('admin-1');

    expect(preferences.darkMode).toBe(true);
    expect(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem(`${PREFERENCES_STORAGE_PREFIX}admin-1`) ?? '{}'),
    ).toEqual({ darkMode: true, language: 'en' });
  });

  it('persists later changes under the active administrator', () => {
    const { service } = createService();

    service.restore('admin-1');
    service.setDarkMode(true);
    service.setLanguage('bn');

    expect(
      JSON.parse(window.localStorage.getItem(`${PREFERENCES_STORAGE_PREFIX}admin-1`) ?? '{}'),
    ).toEqual({ darkMode: true, language: 'bn' });
  });
});
