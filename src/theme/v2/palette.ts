/**
 * v2 colour palette — light and dark.
 *
 * SOURCE: `GreenBidz Mobile.dc.html`, turns 6a–6f and 7a–7e (Claude Design
 * project f76817b9-ab75-46b3-b411-13ffa61839bd, "Greenbidz mobile app
 * redesign", owner Tehreem).
 *
 * The canvas holds 29 distinct hex literals across those 11 screens and no
 * CSS variables — there is no upstream token file. These are those literals
 * NORMALISED into roles: near-identical values are collapsed onto one token,
 * and every token records how many canvas uses it absorbs so a reviewer can
 * check the collapse was fair.
 *
 * ⚠️ DARK IS DERIVED, NOT DRAWN. The canvas is light-only — no
 * `prefers-color-scheme`, no dark variant of any screen. Every dark value
 * below is sourced from greens Tehreem already used elsewhere on the canvas
 * (the t4 banded chrome and the t7 header wash) rather than invented or
 * computed by inversion. It needs a design review before it ships. See
 * docs/V2_UI_SKILLS.md § "Dark mode".
 *
 * Nothing outside this file may name a colour. Screens read roles through
 * `useV2Theme()`; `src/__tests__/v2Adherence.test.ts` enforces it.
 */

/** Semantic roles. Both schemes must implement every key. */
export type PaletteRoles = {
  /** Page ground. */
  base: string;
  /** Raised panel / list ground sitting on `base`. */
  surface: string;
  /** Neutral filled block — photo placeholder, thumb, empty tile. */
  fill: string;
  /** Stronger neutral fill — pressed states, dividers with weight. */
  fillStrong: string;
  /** The green wash. Header sheet, tinted rows, assistant strip. */
  wash: string;
  /** Deeper green tint — selected chips, progress track fill. */
  accentWash: string;
  /** The one action colour. Primary button, active tab, links. */
  accent: string;
  /** Text/icon on `accent`. */
  onAccent: string;
  /** Accent as text on a light ground — needs more depth than `accent`. */
  accentInk: string;
  /** Primary text. */
  ink: string;
  /** Secondary text — supporting lines, descriptions. */
  inkMuted: string;
  /** Tertiary text — metadata, timestamps, inactive tabs. */
  inkSubtle: string;
  /** Placeholder and disabled text, empty-state glyphs. */
  inkDisabled: string;
  /** The hairline. t6's structural device: rules instead of boxed cards. */
  hairline: string;
  /** Hairline with weight — section breaks that must read as a break. */
  hairlineStrong: string;
  /** Destructive. The only warm colour in the entire design. */
  danger: string;
  /**
   * Scrims over photography (banner captions) — a FOUR-stop ramp, not two.
   *
   * The canvas draws the banner as
   * `linear-gradient(180deg, rgba(6,28,20,.18) 0%, .34 40%, .62 70%, .82 100%)`
   * (`docs/v2-design/screens/6a.html`). `scrim` and `scrimStrong` were already
   * the 40% and 100% stops exactly; `scrimSoft` and `scrimMid` are the two that
   * were missing, so the implementation ran lighter than the drawing through
   * the whole caption band. Added 2026-09-17 when the banner photograph
   * finally landed and the captions were measured on it.
   */
  scrimSoft: string;
  scrim: string;
  scrimMid: string;
  scrimStrong: string;
  /**
   * The deepest stop, for the banner's SECOND scrim.
   *
   * ⚠️ The canvas banner stacks TWO gradients, which is easy to miss and was:
   * a full-bleed one over the photo, and then the caption block carries its own
   * `rgba(6,28,20,0) 0% · .80 26% · .92 100%`. Implementing only the first
   * leaves the caption sitting on roughly half the intended darkness.
   */
  scrimDeep: string;
  /**
   * Text and controls that sit ON photography.
   *
   * ⚠️ THESE DO NOT FLIP BY SCHEME, and that is the point. A photograph is
   * the same photograph in dark mode; the scrim over it is the same scrim.
   * Flipping the caption to dark ink in dark mode would put near-black text
   * on a near-black scrim over an arbitrary image. So both palettes define
   * these identically, and a screen reads them like any other role instead of
   * hardcoding white.
   */
  onScrim: string;
  /** The pale-green eyebrow over photography — the canvas's #B9E4CE. */
  onScrimTint: string;
  /** The light pill CTA that sits on a banner: ground and its ink. */
  scrimPill: string;
  onScrimPill: string;
  /**
   * Stand-in ground when a banner has no photograph. Also does not flip.
   *
   * ⚠️ It has to clear BOTH page grounds, because it does not flip: white in
   * light and `#08150F` in dark. `#10221B` — the obvious choice, and what this
   * was — clears white by ΔE 89 and the dark page by only **7.1**, and with the
   * caption gradient on top the bottom half went DARKER than the page, so on a
   * phone in dark the banner had no bottom edge at all and read as loose text
   * with a floating white pill. `#1A3A2B` clears the dark page by ΔE 19.6 and
   * still carries white at 12.5:1.
   *
   * Seen on glass first; the ΔE≥2 ground test passed throughout, because it
   * compares tokens and the failure was in the composite.
   */
  scrimFallback: string;
  /**
   * Behind a live camera preview. Pure black, and it does NOT flip: a
   * viewfinder is a hole in the app, not a surface of it — the preview fills
   * it, and whatever shows around the edges while the camera warms up should
   * be the absence of a screen rather than a pale rectangle in light mode.
   */
  viewfinder: string;
  /**
   * The ground behind a MODAL — the sign-in sheet.
   *
   * ⚠️ NOT `scrim`. That one is the gradient over a banner PHOTOGRAPH — 0.34
   * light / 0.42 dark, right over an image and too weak over a whole screen.
   * As a composite the light sheet cleared only **2.04:1** against its own
   * backdrop; at 0.55 it clears 3.76:1, and an accent pill on the page behind
   * moves ΔE 23 away from a live one.
   *
   * Those are TOKEN figures. Android's `Modal` adds a dialog dim of its own on
   * top, so measured off a real screenshot the same change read 5.56:1 → 8.17:1
   * — already past 3:1 before the fix. iOS has no such dim, so the token
   * figure is what would actually have shipped there. Both were worth fixing;
   * only one of them was visible on the phone in front of me.
   *
   * Does not flip: a backdrop darkens whatever is under it. In dark it is
   * close to a no-op, which is correct — there the sheet separates by being
   * LIGHTER than the page, plus its top hairline.
   *
   * The canvas has no modal, so this role is derived, not transcribed.
   */
  backdrop: string;
};

