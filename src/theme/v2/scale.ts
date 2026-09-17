/**
 * v2 dimensional tokens — space, radius, type, icons, controls, motion.
 *
 * SOURCE: `GreenBidz Mobile.dc.html` turns 6a–6f / 7a–7e, measured.
 * Scheme-independent: none of this forks between light and dark. Only colour
 * does. See `palette.ts`.
 *
 * ── The two RN traps this file exists to close ───────────────────────────
 *
 * 1. `letterSpacing` in React Native is in POINTS. The canvas specifies it in
 *    `em` (.16em is the signature tracked eyebrow, 37 uses). Passing 0.16 to
 *    RN gives a sixth of a point — invisible. Every value here is already
 *    resolved to points against its own font size.
 *
 * 2. `lineHeight` in React Native is in POINTS, not a multiplier. The canvas
 *    specifies ratios (1.15, 1.5…). Passing 1.5 collapses the line to 1.5pt.
 *    Every value here is already multiplied out and rounded.
 *
 * Both are silent failures — they compile, they render, they just look wrong.
 * So type is exported as finished `TextStyle` objects, never as loose numbers.
 */
import { Dimensions, Platform, type TextStyle } from 'react-native';

// ── Reference frame ────────────────────────────────────────────────────────
/**
 * The canvas is drawn at `.ph{width:390px;height:844px}` — iPhone 14/13/12
 * logical points. Every measurement below is a point value at this width.
 */
export const REFERENCE_WIDTH = 390;
export const REFERENCE_HEIGHT = 844;

// ── Spacing ────────────────────────────────────────────────────────────────
/**
 * Collapsed from 19 distinct gap/padding values in the canvas.
 * Snapped: 3→4, 7→6, 9→10, 11→12, 13→12, 15→16, 20→18, 28→26.
 */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  '4xl': 18,
  '5xl': 22,
  '6xl': 26,
  '7xl': 30,
  '8xl': 34,
} as const;
export type SpaceToken = keyof typeof space;

/**
 * The screen gutter. 24pt, used 71 times — by far the most common horizontal
 * padding in the canvas, and the left edge every screen aligns to.
 * Deliberately NOT in the `space` scale: it is a layout constant, not a step.
 */
export const GUTTER = 24;

/**
 * Inner padding of a filled card or tinted row (18pt, 26 uses) — the second
 * horizontal rhythm in the design, one step in from the gutter.
 */
export const CARD_PAD = 18;

// ── Radius ─────────────────────────────────────────────────────────────────
/** Collapsed from 10 values. Snapped: 18→16, 20→22, 24→26. */
export const radius = {
  xs: 8,
  sm: 14,
  md: 16,
  lg: 22,
  xl: 26,
  pill: 999,
} as const;
export type RadiusToken = keyof typeof radius;

/**
 * The header sheet's bottom corners: `border-radius:0 0 34px 34px`, on 11 of
 * 11 screens. This is the single most recognisable shape in the design — the
 * green wash that curves away from the status bar. It is not a radius step;
 * it is the shape of the app.
 */
export const HEADER_SHEET_RADIUS = 34;

// ── Type ───────────────────────────────────────────────────────────────────
/**
 * Poppins at three weights — 400 / 500 / 600. That is genuinely all the canvas
 * uses across 238 styled text nodes. Nothing here is bold (700) or light.
 *
 * Must be loaded in `app/_layout.tsx`. An unloaded face does not throw; it
 * silently falls back to the system font. That has already shipped once in
 * this app — `Inter_500Medium` was referenced in tailwind.config.js and never
 * loaded, so every `font-medium` label rendered as system font.
 */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
} as const;

/** Collapsed from 19 distinct text sizes. Half-pixels rounded — 13.5→13, 14.5→14, 15.5→15, 12.5→12, 11.5→11, 9.5→10. */
const size = {
  display: 27,
  h1: 22,
  h2: 20,
  h3: 17,
  lg: 15,
  base: 14,
  sm: 13,
  xs: 12,
  xxs: 11,
  micro: 10,
} as const;

