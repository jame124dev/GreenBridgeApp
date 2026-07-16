import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { brand } from '@/constants/theme';

// PR-3A: characterization baseline for ThinkingDots (mocked in PR-0, so it had
// no coverage). Captured against the CURRENT component, then re-run after the
// StyleSheet→theme-hook migration to prove pixel-identity.

// Minimal reanimated stub (animation-heavy leaf; PR-0 refinement #5 — we
// validate structure/color, not animation fidelity).
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  const Easing = new Proxy({}, { get: () => () => 0 });
  return {
    __esModule: true,
    default: { View: RN.View },
    Easing,
    cancelAnimation: () => {},
    useAnimatedStyle: (fn: () => object) => (typeof fn === 'function' ? fn() : {}),
    useReducedMotion: () => false,
    useSharedValue: (v: number) => ({ value: v }),
    withDelay: (_d: number, v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});

import { ThinkingDots } from '../ThinkingDots';

/** Recursively collect all style.backgroundColor values in a rendered tree. */
function backgroundColors(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { props?: { style?: unknown }; children?: unknown };
  const style = n.props?.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  if (flat && typeof flat === 'object' && 'backgroundColor' in flat) {
    out.push((flat as { backgroundColor: string }).backgroundColor);
  }
  const kids = n.children;
  if (Array.isArray(kids)) kids.forEach((k) => backgroundColors(k, out));
  else if (kids) backgroundColors(kids, out);
  return out;
}

describe('ThinkingDots — characterization', () => {
  it('golden structure', () => {
    expect(render(<ThinkingDots />).toJSON()).toMatchSnapshot();
  });

  it('dots use the placeholder color (brand.placeholder)', () => {
    const colors = backgroundColors(render(<ThinkingDots />).toJSON());
    expect(colors.length).toBeGreaterThan(0);
    // every dot's backgroundColor is the placeholder grey
    for (const c of colors) expect(c).toBe(brand.placeholder);
  });
});