/** Shared by both schemes — see `onScrim` and `backdrop` above for why. */
const overPhotography = {
  onScrim: '#FFFFFF',
  onScrimTint: '#B9E4CE',
  scrimPill: 'rgba(255,255,255,0.94)',
  onScrimPill: '#10221B',
  scrimFallback: '#1A3A2B',
  backdrop: 'rgba(6,28,20,0.55)',
  viewfinder: '#000000',
} as const;

/**
 * LIGHT — transcribed from the canvas.
 *
 * Collapse log (canvas value → token, with canvas use count):
 *   #FFFFFF/#FFF 21             → base
 *   #F5F9F7 20, #F2F5F3 7,
 *     #F7F8F6 (frame) 1         → surface
 *   #EDF1EE 23                  → fill
 *   #DCE7E1 10                  → fillStrong
 *   #EDF6F1 24, #F3FAF6 4       → wash
 *   #DFF0E7 16                  → accentWash
 *   #2E7D5B 39bg + 12fg         → accent
 *   #22624A 20                  → accentInk
 *   #10221B 102                 → ink
 *   #5A6B62 59, #5E6B64         → inkMuted
 *   #8B9A92 26, #9BA9A1 27,
 *     #7C8C84 9, #8FA79A 2,
 *     #A7B3AC 4                 → inkSubtle   (68 uses, 5 near-identical greys)
 *   #B4C0B9 15, #C6D0CA 14      → inkDisabled
 *   #F2F5F3 22 (as border)      → hairline
 *   #DCE7E1 4 (as border)       → hairlineStrong
 *   #A8452F 1                   → danger
 */
