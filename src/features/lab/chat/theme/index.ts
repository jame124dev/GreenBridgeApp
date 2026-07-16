// Chat theme public surface (D2). Import provider + hooks + the ColorToken type
// from here. Feature-scoped module barrel (like types/index.ts); no global export.
export { ChatThemeProvider } from './ThemeProvider';
export { useTheme, useColor, useElevation, useColorScheme } from './hooks';
export { createThemedStyles } from './createThemedStyles';
export { chatLightTheme } from './lightTheme';
// R2: the D1 §4 dark shipping palette (codified + value-tested; live wiring gated
// on resolving the compat light-pinning — see phase-2-rounds.md).
export { chatDarkTheme } from './darkTheme';
// ⚠️ Phase-1 temporary compatibility bridges (removed in Phase 2) — see phase1Compat.ts.
export { phase1CompatLight } from './phase1Compat';
export type { CompatToken } from './phase1Compat';
export type { Theme, ColorScheme, ColorToken, ElevationLevel, ElevationStyle } from './types';
