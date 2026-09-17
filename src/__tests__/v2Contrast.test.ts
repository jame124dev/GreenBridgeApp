/**
 * v2 palette contrast audit.
 *
 * The dark palette is DERIVED — the canvas is light-only — so it has no
 * designer to have checked it. This test is that check, and it runs on both
 * schemes so a later palette edit cannot quietly break one of them.
 *
 * Thresholds (WCAG 2.1):
 *   • 4.5:1 — normal body text (1.4.3 AA)
 *   • 3.0:1 — large text ≥18.66pt/600, and UI component boundaries (1.4.11)
 *   • disabled text is exempt (1.4.3), so `inkDisabled` is not asserted
 *
 * KNOWN_FAILURES grandfathers values that are wrong in Tehreem's drawn design.
 * They are listed, not silently tolerated, and anything NEW fails the suite.
 */
// Imported from `palette` directly, NOT from the `@/theme/v2` barrel: the
// barrel re-exports `motion.ts`, which pulls in Reanimated and needs a native
// runtime. A palette audit should not require one.
import { darkPalette, lightPalette, type PaletteRoles } from '@/theme/v2/palette';
import { ramp, shift } from '@/theme/v2/material';

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** sRGB hex → CIE L*a*b*, D65. */
function toLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Perceptual colour difference (CIE76).
 *
 * Used instead of WCAG contrast wherever the question is "can you see the
 * edge between these two areas" rather than "can you read text on this". A
 * luminance ratio cannot answer the first: a pale green panel on white is
 * 1.1:1 and perfectly visible.
 */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.round(Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100) / 100;
}

/**
 * Grandfathered. Each entry is a decision, not an oversight.
 *
 * `light inkSubtle on base` — 2.94:1. The canvas value #8B9A92, used **60**
 * times in v2 source (28 as `color="inkSubtle"` on Text, 15 as `c.inkSubtle` on
 * icons/borders). Below AA AND below AA-large, on all three grounds — 2.94 on
 * base, 2.77 on surface, 2.67 on wash — so no text size rescues it.
 *
 * ⚠️ CORRECTED 2026-09-15. This docblock used to say "used 68 times" and that
 * "#68766E would clear AA (4.77:1)". Both were wrong. The count is 60, and
 * #68766E clears AA only against `base`: on `surface` it is 4.49 and on `wash`
 * 4.33. The 4.77 figure was one ground generalised to three.
 *
 * The value that actually clears 4.5:1 everywhere is **#65736B** (base 4.98,
 * surface 4.69, wash 4.52) — same hue and saturation as the canvas colour,
 * solved against the worst ground. Changing it still alters the drawn design,
 * so it remains Tehreem's call. Tracked in Docs/V2_CHECKLIST.md.
 */
const KNOWN_FAILURES = new Map<string, number>([
  // key → the ratio measured today. A palette edit may improve these; it may
  // not make them worse.
  ['light inkSubtle on base', 2.94],
  ['light inkSubtle on surface', 2.77],
  ['light inkSubtle on wash', 2.67],
]);

type Ground = Extract<keyof PaletteRoles, 'base' | 'surface' | 'wash'>;
const GROUNDS: Ground[] = ['base', 'surface', 'wash'];

/** Text roles that must clear 4.5:1 on every ground they can appear on. */
const BODY_TEXT: (keyof PaletteRoles)[] = ['ink', 'inkMuted', 'inkSubtle'];

describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s palette contrast', (scheme, p) => {
  describe.each(GROUNDS)('on %s', (ground) => {
    it.each(BODY_TEXT)('%s clears 4.5:1 for body text', (role) => {
      const key = `${scheme} ${role} on ${ground}`;
      const ratio = contrast(p[role] as string, p[ground] as string);
      const baseline = KNOWN_FAILURES.get(key);
      if (baseline !== undefined) {
        // Documented exception. Assert it has not got WORSE than measured.
        expect(ratio).toBeGreaterThanOrEqual(baseline);
        return;
      }
      expect({ key, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('accent clears 3:1 against every ground it is drawn on (WCAG 1.4.11, UI components)', () => {
    for (const ground of GROUNDS) {
      expect({
        ground,
        ratio: contrast(p.accent, p[ground] as string),
      }).toMatchObject({ ratio: expect.any(Number) });
      expect(contrast(p.accent, p[ground] as string)).toBeGreaterThanOrEqual(3);
    }
  });

  it('onAccent text clears 4.5:1 on the accent fill', () => {
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('accentInk — the link/text form of the accent — clears 4.5:1 on every ground', () => {
    for (const ground of GROUNDS) {
      expect(contrast(p.accentInk, p[ground] as string)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('danger clears 3:1 on base', () => {
    expect(contrast(p.danger, p.base)).toBeGreaterThanOrEqual(3);
  });

  /**
   * The secondary button.
   *
   * `PrimaryAction` has two non-filled forms and they are not equivalent:
   *
   *   `tinted`  fills with `accentWash`  — a GROUND change
   *   `quiet`   outlines with `hairlineStrong` — a 1pt LINE
   *
   * The outline measures 1.27:1 on `base` in light and 1.89:1 in dark, well
   * under the 3:1 WCAG 1.4.11 asks of a control's visible boundary, so the
   * pill shape is not actually perceivable and the control reads as a green
   * label with padding. The tint carries because a ground change is not a
   * luminance ratio problem — it is a ΔE one.
   *
   * The last assertion looks backwards on purpose. If a palette change ever
   * makes the outline legible, this fails, and whoever changed it should then
   * delete the warning in `PrimaryAction` rather than leave it lying.
   */
  it('a tinted control reads as a control; an outlined one does not', () => {
    expect(deltaE(p.accentWash, p.surface)).toBeGreaterThanOrEqual(4);
    expect(deltaE(p.accentWash, p.base)).toBeGreaterThanOrEqual(4);
    expect(contrast(p.accentInk, p.accentWash)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.hairlineStrong, p.base)).toBeLessThan(3);
  });

  /**
   * Grounds must be perceptibly distinct from the page.
   *
   * This design separates content with washes and hairlines instead of boxes,
   * so "where does one ground end and the next begin" is its whole structural
   * language — and nothing else in this file was asking that. Every other test
   * here asks only "can you read text on this ground".
   *
   * ⚠️ MEASURED WITH ΔE, NOT WCAG CONTRAST, and the difference matters.
   * WCAG contrast is a luminance ratio and is blind to hue. The light wash
   * `#EDF6F1` on white scores 1.1:1 — which would look like a failure — yet it
   * reads clearly on a device, because it differs from white in green, not in
   * brightness. ΔE (CIE76) sees that: 5.65.
   *
   * The floor is 2.0, around the just-noticeable difference for two large flat
   * areas. It is a floor, not a proof: it would not have caught the dark
   * header being *subtle*, only its being absent. On-device review in both
   * schemes is still the real check.
   */
  it('grounds are perceptibly distinct from the page', () => {
    const pairs: [keyof PaletteRoles, keyof PaletteRoles][] = [
      ['wash', 'base'],
      ['surface', 'base'],
      ['fill', 'base'],
    ];
    for (const [a, b] of pairs) {
      const d = deltaE(p[a] as string, p[b] as string);
      expect({ pair: `${scheme} ${a} vs ${b}`, deltaE: d }).toMatchObject({
        deltaE: expect.any(Number),
      });
      expect(d).toBeGreaterThanOrEqual(2);
    }
  });

  it('the hairline is a visible step but never reads as a border', () => {
    // t6 leans on the hairline for all structure. Too low and it vanishes on
    // some rows and not others; too high and it becomes the boxes the design
    // deliberately removed.
    const step = contrast(p.hairline, p.base);
    expect(step).toBeGreaterThan(1.02);
    expect(step).toBeLessThan(2);
  });
});

/**
 * Flatten a translucent overlay onto an opaque backdrop.
 *
 * Needed because a modal backdrop is not a colour you can look up — what the
 * eye sees is the composite, and that is what has to be measured.
 */
function over(overlay: string, backdrop: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(overlay);
  if (!m) throw new Error(`not an rgba() colour: ${overlay}`);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const fg = [Number(m[1]), Number(m[2]), Number(m[3])];
  const bg = [1, 3, 5].map((i) => parseInt(backdrop.slice(i, i + 2), 16));
  const mix = fg.map((f, i) => Math.round(a * f + (1 - a) * bg[i]));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

describe('the modal backdrop', () => {
  /**
   * The sign-in sheet has to read as being IN FRONT of the screen it covers.
   *
   * Asserted for LIGHT only, and that is not laziness — the two schemes
   * separate a sheet by opposite means. In light the page is bright, so the
   * backdrop's job is to darken it until the near-white sheet stands off it.
   * In dark the page is already darker than the sheet, so separation comes
   * from `surface` being LIGHTER (covered by the ground-separation test) plus
   * the sheet's top hairline; a backdrop there is close to a no-op, and
   * demanding 3:1 would force a blackout that no dark app does.
   *
   * 3:1 is the WCAG 1.4.11 figure for a UI surface boundary. The old value —
   * `scrim`, the banner-photo gradient at 0.34 — measured 2.04:1 and was
   * visibly wrong on a device before it was ever measured here.
   */
  it('a light sheet stands off the page it covers', () => {
    const p = lightPalette;
    expect(contrast(p.surface, over(p.backdrop, p.base))).toBeGreaterThanOrEqual(3);
  });

  it('suppresses an accent pill on the page behind so it cannot pass for a live button', () => {
    for (const p of [lightPalette, darkPalette]) {
      expect(deltaE(over(p.backdrop, p.accent), p.accent)).toBeGreaterThanOrEqual(10);
    }
  });
});

/**
 * Material ramps.
 *
 * Every other test in this file compares a text role against a FLAT ground.
 * A gradient has no single ground — it has two ends, and the label sits across
 * both. So the ends are what has to be measured, and this is the test that
 * would have caught the first attempt: a symmetric ±7% ramp put white on the
 * accent pill at 3.61:1, in the exact place the word "Scan it" sits.
 *
 * The rule under test: the ramp travels AWAY from its ink, and the token is one
 * END of it. Consequence — a material surface can never be worse than the flat
 * one it replaced, which is the only reason depth is allowed in here at all.
 */
describe.each([
  ['light', lightPalette],
  ['dark', darkPalette],
] as const)('%s material ramps', (_scheme, p) => {
  const CASES: { name: string; role: keyof PaletteRoles; ink: keyof PaletteRoles }[] = [
    { name: 'the green pill', role: 'accent', ink: 'onAccent' },
    { name: 'the tinted pill', role: 'accentWash', ink: 'accentInk' },
    { name: 'the promo card', role: 'scrimFallback', ink: 'onScrim' },
    // `surface` + `ink` is the case that broke the first API: the ink is dark
    // in light mode and near-white in dark, so the direction cannot be fixed.
    { name: 'a card', role: 'surface', ink: 'ink' },
  ];

  it.each(CASES)('$name keeps its label above 4.5:1 at BOTH ends', ({ role, ink }) => {
    const [top, bottom] = ramp(p[role] as string, p[ink] as string);
    expect(contrast(p[ink] as string, top)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p[ink] as string, bottom)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CASES)('$name never drops below its own flat value', ({ role, ink }) => {
    const flat = contrast(p[ink] as string, p[role] as string);
    for (const end of ramp(p[role] as string, p[ink] as string)) {
      // A hair of tolerance for the 8-bit rounding in the HSL round trip.
      expect(contrast(p[ink] as string, end)).toBeGreaterThanOrEqual(flat - 0.02);
    }
  });

  it('a SYMMETRIC ramp would fail — this is why the rule exists', () => {
    // Not a hypothetical: this was the first implementation.
    const lightEndOfPill = shift(p.accent, 0.07);
    expect(contrast(p.onAccent, lightEndOfPill)).toBeLessThan(4.5);
  });
});

