import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPalette, PALETTE_SHADES, type PrimaryPalette } from './palette';
import { DEFAULT_CLIENT_CONFIG } from '../config/client-config.model';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function relativeLuminance(color: string): number {
  const value = color.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return componentFiles(path);
    }

    return /\.component\.(ts|html)$/.test(entry.name) ? [path] : [];
  });
}

describe('buildPalette', () => {
  it('produces all eleven shades as six-digit hex values', () => {
    const palette = buildPalette('#2563eb');

    expect(Object.keys(palette)).toHaveLength(PALETTE_SHADES.length);
    for (const shade of PALETTE_SHADES) {
      expect(palette[shade]).toMatch(HEX_COLOR);
    }
  });

  it('keeps the configured colour on shade 500', () => {
    expect(buildPalette('#ABCDEF')[500]).toBe('#abcdef');
  });

  it('orders shades from lightest to darkest', () => {
    const palette: PrimaryPalette = buildPalette('#2563eb');
    const luminances = PALETTE_SHADES.map((shade) => relativeLuminance(palette[shade]));

    for (let index = 1; index < luminances.length; index += 1) {
      expect(luminances[index]).toBeLessThan(luminances[index - 1]);
    }
  });

  it('falls back to the default client colour for invalid input', () => {
    const palette = buildPalette('not-a-colour');

    expect(palette[500]).toBe(DEFAULT_CLIENT_CONFIG.primaryColor);
    for (const shade of PALETTE_SHADES) {
      expect(palette[shade]).toMatch(HEX_COLOR);
    }
  });
});

describe('component colours', () => {
  it('never hardcodes a hex colour in a component', () => {
    const sourceRoot = join(process.cwd(), 'src');
    const offenders = componentFiles(sourceRoot).filter((path) =>
      /#[0-9a-f]{3,8}\b/i.test(readFileSync(path, 'utf8')),
    );

    expect(offenders.map((path) => relative(sourceRoot, path))).toEqual([]);
  });
});
