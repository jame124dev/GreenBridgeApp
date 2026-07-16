// Chat theme contracts (D2). All theme types live here. Phase 1 ships the LIGHT
// theme only (reproduces today's pixels); the DARK theme (D1 §4 values) is added
// in Phase 2 behind CHAT_UI_V2. Feature-scoped; imported explicitly.
//
// Per D1/D2, only COLOR + ELEVATION are theme-dependent and flow through the
// provider. The flat scales (space/radius/motion/…) stay direct `theme.ts`
// imports and are intentionally NOT mirrored onto `Theme`.

import type { CompatToken } from './phase1Compat';

export type ColorScheme = 'light' | 'dark';

/**
 * Semantic color roles (D1 §4) that the chat consumes via `useColor`.
 *
 * The first block is D1 §4 verbatim. The trailing block is **Phase-1
 * light-only compatibility aliases** — see `lightTheme.ts` for the TODO. They
 * exist so PR-3 stays pixel-identical against the current (finer-grained) light
 * palette without amending D1. They are folded into the final token set or
 * removed during the Phase-2 design-system migration.
 */
export type ColorToken =
  // ── D1 §4 semantic roles ────────────────────────────────────────────────
  | 'bg.canvas'
  | 'bg.elevated'
  | 'surface.raised'
  | 'surface.alt'
  | 'surface.hover'
  | 'text.primary'
  | 'text.secondary'
  | 'text.muted'
  | 'text.onAccent'
  | 'accent'
  | 'accent.pressed'
  | 'border.subtle'
  | 'border.strong'
  | 'glow'
  | 'scrim'
  | 'status.success'
  | 'status.warning'
  | 'status.danger'
  | 'status.info'
  | 'mode.buy'
  | 'mode.sell'
  // ── Phase-1 light-only compatibility aliases (TODO: fold in Phase 2) ──────
  | 'text.placeholder'
  | 'status.dangerStrong'
  | 'status.dangerSurface'
  // ── Phase-2 R1: input surface + muted placeholder icon (light = today's
  //    lab.* values; dark values added with the dark theme in R2) ────────────
  | 'input.text'
  | 'input.border'
  | 'input.placeholder'
  | 'accent.iconMuted'
  // ── Phase-2 R2: screen-chrome utility surfaces (light = today's lab.util*
  //    values; dark values added with the dark theme in R2) ──────────────────
  | 'surface.util'
  | 'border.util'
  | 'icon.util'
  // ── R2 listing-sheet migration (LabListingEditSheet): sheet body, hairline
  //    dividers, and success/warning status tint surfaces/borders/text. Light =
  //    exact current brand hexes; dark = proposed D1 §4 equivalents. ───────────
  | 'surface.sheet'
  | 'border.divider'
  | 'status.successSurface'
  | 'status.successBorder'
  | 'status.warningSurface'
  | 'status.warningBorder'
  | 'status.warningStrong'
  | 'status.warningAccent';

/** Semantic depth (D1 §7). Light resolves to a `theme.ts` shadow; Phase-2 dark
 *  resolves to border+glow. */
export type ElevationLevel = 'flat' | 'raised' | 'overlay' | 'modal';

/** RN shadow descriptor. `shadowOffset`/`shadowRadius` optional to match the
 *  `theme.ts` `elevation.none` shape (which omits them). */
export interface ElevationStyle {
  shadowColor: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius?: number;
  elevation: number;
}

/** The resolved, read-only theme a component reaches via hooks (D2 §4). */
export interface Theme {
  readonly id: string;
  readonly colorScheme: ColorScheme;
  readonly color: Readonly<Record<ColorToken, string>>;
  /** Phase-1 compatibility bridges, exposed per-scheme so consumers read them
   *  theme-reactively (`t.compat[token]`) instead of the light-pinned singleton.
   *  Folds into `color` (or is deleted) in the design-system migration. */
  readonly compat: Readonly<Record<CompatToken, string>>;
  elevation(level: ElevationLevel): ElevationStyle;
}
