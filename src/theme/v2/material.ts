/**
 * v2 material — depth derived from the palette, never invented.
 *
 * The design is flat by default and stays that way for GROUNDS. This module
 * exists for the things a finger touches: the green pill, the accent tile, the
 * chips, the cards. Nothing here introduces a colour; every value is computed
 * from a role already in `palette.ts`.
 *
 * ── THE RAMP RULE ──
 *
 * A gradient here always moves AWAY from the ink sitting on it, and the token
 * colour is one END of the ramp, never the middle:
 *
 *   dark ink  →  lighten upward, finish AT the token   (`#EDF6F1` → …)
 *   light ink →  start AT the token, darken downward   (… → `#2E7D5B`)
 *
 * Both still read as lit from above. The point is that no pixel of a material
 * surface can be worse for contrast than the flat surface it replaces.
 *
 * ⚠️ THIS IS NOT A STYLE PREFERENCE — a symmetric ramp measurably fails WCAG.
 * Centring the token and going ±7% was tried first and measured:
 *
 *   white `onAccent` on the pill's light end   3.61:1   (flat: 5.00:1)
 *   `inkMuted` on the light wash's dark end    4.48:1   (flat: 5.13:1)
 *
 * Both under the 4.5:1 floor, in the exact place the label sits. Guarded by
 * `v2Contrast.test.ts` — it checks ramp ENDS, not just flat pairs.
 *
 * ── WHAT MUST STAY FLAT ──
 *
 * Page grounds, the header sheet, and anything that scrolls or swipes. Depth
 * on a moving surface is not free: rasterising Home's two panes to try to make
 * the swipe cheaper took device jank from 4.70% to 9.63%, because a texture
 * whose contents change is re-uploaded every frame. See `home/PaneShell.tsx`.
 */
import { Platform } from 'react-native';

import type { PaletteRoles, SchemeName } from './palette';

/** How far a ramp travels, in HSL lightness. One step, both directions. */
const TRAVEL = 0.09;

/**
 * How much brighter the top edge is than the surface under it. Weaker in dark
 * — a bright line on a dark ground reads as a seam rather than as light.
 *
 * ⚠️ THIS IS A GRADIENT STOP, NOT AN OVERLAY VIEW. It used to be a 1pt
 * absolutely-positioned strip with a `borderTopRadius`, and that cannot work:
 * a 1pt-tall box has no room to render a 999pt curve, so on a PILL it drew a
 * straight line clean across the widest part of the shape and escaped the
 * rounded top. It only looked right while a parent `overflow: 'hidden'`
 * happened to clip it — which stopped the moment the kit moved to RNGH's
 * Pressable. Seen on Account's "Sign in" in dark.
 *
 * As a stop it follows the shape exactly, needs no clipping, and costs one
 * fewer view per control.
 */
const LIT = { light: 0.1, dark: 0.045 } as const;

function toHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [hue, s, l];
}

function toHex(hue: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + hue * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** The same colour, lighter (+) or darker (−) by `d` in HSL lightness. */
export function shift(hex: string, d: number): string {
  const [h, s, l] = toHsl(hex);
  return toHex(h, s, Math.max(0, Math.min(1, l + d)));
}

/** Relative luminance, for deciding which way a ramp must travel. */
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The two ends of a raised surface's gradient, top first.
 *
 * ⚠️ TAKES THE INK, NOT A FLAG. The direction is COMPUTED — the ramp moves
 * away from whatever text sits on it.
 *
 * An earlier version asked the caller for a `lightInk` boolean and it was a
 * design error, caught by `v2Contrast.test.ts` before any screen used it: the
 * answer is not a property of the role, it FLIPS WITH THE SCHEME. A card is
 * `surface` with dark `ink` in light mode and near-white `ink` in dark. A flag
 * set from the light scheme silently ran the gradient toward the label in
 * dark, taking a card from 14.29:1 to 9.80:1. Nobody would have noticed until
 * the palette moved and it crossed 4.5.
 */
export function ramp(colour: string, ink: string): readonly [string, string] {
  // Ink lighter than the surface → darken downward. Otherwise lighten upward.
  // Either way the token colour stays as one END of the ramp.
  return lum(ink) > lum(colour)
    ? [colour, shift(colour, -TRAVEL)]
    : [shift(colour, TRAVEL), colour];
}

/**
 * The ramp with its lit top edge folded in: three stops, the first a hair
 * brighter than the second and reached in the first 5% of the height.
 *
 * `locations` matters — without them the highlight would bleed a tenth of the
 * way down the control and read as a gradient rather than as an edge.
 */
export function litRamp(
  colour: string,
  ink: string,
  scheme: SchemeName,
): { colours: readonly [string, string, string]; locations: readonly [number, number, number] } {
  const [top, bottom] = ramp(colour, ink);
  return {
    colours: [shift(top, LIT[scheme]), top, bottom],
    locations: [0, 0.05, 1],
  };
}

/**
 * Elevation. Two steps and no more — a control that lifts, and a card that
 * lifts a little less.
 *
 * `shadow.raised` in `scale.ts` is the SHEET shadow and is deliberately
 * heavier; these are for objects sitting on a page.
 */
export const lift = {
  control: Platform.select({
    ios: { shadowColor: '#061C14', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
    default: { elevation: 3 },
  }),
  card: Platform.select({
    ios: { shadowColor: '#061C14', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    default: { elevation: 2 },
  }),
} as const;

/** Everything a `Surface` needs for one role, in one call. */
export function material(
  colours: PaletteRoles,
  scheme: SchemeName,
  role: keyof PaletteRoles,
  /** The text role that sits on this surface. Decides the ramp direction. */
  ink: keyof PaletteRoles,
) {
  return litRamp(colours[role] as string, colours[ink] as string, scheme);
}
