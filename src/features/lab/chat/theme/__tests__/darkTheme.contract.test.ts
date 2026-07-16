import { describe, it, expect } from '@jest/globals';

import { chatDarkTheme } from '../darkTheme';
import type { ColorToken } from '../types';

// R2: pins the chat dark theme to D1 §4's dark-value table (the shipping palette)
// so the dark surface is provably the approved GreenBidz-dark identity — brand
// green accent (#34D08C), forest-black canvas (#0A0F0D), NOT Gemini blue.

describe('chatDarkTheme — value parity with D1 §4 (dark shipping values)', () => {
  const cases: [ColorToken, string][] = [
    ['bg.canvas', '#0A0F0D'], // forest.950
    ['bg.elevated', '#111A15'], // forest.900
    ['surface.raised', '#111A15'],
    ['surface.alt', '#16211B'], // forest.850
    ['surface.hover', '#1E2A23'], // forest.800
    ['text.primary', '#F1F5F2'], // ink.primary
    ['text.secondary', '#B4C0B8'], // ink.secondary
    ['text.muted', '#8A988F'], // ink.muted
    ['text.onAccent', '#FFFFFF'], // neutral.0
    ['accent', '#34D08C'], // green.400 — brand green, NOT #5C7CFA
    ['accent.pressed', '#16A35A'], // green.500
    ['border.subtle', 'rgba(255,255,255,0.08)'],
    ['border.strong', 'rgba(255,255,255,0.14)'],
    ['glow', 'rgba(52,208,140,0.18)'],
    ['scrim', 'rgba(0,0,0,0.4)'],
    ['status.success', '#16A35A'],
    ['status.warning', '#F59E0B'],
    ['status.danger', '#DC2626'],
    ['status.info', '#2563EB'],
    ['mode.buy', '#2563EB'], // blue.500
    ['mode.sell', '#0E3B2E'], // green.800
  ];

  it.each(cases)('color[%s] === D1 dark value', (token, expected) => {
    expect(chatDarkTheme.color[token]).toBe(expected);
  });

  it('is a frozen dark singleton', () => {
    expect(chatDarkTheme.colorScheme).toBe('dark');
    expect(Object.isFrozen(chatDarkTheme)).toBe(true);
    expect(Object.isFrozen(chatDarkTheme.color)).toBe(true);
  });

  it('elevation degrades to color on dark (no visible drop shadow)', () => {
    expect(chatDarkTheme.elevation('raised').shadowOpacity).toBe(0);
    expect(chatDarkTheme.elevation('overlay').shadowOpacity).toBe(0);
  });
});
