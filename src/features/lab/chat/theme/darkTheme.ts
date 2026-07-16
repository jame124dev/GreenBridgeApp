// The chat DARK theme (D1 §4 — the SHIPPING chat theme). Values are the D1 §4
// dark-value table verbatim (forest-black canvas, brand-green accent — NOT Gemini
// blue; §17.1). Dark is scoped to the chat surface; the rest of the app stays
// light (D1 §17). Elevation "degrades to color" on dark (§7): depth via borders +
// glow, never drop shadows — so the elevation styles here carry no visible shadow.
//
// STATUS (Phase-2 R2): this object is CODIFIED + value-tested but NOT yet wired
// into the provider. Live wiring is gated on resolving the Phase-1 compat-alias
// light-pinning (cardKit tint maps + `phase1CompatLight` reads are module-scoped,
// so they must become theme-reactive before dark renders correctly) + migrating
// the last two components. See `Docs/chat/process/phase-2-rounds.md` (R2).
import { elevation } from '@/constants/theme';

import { phase1CompatDark } from './phase1Compat';
import type { ColorToken, ElevationLevel, ElevationStyle, Theme } from './types';

// ── Tier-1 primitives (D1 §3) — new dark ramps, inlined here (theme.ts has no
//    forest/ink/alpha ramps). Raw; never referenced by components directly. ──
const forest = { 950: '#0A0F0D', 900: '#111A15', 850: '#16211B', 800: '#1E2A23' };
const ink = { primary: '#F1F5F2', secondary: '#B4C0B8', muted: '#8A988F' };
const green = { 400: '#34D08C', 500: '#16A35A', 800: '#0E3B2E' };
const alpha = {
  white08: 'rgba(255,255,255,0.08)',
  white14: 'rgba(255,255,255,0.14)',
  green18: 'rgba(52,208,140,0.18)',
  black40: 'rgba(0,0,0,0.4)',
};
const status = { success: '#16A35A', warning: '#F59E0B', danger: '#DC2626', info: '#2563EB' };
const blue500 = '#2563EB';

// ── Tier-2 semantic map (D1 §4 dark values). Record<ColorToken,…> is exhaustive
//    at compile time — a missing/extra token is a type error. ──
const color: Record<ColorToken, string> = {
  // D1 §4 verbatim (the 21 shipping dark roles)
  'bg.canvas': forest[950],
  'bg.elevated': forest[900],
  'surface.raised': forest[900],
  'surface.alt': forest[850],
  'surface.hover': forest[800],
  'text.primary': ink.primary,
  'text.secondary': ink.secondary,
  'text.muted': ink.muted,
  'text.onAccent': '#FFFFFF', // neutral.0
  accent: green[400],
  'accent.pressed': green[500],
  'border.subtle': alpha.white08,
  'border.strong': alpha.white14,
  glow: alpha.green18,
  scrim: alpha.black40,
  'status.success': status.success,
  'status.warning': status.warning,
  'status.danger': status.danger,
  'status.info': status.info,
  'mode.buy': blue500,
  'mode.sell': green[800],

  // Dark values for the Phase-1/R1 additive tokens (NOT in D1 §4 — proposed dark
  // equivalents; revisit in the R2 visual-tuning pass). Kept muted/on-dark-legible.
  'text.placeholder': ink.muted, //          input/dots placeholder on dark
  'status.dangerStrong': '#F87171', //        lighter red for text/icon on dark
  'status.dangerSurface': 'rgba(220,38,38,0.16)', // dark danger bubble tint
  'input.text': ink.primary,
  'input.border': alpha.white08,
  'input.placeholder': ink.muted,
  'accent.iconMuted': ink.muted, //           empty-thumb sparkle (muted on dark)

  // Phase-2 R2 screen-chrome utility surfaces on dark (proposed; revisit in the
  // R2 visual-tuning pass).
  'surface.util': forest[850], //             #16211B  composer util-button bg
  'border.util': alpha.white08, //            faint hairline on dark
  'icon.util': ink.secondary, //              #B4C0B8  composer util-button icon

  // R2 listing-sheet migration (LabListingEditSheet) — proposed dark equivalents
  // per D1 §4: sheet is an elevated forest[900] surface; dividers are low-alpha
  // white; status tints/borders mirror the dangerSurface pattern (status hue at
  // 0.16 fill / 0.35 border), warning TEXT lightens to a legible amber.
  'surface.sheet': forest[900], //            #111A15  elevated sheet surface
  'border.divider': alpha.white08, //         rgba(255,255,255,0.08) hairline
  'status.successSurface': 'rgba(22,163,90,0.16)', // success tint fill on dark
  'status.successBorder': 'rgba(22,163,90,0.35)', // success tint border on dark
  'status.warningSurface': 'rgba(245,158,11,0.16)', // warning tint fill on dark
  'status.warningBorder': 'rgba(245,158,11,0.35)', // warning tint border on dark
  'status.warningStrong': '#FBBF24', //       amber-400 warning text, legible on dark
  'status.warningAccent': '#F5B93B', //       warm amber icon/star fill, legible on the forest canvas
};

// Elevation degrades to color on dark (D1 §7): no visible drop shadow — depth is
// carried by the border tokens components already apply. The shadow descriptor is
// therefore transparent/zero; `elevation.none` supplies the shape.
const flat: ElevationStyle = elevation.none;
const noShadow: ElevationStyle = { ...elevation.none, shadowOpacity: 0, elevation: 0 };
const ELEVATION: Record<ElevationLevel, ElevationStyle> = {
  flat,
  raised: noShadow, // depth = color.border.subtle (applied by the component)
  overlay: noShadow, // depth = color.border.strong + faint color.glow
  modal: noShadow,
};

export const chatDarkTheme: Theme = Object.freeze({
  id: 'chat-dark',
  colorScheme: 'dark',
  color: Object.freeze(color),
  compat: Object.freeze(phase1CompatDark),
  elevation: (level: ElevationLevel) => ELEVATION[level],
});
