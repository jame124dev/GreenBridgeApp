// Chat theme hooks (D2 §5) — the only component-facing access to theme-dependent
// values. Flat scales (space/radius/…) are imported directly from `theme.ts`,
// NOT through a hook (D2 §1). `useBlur` / `useMotion` are intentionally deferred
// (unused in Phase 1) and added when first consumed.
import { useThemeContext } from './ThemeProvider';
import type { ColorScheme, ColorToken, ElevationLevel, ElevationStyle, Theme } from './types';

/** The whole resolved theme. Prefer the narrow hooks below where possible. */
export function useTheme(): Theme {
  return useThemeContext();
}

/** Resolve one semantic color to its value in the active theme. */
export function useColor(token: ColorToken): string {
  return useThemeContext().color[token];
}

/** Theme (+ later platform) resolved depth. Light = a `theme.ts` shadow. */
export function useElevation(level: ElevationLevel): ElevationStyle {
  return useThemeContext().elevation(level);
}

/** Active color scheme — `'light'` throughout Phase 1. */
export function useColorScheme(): ColorScheme {
  return useThemeContext().colorScheme;
}