/** em → points, against the size it is applied to. RN wants points. */
const track = (px: number, em: number) => Math.round(px * em * 100) / 100;
/** ratio → points. RN wants points. */
const leading = (px: number, ratio: number) => Math.round(px * ratio);

/**
 * Finished text styles. Screens use these; they never set `fontSize`,
 * `fontFamily`, `letterSpacing` or `lineHeight` directly.
 *
 * Colour is deliberately absent — it comes from the palette at the call site,
 * because it forks by scheme and these do not.
 */
export const type = {
  /** 27/600/-.02em — "What are you selling today?". One per screen, at most. */
  display: {
    fontFamily: fonts.semibold,
    fontSize: size.display,
    letterSpacing: track(size.display, -0.02),
    lineHeight: leading(size.display, 1.15),
  },
  /** 22/600/-.01em — screen title where there is no display line. */
  h1: {
    fontFamily: fonts.semibold,
    fontSize: size.h1,
    letterSpacing: track(size.h1, -0.01),
    lineHeight: leading(size.h1, 1.2),
  },
  /** 20/600/-.01em — a price, a total, a step heading. */
  h2: {
    fontFamily: fonts.semibold,
    fontSize: size.h2,
    letterSpacing: track(size.h2, -0.01),
    lineHeight: leading(size.h2, 1.25),
  },
  /** 17/600/-.01em — card heading, banner headline. */
  h3: {
    fontFamily: fonts.semibold,
    fontSize: size.h3,
    letterSpacing: track(size.h3, -0.01),
    lineHeight: leading(size.h3, 1.3),
  },
  /** 15/500 — primary button label, prominent value. */
  action: {
    fontFamily: fonts.medium,
    fontSize: size.lg,
    lineHeight: leading(size.lg, 1.4),
  },
  /** 15/400 — long-form paragraph. */
  lead: {
    fontFamily: fonts.regular,
    fontSize: size.lg,
    lineHeight: leading(size.lg, 1.5),
  },
  /** 14/500 — the list-row title. The most-used title style in the app. */
  rowTitle: {
    fontFamily: fonts.medium,
    fontSize: size.base,
    lineHeight: leading(size.base, 1.35),
  },
  /** 14/400 — row title where the row is not the subject. */
  row: {
    fontFamily: fonts.regular,
    fontSize: size.base,
    lineHeight: leading(size.base, 1.4),
  },
  /** 13/400 — body copy. "Point the camera at the nameplate…". */
  body: {
    fontFamily: fonts.regular,
    fontSize: size.sm,
    lineHeight: leading(size.sm, 1.5),
  },
  /** 13/500 — body copy carrying emphasis, active tab label. */
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: size.sm,
    lineHeight: leading(size.sm, 1.5),
  },
  /** 13/600 — tab label, selected segment. */
  bodySemi: {
    fontFamily: fonts.semibold,
    fontSize: size.sm,
    lineHeight: leading(size.sm, 1.45),
  },
  /** 12/400 — secondary line under a row title, metadata. */
  caption: {
    fontFamily: fonts.regular,
    fontSize: size.xs,
    lineHeight: leading(size.xs, 1.45),
  },
  /** 12/500 — inline link ("See all 7"), chip label. */
  captionMedium: {
    fontFamily: fonts.medium,
    fontSize: size.xs,
    lineHeight: leading(size.xs, 1.45),
  },
  /** 11/500 — dense metadata, tab-bar label. */
  small: {
    fontFamily: fonts.medium,
    fontSize: size.xxs,
    lineHeight: leading(size.xxs, 1.4),
  },
  /**
   * 10/600/.16em uppercase — the tracked eyebrow. DRAFTS · FOR SELLERS.
   * 37 uses; the most distinctive type treatment in the design and the thing
   * that makes a section read as a section without drawing a box round it.
   * `textTransform` is baked in: the canvas always uppercases these.
   */
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: size.micro,
    letterSpacing: track(size.micro, 0.16),
    lineHeight: leading(size.micro, 1.4),
    textTransform: 'uppercase',
  },
  /**
   * 12/600/.16em uppercase — the wordmark and top-level tracked labels.
   * A step up from `eyebrow`; 6 uses in the canvas. Distinct role, not a
   * rounding of `eyebrow`, which is why both exist.
   */
  label: {
    fontFamily: fonts.semibold,
    fontSize: size.xs,
    letterSpacing: track(size.xs, 0.16),
    lineHeight: leading(size.xs, 1.4),
    textTransform: 'uppercase',
  },
  /** 10/600/.06em — a tighter tracked label, used inside dense chips. */
  micro: {
    fontFamily: fonts.semibold,
    fontSize: size.micro,
    letterSpacing: track(size.micro, 0.06),
    lineHeight: leading(size.micro, 1.4),
  },
} as const satisfies Record<string, TextStyle>;
export type TypeToken = keyof typeof type;

