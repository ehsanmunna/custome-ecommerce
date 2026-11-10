import { Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export interface ChartColors {
  primary: string;
  primaryLight: string;
  surface: string;
  surfaceLight: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

@Injectable({ providedIn: 'root' })
export class ChartThemeService {
  private readonly document = inject(DOCUMENT);

  private getCssVariable(name: string): string {
    const el = this.document.documentElement;
    if (!el) return '';
    const value = getComputedStyle(el).getPropertyValue(name).trim();
    return value || '';
  }

  getColors(): ChartColors {
    return {
      primary: this.getCssVariable('--p-primary-500'),
      primaryLight: this.getCssVariable('--p-primary-100'),
      surface: this.getCssVariable('--p-surface-500'),
      surfaceLight: this.getCssVariable('--p-surface-100'),
      text: this.getCssVariable('--p-text-color'),
      textMuted: this.getCssVariable('--p-text-muted-color'),
      border: this.getCssVariable('--p-border-color'),
      success: this.getCssVariable('--p-green-500'),
      warning: this.getCssVariable('--p-yellow-500'),
      danger: this.getCssVariable('--p-red-500'),
      info: this.getCssVariable('--p-blue-500'),
    };
  }

  getLineChartDatasets(data: number[]): Array<{ data: number[]; borderColor: string; backgroundColor: string; fill: boolean; tension: number }> {
    const { primary, primaryLight } = this.getColors();
    return [
      {
        data,
        borderColor: primary,
        backgroundColor: primaryLight,
        fill: true,
        tension: 0.4,
      },
    ];
  }

  getDoughnutChartDatasets(counts: number[]): Array<{ data: number[]; backgroundColor: string[]; borderColor: string[] }> {
    const colors = this.getColors();
    const palette = [
      colors.primary,
      colors.success,
      colors.warning,
      colors.danger,
      colors.info,
      colors.surface,
      colors.textMuted,
      colors.border,
    ];

    return [
      {
        data: counts,
        backgroundColor: counts.map((_, i) => palette[i % palette.length]),
        borderColor: counts.map(() => colors.surfaceLight),
      },
    ];
  }
}
