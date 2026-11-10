import { DEFAULT_CLIENT_CONFIG } from '../config/client-config.model';

export const PALETTE_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

export type PaletteShade = (typeof PALETTE_SHADES)[number];

export type PrimaryPalette = Record<PaletteShade, string>;

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

interface Hsl {
  hue: number;
  saturation: number;
  lightness: number;
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

function parseHexColor(color: string): Rgb | undefined {
  const match = HEX_COLOR.exec(color.trim());

  if (!match?.[1]) {
    return undefined;
  }

  const value = match[1];
  return {
    red: Number.parseInt(value.slice(0, 2), 16) / 255,
    green: Number.parseInt(value.slice(2, 4), 16) / 255,
    blue: Number.parseInt(value.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl({ red, green, blue }: Rgb): Hsl {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { hue: 0, saturation: 0, lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;

  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) {
    hue += 360;
  }

  return { hue, saturation, lightness };
}

function hslToHex({ hue, saturation, lightness }: Hsl): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSegment = hue / 60;
  const intermediate = chroma * (1 - Math.abs((hueSegment % 2) - 1));

  const [red, green, blue] =
    hueSegment < 1
      ? [chroma, intermediate, 0]
      : hueSegment < 2
        ? [intermediate, chroma, 0]
        : hueSegment < 3
          ? [0, chroma, intermediate]
          : hueSegment < 4
            ? [0, intermediate, chroma]
            : hueSegment < 5
              ? [intermediate, 0, chroma]
              : [chroma, 0, intermediate];

  const matchLightness = lightness - chroma / 2;
  const toHex = (channel: number): string =>
    Math.round(Math.min(1, Math.max(0, channel + matchLightness)) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function lighten(base: number, amount: number): number {
  return base + (1 - base) * amount;
}

function darken(base: number, factor: number): number {
  return base * factor;
}

/**
 * Builds the 11-shade primary palette consumed by the PrimeNG preset.
 * Shade 500 is always the configured colour; lighter and darker shades are
 * derived from the same hue and saturation.
 */
export function buildPalette(primaryColor: string): PrimaryPalette {
  const configuredRgb = parseHexColor(primaryColor);
  const rgb = configuredRgb ?? parseHexColor(DEFAULT_CLIENT_CONFIG.primaryColor);

  if (!rgb) {
    throw new Error('The default client colour must be a six-digit hex value.');
  }

  const { hue, saturation, lightness } = rgbToHsl(rgb);
  const anchor = Math.min(0.86, Math.max(0.2, lightness));

  const lightnessByShade: Record<PaletteShade, number> = {
    50: lighten(anchor, 0.94),
    100: lighten(anchor, 0.83),
    200: lighten(anchor, 0.68),
    300: lighten(anchor, 0.45),
    400: lighten(anchor, 0.22),
    500: anchor,
    600: darken(anchor, 0.82),
    700: darken(anchor, 0.65),
    800: darken(anchor, 0.48),
    900: darken(anchor, 0.33),
    950: darken(anchor, 0.24),
  };

  const palette = PALETTE_SHADES.reduce<PrimaryPalette>((shades, shade) => {
    shades[shade] = hslToHex({ hue, saturation, lightness: lightnessByShade[shade] });
    return shades;
  }, {} as PrimaryPalette);

  if (configuredRgb) {
    palette[500] = primaryColor.trim().toLowerCase();
  }

  return palette;
}