// ── Icons ──────────────────────────────────────────────────────────────────
/** Collapsed from 13 canvas icon sizes. Snapped: 10→12, 15/17→16, 19→18, 21→20, 23→22. */
export const icon = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 22,
  hero: 30,
} as const;
export type IconToken = keyof typeof icon;

// ── Control heights ────────────────────────────────────────────────────────
/** Measured from the canvas. Fixed points — these are touch targets, so they must not scale. */
export const control = {
  /** 26 — micro chip / status pill. Below the 44pt touch minimum: decorative only, never tappable. */
  chipSm: 26,
  /** 34 — chip, inline button on a banner. Pad the touch target with hitSlop. */
  chip: 34,
  /** 40 — avatar, icon button, compact field. */
  avatar: 40,
  /** 66 — the identity avatar on Account. Same measure as `row`, different meaning. */
  avatarLg: 66,
  /** 46 — list thumbnail, standard field. */
  thumb: 46,
  /** 52 — text input. */
  input: 52,
  /** 54 — the primary action. "Scan it". */
  button: 54,
  /** 66 — a full list row with title + sub. */
  row: 66,
  /** The tab bar, from the canvas `dc-import hint-size="100%,78px"`. Excludes the home indicator — add `insets.bottom`. */
  tabBar: 78,
} as const;

/** iOS HIG / Material minimum. Anything tappable smaller than this needs `hitSlop`. */
export const MIN_TOUCH = 44;

/**
 * The unread dot on the notification bell — 7pt, ringed 1.5pt in whatever
 * ground it sits on so it reads as a separate mark rather than a smudge on the
 * icon. Below any scale step, which is why it is named rather than inlined in
 * three screens.
 */
export const badgeDot = { size: 7, ring: 1.5 } as const;

/** The 3pt progress track — verification progress, extraction progress. */
export const PROGRESS_TRACK_HEIGHT = 3;

/**
 * The space between two sections of a screen.
 *
 * With no boxes to group content, this gap plus the tracked eyebrow IS the
 * grouping — it is doing the job a card border would do elsewhere, so it is a
 * named layout constant rather than a step off the space scale.
 *
 * (It happens to equal `HEADER_SHEET_RADIUS`. Coincidence, not a relationship —
 * do not use one for the other.)
 */
export const SECTION_GAP = 34;

/**
 * The 3pt optical nudge between a row's title and its sub-line. Off the space
 * scale on purpose: it is kerning between two lines of type, not layout.
 */
export const ROW_SUBLINE_GAP = 3;

/** The hairline. `StyleSheet.hairlineWidth` is ~0.33–0.5pt and reads as a smudge at this contrast; the canvas draws 1pt. */
export const HAIRLINE_WIDTH = 1;

// ── Motion ─────────────────────────────────────────────────────────────────
/**
 * The design is quiet — "space instead of boxes". Motion follows: it answers
 * what a person did, and it is otherwise absent. No ambient drift, no
 * fade-and-slide-up on every section, no hover-equivalent on every card.
 *
 * There is exactly ONE orchestrated moment in the whole app: screen 7a,
 * "Analyzing", where the person is waiting and the motion is the content.
 *
 * Every consumer must respect `useReducedMotion()` — see `motion.ts`.
 */
