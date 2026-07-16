import { describe, it, expect } from '@jest/globals';

import {
  brand,
  buyBlue,
  elevation,
  greenDark,
  greenDarkest,
  greenMedium,
  lab,
} from '@/constants/theme';

import { chatLightTheme } from '../lightTheme';
import type { ColorToken } from '../types';

// PR-2: proves the light theme resolves to TODAY'S EXACT values (so PR-3 can
// migrate components pixel-identically) and that the theme object is a frozen,
// light singleton.

describe('chatLightTheme — value parity with current theme.ts', () => {
  const cases: [ColorToken, string][] = [
    ['bg.canvas', lab.bg],
    ['bg.elevated', brand.surface],
    ['surface.raised', brand.surface],
    ['surface.alt', brand.surfaceMuted],
    ['text.primary', brand.foreground],
    ['text.secondary', brand.textMuted],
    ['text.muted', brand.mutedForeground],
    ['text.onAccent', brand.primaryForeground],
    ['accent', greenDarkest],
    ['accent.pressed', greenDark],
    ['border.subtle', brand.border],
    ['border.strong', brand.borderStrong],
    ['status.success', greenMedium],
    ['status.warning', brand.warning],
    ['status.danger', brand.destructive],
    ['status.info', brand.info],
    ['mode.buy', buyBlue],
    ['mode.sell', greenDarkest],
    // Phase-1 compatibility aliases
    ['text.placeholder', brand.placeholder],
    ['status.dangerStrong', brand.destructiveStrong],
    ['status.dangerSurface', brand.destructiveBg],
  ];

  it.each(cases)('color[%s] === current value', (token, expected) => {
    expect(chatLightTheme.color[token]).toBe(expected);
  });

  it('elevation resolves to the current theme.ts shadows (light = shadow)', () => {
    expect(chatLightTheme.elevation('flat')).toEqual(elevation.none);
    expect(chatLightTheme.elevation('raised')).toEqual(elevation.sm);
    expect(chatLightTheme.elevation('overlay')).toEqual(elevation.md);
    expect(chatLightTheme.elevation('modal')).toEqual(elevation.lg);
  });

  it('is a frozen light singleton', () => {
    expect(chatLightTheme.id).toBe('chat-light');
    expect(chatLightTheme.colorScheme).toBe('light');
    expect(Object.isFrozen(chatLightTheme)).toBe(true);
    expect(Object.isFrozen(chatLightTheme.color)).toBe(true);
  });
});