export const lightPalette: PaletteRoles = {
  base: '#FFFFFF',
  surface: '#F5F9F7',
  fill: '#EDF1EE',
  fillStrong: '#DCE7E1',
  wash: '#EDF6F1',
  accentWash: '#DFF0E7',
  accent: '#2E7D5B',
  onAccent: '#FFFFFF',
  accentInk: '#22624A',
  ink: '#10221B',
  inkMuted: '#5A6B62',
  /**
   * ⚠️ KNOWN CONTRAST FAILURE, KEPT DELIBERATELY.
   * 2.94:1 on `base` — below WCAG AA (4.5:1) and below AA-large (3:1). It is
   * the canvas value, used 68 times for metadata, and changing it is
   * Tehreem's call, not mine. `#68766E` would clear AA (4.77:1) with the
   * smallest visible change. Grandfathered in `v2Contrast.test.ts`; that test
   * fails on any NEW violation.
   */
  inkSubtle: '#8B9A92',
  inkDisabled: '#B4C0B9',
  hairline: '#F2F5F3',
  hairlineStrong: '#DCE7E1',
  danger: '#A8452F',
  scrimSoft: 'rgba(6,28,20,0.18)',
  scrim: 'rgba(6,28,20,0.34)',
  scrimMid: 'rgba(6,28,20,0.62)',
  // The canvas caption gradient's middle stop is .80; `scrimStrong` is .82 and
  // serves both — a 2% difference in an overlay is not a perceivable one, and a
  // near-duplicate token would be.
  scrimStrong: 'rgba(6,28,20,0.82)',
  scrimDeep: 'rgba(6,28,20,0.92)',
  ...overPhotography,
};

/**
 * DARK — derived. Not in the canvas. Review before shipping.
 *
 * Two decisions worth arguing with:
 *
 * 1. `base` is the light theme's `ink` (#10221B), and `ink` is the light
 *    theme's `wash` (#EDF6F1). The scheme turns inside out on its own two
 *    strongest colours instead of reaching for a neutral charcoal. It keeps
 *    the design in its own green world.
 *
 * 2. `accent` is UNCHANGED at #2E7D5B. It clears 4.5:1 against both grounds,
 *    so the one action colour in the app is the same colour in both schemes.
 *
 * The hairline is the hard part. In light, #F2F5F3 on #FFFFFF is a ~1.5%
 * luminance step and t6 leans on it for all structure. That step is invisible
 * on a near-black ground, so dark uses a LIGHTER-than-surface rule (#243830 on
 * #16261F) — the same device, inverted, rather than a darker line nobody sees.
 * Sourced from the canvas: #0B3527, #0E4034, #12503B, #16261F, #9BBBAC,
 * #6E9683 and #B9E4CE all appear in Tehreem's other turns.
 */
export const darkPalette: PaletteRoles = {
  /**
   * `#08150F`, darker than the light theme's ink.
   *
   * Found on device, not on paper. At `#10221B` the header wash `#0B2A1E`
   * scored 1.08:1 against it and the green sheet — the most recognisable
   * shape in the design — was simply invisible in dark; the 34pt curve was
   * the only clue it was there.
   *
   * It cannot be fixed by lightening the wash: the "Scan it" accent slab sits
   * ON the wash, and every wash light enough to read as a panel (≥1.18:1)
   * drops the accent below the 3:1 UI-component floor. So the ground moves
   * instead. At `#08150F` the wash separates at 1.21:1 and every other ratio
   * improves — ink 16.9:1, accent 3.7:1.
   */
  base: '#08150F',
  surface: '#16261F',
  fill: '#1D3129',
  fillStrong: '#243830',
  /**
   * `#0B2A1E`, not the `#12503B` the header wash uses elsewhere on the canvas.
   * The primary button is a filled `accent` slab that sits ON this wash (6a,
   * "Scan it"). Against `#12503B` the accent scores 1.88:1 and the button
   * stops reading as a shape; against `#0B2A1E` it is 3.08:1, clearing the
   * 3:1 WCAG 1.4.11 floor for a UI component. Also from Tehreem's canvas.
   *
   * Consequence worth knowing: dark's brand moment is carried by the accent,
   * `accentWash` and `accentInk` rather than by a large pale green slab.
   */
  wash: '#0B2A1E',
  accentWash: '#0E4034',
  accent: '#2E7D5B',
  onAccent: '#FFFFFF',
  accentInk: '#8CC7AA',
  ink: '#EDF6F1',
  inkMuted: '#9BBBAC',
  inkSubtle: '#6E9683',
  inkDisabled: '#4A6459',
  hairline: '#243830',
  hairlineStrong: '#31483E',
  danger: '#E08A70',
  // Same four-stop ramp as light, scaled by the same factor the existing two
  // already carry (0.34→0.42, 0.82→0.88). Derived, like the rest of dark.
  scrimSoft: 'rgba(3,14,10,0.22)',
  scrim: 'rgba(3,14,10,0.42)',
  scrimMid: 'rgba(3,14,10,0.68)',
  scrimStrong: 'rgba(3,14,10,0.88)',
  scrimDeep: 'rgba(3,14,10,0.95)',
  ...overPhotography,
};

export type SchemeName = 'light' | 'dark';

export const palettes: Record<SchemeName, PaletteRoles> = {
  light: lightPalette,
  dark: darkPalette,
};