export const duration = {
  /** Press feedback. Fast enough to feel like the surface, not an animation. */
  press: 120,
  /** Press release — slightly slower than the press so it settles rather than snaps. */
  release: 180,
  /** Default transition: expand, reveal, tab change. */
  base: 220,
  /** Sheet, modal, screen-level change. */
  slow: 320,
  /**
   * One cycle of an ambient loop — a pulse, a shimmer.
   *
   * An order of magnitude slower than a transition, because a loop is a
   * background texture rather than a response. Anything from the steps above
   * strobes when repeated. Only for motion gated on `useMotionEnabled()`.
   */
  ambient: 1800,
  /** A faster loop — a shimmer sweeping a placeholder row. */
  ambientFast: 900,
} as const;

/**
 * Easing as cubic-bezier control points, for `Easing.bezier(...)`.
 * Kept as tuples rather than `Easing` objects so this file stays free of
 * Reanimated imports and can be read by the adherence test.
 */
export const easing = {
  /** Decelerate — things entering or settling. Fast out of the gate, long tail. */
  standard: [0.2, 0, 0, 1] as const,
  /** Accelerate — things leaving. */
  exit: [0.3, 0, 1, 1] as const,
  /** Symmetric — things moving between two on-screen states. */
  inOut: [0.4, 0, 0.2, 1] as const,
};

/**
 * Spring physics for anything a finger throws.
 *
 * ⚠️ A pager MUST settle with a spring seeded from the release velocity, not
 * with `withTiming`. A fixed duration discards how fast the finger was moving,
 * so a hard flick and a slow drag take exactly as long to land — which reads
 * as mechanical no matter what easing curve is used. This was the actual
 * reason the first Home pager did not feel smooth.
 *
 * `overshootClamping` because a pager must not travel past its last pane and
 * reveal the ground behind it; the bounce that makes a spring pleasant
 * elsewhere is a rendering bug here.
 */
export const spring = {
  page: {
    damping: 20,
    stiffness: 180,
    mass: 0.5,
    overshootClamping: true,
  },
} as const;

/** Press feedback. Scale is subtle by design: the surfaces here are flat and large. */
export const press = {
  scale: 0.97,
  opacity: 0.9,
} as const;

// ── Responsive ─────────────────────────────────────────────────────────────
/**
 * Type and spacing DO NOT scale with screen width.
 *
 * A 13pt line is 13pt on a 320pt iPhone SE and on a 430pt Pro Max — that is
 * correct. Scaling type by device width makes small phones illegible and large
 * phones cartoonish, and it fights the OS accessibility text setting, which is
 * the control that should be moving type size. Touch targets must not scale
 * for the same reason.
 *
 * Only *pictorial* dimensions scale: hero banners, photo tiles, illustration
 * blocks — things drawn at a proportion of the 390pt frame that would look
 * wrong held at a fixed size. `scaleW` is clamped hard so the 320pt floor and
 * tablet ceiling stay sane.
 */
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function scaleW(referencePx: number): number {
  const { width } = Dimensions.get('window');
  const ratio = clamp(width / REFERENCE_WIDTH, 0.9, 1.15);
  return Math.round(referencePx * ratio);
}

/**
 * Line-length ceiling. Beyond a tablet width the 24pt gutter would let body
 * copy run past a comfortable measure, so content centres instead of stretching.
 */
export const MAX_CONTENT_WIDTH = 560;

/** Elevation. The canvas uses exactly one shadow: `0 10px 30px rgba(0,0,0,.13)` on the phone frame itself. */
export const shadow = {
  /**
   * Lifted surface — bottom sheet, sticky footer over scrolling content.
   * Android reads `elevation`; iOS reads the shadow* keys. Both are set.
   */
  raised: Platform.select({
    ios: {
      shadowColor: '#061C14',
      shadowOpacity: 0.13,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 5 },
    },
    default: { elevation: 6 },
  }),
} as const;
