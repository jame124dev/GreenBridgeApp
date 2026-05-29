// Combined value-style import (no inline `type` modifier, no separate
// `import type` line) — the bundled sucrase used by tailwindcss/jiti when
// loading the NativeWind config doesn't accept either TS-4.5+ form here.
// RN's `ViewStyle` is type-only at runtime; sucrase strips it on transform.
import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

// Cross-platform elevation presets. Use `shadows.card` / `shadows.button` etc.
// inside StyleSheet via the spread operator:
//
//   styles.card: { ...shadows.card, ... }
//
// Returns a `ViewStyle` so the spread is type-safe.

type Elevation = ViewStyle;

function make(
  ios: { offsetY: number; opacity: number; radius: number; color?: string },
  androidElevation: number,
  webBoxShadow: string,
): Elevation {
  return Platform.select<Elevation>({
    ios: {
      shadowColor: ios.color ?? colors.inkSlate,
      shadowOffset: { width: 0, height: ios.offsetY },
      shadowOpacity: ios.opacity,
      shadowRadius: ios.radius,
    },
    android: { elevation: androidElevation },
    web: { boxShadow: webBoxShadow } as Elevation,
    default: {},
  }) as Elevation;
}

export const shadows = {
  // No shadow (explicit override)
  none: {} as Elevation,

  // Subtle — stat cards, list rows
  xs: make({ offsetY: 1, opacity: 0.03, radius: 3 }, 1, '0 1px 3px rgba(15, 23, 42, 0.03)'),

  // Default card shadow
  sm: make({ offsetY: 2, opacity: 0.05, radius: 6 }, 2, '0 2px 6px rgba(15, 23, 42, 0.05)'),

  // Section cards / sheets / floating surfaces
  md: make({ offsetY: 2, opacity: 0.04, radius: 6 }, 1, '0 2px 6px rgba(15, 23, 42, 0.04)'),

  // Primary CTA card (Home scan card)
  brand: make(
    { offsetY: 8, opacity: 0.22, radius: 16, color: colors.primary },
    6,
    '0 8px 18px rgba(20, 69, 47, 0.22)',
  ),

  // Login submit button shadow
  button: make(
    { offsetY: 4, opacity: 0.2, radius: 10, color: colors.primary },
    3,
    '0 4px 10px rgba(20, 69, 47, 0.2)',
  ),

  // Form card (login)
  form: make({ offsetY: 8, opacity: 0.06, radius: 24 }, 6, '0 8px 30px rgba(0, 0, 0, 0.06)'),
} as const;

export type ShadowToken = keyof typeof shadows;
