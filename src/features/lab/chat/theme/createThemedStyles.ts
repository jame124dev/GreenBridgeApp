// Reusable themed-style builder (D2). Lets any chat component define a
// StyleSheet as a function of the resolved theme, memoized on the theme so the
// returned object is referentially stable (the theme is a frozen singleton in
// Phase 1 → computed once per component instance, no per-render churn).
//
// Colors/elevation come from the theme; theme-INDEPENDENT properties
// (spacing/radius/fonts/layout) are still written inline from their direct
// `theme.ts`/`@/constants/theme` imports (D2 §1). Structure mirrors
// `StyleSheet.create`, so migrating a module-level stylesheet to this builder
// keeps the rendered `style` prop shape — and thus PR-0 snapshots — unchanged.
//
//   const useStyles = createThemedStyles((t) => ({
//     card: { backgroundColor: t.color['surface.raised'], borderRadius: radius.md },
//   }));
//   function Card() { const styles = useStyles(); ... }
import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from './hooks';
import type { Theme } from './types';

// Mirror of react-native's StyleSheet.create constraint so a style literal
// type-checks here exactly as it does with StyleSheet.create.
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function createThemedStyles<T extends NamedStyles<T> | NamedStyles<Record<string, unknown>>>(
  factory: (theme: Theme) => T,
): () => T {
  return function useThemedStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
