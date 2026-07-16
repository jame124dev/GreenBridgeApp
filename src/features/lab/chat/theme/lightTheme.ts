// The chat LIGHT theme (D2) — Phase 1's shipping theme. Every value is pulled
// from the existing `theme.ts` (the Phase-1 primitive source; per PR-2 refinement
// #1 we do NOT introduce a separate primitives module yet) so the theme resolves
// to TODAY'S EXACT pixels. Nothing here changes appearance until PR-3 migrates
// components to read these tokens.
//
// The DARK theme (D1 §4 values) is added in Phase 2 behind CHAT_UI_V2.
import {
  brand,
  buyBlue,
  elevation,
  greenDark,
  greenDarkest,
  greenMedium,
} from '@/constants/theme';
import { lab } from '@/constants/theme';

import { phase1CompatLight } from './phase1Compat';
import type { ColorToken, ElevationLevel, ElevationStyle, Theme } from './types';

// Record<ColorToken, string> makes this exhaustive at compile time: a missing
// or extra token is a type error.
const color: Record<ColorToken, string> = {
  // ── D1 §4 roles → current light values ────────────────────────────────────
  'bg.canvas': lab.bg, //            #F4F7F4  chat screen background
  'bg.elevated': brand.surface, //   #ffffff  sheets / elevated panels
  'surface.raised': brand.surface, // #ffffff  bubble / input surface
  'surface.alt': brand.surfaceMuted, // #eef4ff  source chip / muted surface
  'surface.hover': brand.surfaceMuted, // #eef4ff pressed/hover (unused in Phase 1)
  'text.primary': brand.foreground, // #121c28  AI prose / body
  'text.secondary': brand.textMuted, // #5b6b63  bullets / supporting
  'text.muted': brand.mutedForeground, // #6b7280 sources label / captions
  'text.onAccent': brand.primaryForeground, // #ffffff  text on accent fill
  accent: greenDarkest, //           #0E3B2E  links / sell accent
  'accent.pressed': greenDark, //    #16794A  pressed accent (unused in Phase 1)
  'border.subtle': brand.border, //  #dfe5ec  bot bubble / chip border
  'border.strong': brand.borderStrong, // #c0c9c1 emphasized separators
  glow: brand.brandGlow, //          #81b296  (unused in Phase 1; dark uses it)
  scrim: 'rgba(0,0,0,0.4)', //                sheet/modal backdrop (unused Phase 1)
  'status.success': greenMedium, //  #16A35A  source dot / success
  'status.warning': brand.warning, // #f59e0b
  'status.danger': brand.destructive, // #dc3737  danger base
  'status.info': brand.info, //      #3b82f6
  'mode.buy': buyBlue, //            #2563EB  buyer accent / user bubble (buy)
  'mode.sell': greenDarkest, //      #0E3B2E  seller accent / user bubble (sell)

  // ── Phase-1 light-only compatibility aliases ──────────────────────────────
  // TODO(Phase-2 design-system migration): the current light palette is
  // finer-grained than D1 §4's dark-oriented roles. These three aliases let PR-3
  // migrate ChatMessage/cards/ThinkingDots pixel-identically. During the Phase-2
  // migration, fold them into the final semantic token set (D1 §4) or remove.
  'text.placeholder': brand.placeholder, //     #9ca3af  ThinkingDots dots
  'status.dangerStrong': brand.destructiveStrong, // #b91c1c error text/icon
  'status.dangerSurface': brand.destructiveBg, // #fef2f2 error bubble bg

  // ── Phase-2 R1: WTB input surface + muted placeholder icon (light values =
  // today's lab.*/brand.primaryAccent, so migrating the deferred inputs is
  // pixel-identical; dark values land in R2). ────────────────────────────────
  'input.text': lab.ink, //                      #10201A  budget/qty input text
  'input.border': lab.hairline, //               #E7EDE8  input/toggle hairline
  'input.placeholder': lab.inkFaint, //          #90A096  input placeholder
  'accent.iconMuted': brand.primaryAccent, //    #9fd2b4  empty-thumb sparkle

  // ── Phase-2 R2: screen-chrome utility surfaces (light values = today's
  // lab.util* values, so migrating the chat chrome is pixel-identical; dark
  // values land in darkTheme.ts). ─────────────────────────────────────────────
  'surface.util': lab.utilBg, //                 #F6F8F6  composer util-button bg
  'border.util': lab.utilBorder, //              #E1E8E3  composer util-button border
  'icon.util': lab.utilIcon, //                  #34503F  composer util-button icon

  // ── R2 listing-sheet migration (LabListingEditSheet). Light values are the
  // EXACT current hardcoded brand hexes so migrating the sheet is pixel-identical;
  // dark values land in darkTheme.ts. ─────────────────────────────────────────
  'surface.sheet': '#f8f9ff', //                 sheet body background
  'border.divider': '#eef2f9', //                header/footer hairline dividers
  'status.successSurface': '#f0fdf4', //         success-tint fill (verified pills)
  'status.successBorder': '#bbf7d0', //          success-tint border
  'status.warningSurface': '#fffbeb', //         warning-tint fill (verify pills, bars)
  'status.warningBorder': '#fde68a', //          warning-tint border
  'status.warningStrong': '#b45309', //          warning TEXT on warning surfaces
  'status.warningAccent': '#E8A21A', //          amber icon/star fill ("worth a look" 91–94% match)
};

// Light elevation = the current `theme.ts` shadows (D1 §7: dark degrades to
// border+glow in Phase 2, resolved by the dark theme's own elevation map).
const ELEVATION: Record<ElevationLevel, ElevationStyle> = {
  flat: elevation.none,
  raised: elevation.sm,
  overlay: elevation.md,
  modal: elevation.lg,
};

export const chatLightTheme: Theme = Object.freeze({
  id: 'chat-light',
  colorScheme: 'light',
  color: Object.freeze(color),
  compat: Object.freeze(phase1CompatLight),
  elevation: (level: ElevationLevel) => ELEVATION[level],
});
