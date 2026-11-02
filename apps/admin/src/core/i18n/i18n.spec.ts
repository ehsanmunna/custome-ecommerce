import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPrimeNgTranslation } from './primeng-translation';

const I18N_DIRECTORY = join(process.cwd(), 'src', 'assets', 'i18n');

function loadCatalog(language: 'en' | 'bn'): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(join(I18N_DIRECTORY, `${language}.json`), 'utf8'));

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`The ${language} catalog is not a JSON object.`);
  }

  const flat: Record<string, string> = {};

  const visit = (value: unknown, prefix: string): void => {
    if (typeof value === 'string') {
      flat[prefix] = value;
      return;
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Unsupported translation value at ${prefix}.`);
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, prefix ? `${prefix}.${key}` : key);
    }
  };

  visit(parsed, '');
  return flat;
}

function translateFrom(catalog: Record<string, string>): (key: string) => string {
  return (key) => catalog[key] ?? key;
}

describe('translation catalogs', () => {
  it('have identical keys and no empty values in English and Bangla', () => {
    const english = loadCatalog('en');
    const bangla = loadCatalog('bn');

    expect(Object.keys(english).sort()).toEqual(Object.keys(bangla).sort());
    for (const [key, value] of Object.entries(english)) {
      expect(value.trim(), `English value for ${key}`).not.toBe('');
      expect(bangla[key]?.trim(), `Bangla value for ${key}`).not.toBe('');
    }
  });

  it('cover every PrimeNG label used by the bridge', () => {
    const english = loadCatalog('en');
    const labels = buildPrimeNgTranslation(translateFrom(english));
    const values = [
      labels['emptyMessage'],
      labels['emptyFilterMessage'],
      labels['clear'],
      labels['apply'],
      labels['matchAll'],
      labels['matchAny'],
      labels['addRule'],
      labels['removeRule'],
      labels['accept'],
      labels['reject'],
      labels['aria']?.pageLabel,
      labels['aria']?.firstPageLabel,
      labels['aria']?.lastPageLabel,
      labels['aria']?.nextPageLabel,
      labels['aria']?.prevPageLabel,
      labels['aria']?.rowsPerPageLabel,
      labels['aria']?.jumpToPageDropdownLabel,
      labels['aria']?.jumpToPageInputLabel,
    ];

    expect(values.every((value) => typeof value === 'string' && value.length > 0)).toBe(true);
  });
});

describe('buildPrimeNgTranslation', () => {
  it('updates table, paginator, and dialog labels when the language changes', () => {
    const englishLabels = buildPrimeNgTranslation(translateFrom(loadCatalog('en')));
    const banglaLabels = buildPrimeNgTranslation(translateFrom(loadCatalog('bn')));

    expect(englishLabels['emptyMessage']).not.toBe(banglaLabels['emptyMessage']);
    expect(englishLabels['accept']).not.toBe(banglaLabels['accept']);
    expect(englishLabels['aria']?.rowsPerPageLabel).not.toBe(
      banglaLabels['aria']?.rowsPerPageLabel,
    );
  });
});
