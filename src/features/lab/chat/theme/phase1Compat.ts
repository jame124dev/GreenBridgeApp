// ⚠️ PHASE-1 COMPATIBILITY LAYER — TEMPORARY IMPLEMENTATION BRIDGES.
//
// These are NOT part of the permanent design system (D1) and are kept ISOLATED
// from the semantic `ColorToken` set on purpose. The chat cards use a
// finer-grained palette than D1's (dark-oriented) semantic roles cover; each
// alias maps a card color to its CURRENT `theme.ts` value so the PR-3B card
// migrations stay pixel-identical without expanding D1.
//
// R2: these are now exposed THROUGH the theme (`theme.compat[token]`) so they are
// scheme-reactive — `phase1CompatLight` for the light theme, `phase1CompatDark` for
// the dark theme. Consumers read `t.compat[token]` (theme-aware), replacing the old
// module-scope `phase1CompatLight[...]` reads that were light-pinned. Still isolated
// from `ColorToken`; still slated to fold into D1 (or delete) in the design-system
// migration — but no longer a blocker for the dark theme.
//
// Every alias documents: reason · originating PR · planned removal · TODO.
import { brand, warnAmber } from '@/constants/theme';

export type CompatToken =
  | 'border.divider'
  | 'status.warningSurface'
  | 'status.warningStrong'
  | 'status.successSurface'
  | 'status.successBorder'
  | 'status.infoStrong'
  | 'status.infoSurface'
  | 'accent.meterWarn';

export const phase1CompatLight: Record<CompatToken, string> = {
  // reason: card hairlines (detail rows, shell header, queue/footer borders) #eef2f9,
  //   distinct from D1 `border.subtle` #dfe5ec · PR-3B-0 · remove: Phase 2
  //   TODO(Phase 2): fold into a D1 border token (e.g. border.hairline) or remove.
  'border.divider': brand.divider,
  // reason: warning surface fill (price-need bar, skip head) #fffbeb · PR-3B-0
  //   remove: Phase 2 · TODO(Phase 2): fold into a D1 status.warning* set.
  'status.warningSurface': brand.warningBg,
  // reason: strong warning text/icon (need chips, meter needs, skip rows) #b45309
  //   PR-3B-0 · remove: Phase 2 · TODO(Phase 2): fold into D1 status.warning*.
  'status.warningStrong': brand.warningText,
  // reason: success surface fill (draft/created cards, chips, queue-active) #f0fdf4
  //   PR-3B-0 · remove: Phase 2 · TODO(Phase 2): fold into D1 status.success*.
  'status.successSurface': brand.successBg,
  // reason: success border (stat-tile accent, queue rows, toggle-on) #bbf7d0
  //   PR-3B-0 · remove: Phase 2 · TODO(Phase 2): fold into D1 status.success*.
  'status.successBorder': brand.successBorder,
  // reason: strong info text (batch/bid "upcoming/counter" tints) #1d4ed8 · PR-3B-0
  //   remove: Phase 2 · TODO(Phase 2): fold into D1 status.info*.
  'status.infoStrong': brand.infoText,
  // reason: info surface fill (batch/bid info tints) #eff6ff · PR-3B-0
  //   remove: Phase 2 · TODO(Phase 2): fold into D1 status.info*.
  'status.infoSurface': brand.infoBg,
  // reason: draft completion-meter amber, distinct from status.warning #f59e0b — #E8A21A
  //   PR-3B-0 · remove: Phase 2 · TODO(Phase 2): fold into a D1 accent/meter token.
  'accent.meterWarn': warnAmber,
};

// Dark counterparts (R2). Proposed values tuned for the forest-black canvas (D1
// §4 surface/status ramps); status *surfaces* become low-alpha tints, *strong*
// text/icons lighten for legibility. Revisit in R2's on-device visual tuning.
export const phase1CompatDark: Record<CompatToken, string> = {
  'border.divider': 'rgba(255,255,255,0.06)', //   faint hairline on dark
  'status.warningSurface': 'rgba(245,158,11,0.14)',
  'status.warningStrong': '#FBBF24', //             amber.400 — legible on dark
  'status.successSurface': 'rgba(52,208,140,0.13)',
  'status.successBorder': 'rgba(52,208,140,0.30)',
  'status.infoStrong': '#60A5FA', //                blue.400
  'status.infoSurface': 'rgba(37,99,235,0.15)',
  'accent.meterWarn': '#FBBF24',
};
