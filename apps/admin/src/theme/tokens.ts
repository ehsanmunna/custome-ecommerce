export const themeTokens = {
  light: {
    colors: {
      primary: '#2563eb',
      primaryForeground: '#ffffff',
      danger: '#dc2626',
      dangerForeground: '#ffffff',
      success: '#16a34a',
      successForeground: '#ffffff',
      warning: '#ca8a04',
      warningForeground: '#ffffff',
      info: '#0891b2',
      infoForeground: '#ffffff',
      surface: '#ffffff',
      surfaceSecondary: '#f8fafc',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    typography: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  dark: {
    colors: {
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      danger: '#ef4444',
      dangerForeground: '#ffffff',
      success: '#22c55e',
      successForeground: '#ffffff',
      warning: '#eab308',
      warningForeground: '#ffffff',
      info: '#06b6d4',
      infoForeground: '#ffffff',
      surface: '#0f172a',
      surfaceSecondary: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    typography: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  clientBranded: {
    colors: {
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      danger: '#ef4444',
      dangerForeground: '#ffffff',
      success: '#22c55e',
      successForeground: '#ffffff',
      warning: '#eab308',
      warningForeground: '#ffffff',
      info: '#06b6d4',
      infoForeground: '#ffffff',
      surface: '#faf5ff',
      surfaceSecondary: '#e9d5ff',
      text: '#312e81',
      textSecondary: '#5b21b6',
      textMuted: '#7c3aed',
      border: '#ddd6fe',
      shadow: '0 4px 6px -1px rgba(124, 58, 237, 0.2), 0 2px 4px -1px rgba(124, 58, 237, 0.1)',
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem',
    },
    typography: {
      fontFamily: '"Inter", system-ui, sans-serif',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
} as const;

export type ThemeName = keyof typeof themeTokens;
export type ThemeTokens = typeof themeTokens[ThemeName];

export function cssVariableToken(theme: ThemeName): Record<string, string> {
  const tokens = themeTokens[theme];
  const cssVars: Record<string, string> = {};

  const setColors = (prefix: string, obj: Record<string, string>, target: Record<string, string>) => {
    for (const [key, value] of Object.entries(obj)) {
      target[`--color-${prefix}-${key}`] = value;
    }
  };

  setColors('primary', { '': tokens.colors.primary, foreground: tokens.colors.primaryForeground }, cssVars);
  setColors('danger', { '': tokens.colors.danger, foreground: tokens.colors.dangerForeground }, cssVars);
  setColors('success', { '': tokens.colors.success, foreground: tokens.colors.successForeground }, cssVars);
  setColors('warning', { '': tokens.colors.warning, foreground: tokens.colors.warningForeground }, cssVars);
  setColors('info', { '': tokens.colors.info, foreground: tokens.colors.infoForeground }, cssVars);
  setColors('surface', { '': tokens.colors.surface, secondary: tokens.colors.surfaceSecondary }, cssVars);
  setColors('text', { '': tokens.colors.text, secondary: tokens.colors.textSecondary, muted: tokens.colors.textMuted }, cssVars);
  setColors('border', { '': tokens.colors.border }, cssVars);
  setColors('shadow', { '': tokens.colors.shadow }, cssVars);

  for (const [key, value] of Object.entries(tokens.spacing)) {
    cssVars[`--spacing-${key}`] = value;
  }

  for (const [key, value] of Object.entries(tokens.typography.fontSize)) {
    cssVars[`--font-size-${key}`] = value;
  }
  for (const [key, value] of Object.entries(tokens.typography.fontWeight)) {
    cssVars[`--font-weight-${key}`] = value;
  }
  cssVars['--font-family'] = tokens.typography.fontFamily;

  return cssVars;
}
