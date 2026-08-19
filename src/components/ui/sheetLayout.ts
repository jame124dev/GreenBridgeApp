/**
 * The bottom-sheet's geometry, as a pure function.
 *
 * Extracted from `Sheet.tsx` on 2026-08-19 because BOTH sheet bugs the device
 * pass found were arithmetic, and arithmetic is the one part of a layout a unit
 * test can actually prove:
 *
 *  - **Overflowed the TOP.** `CategoryPickerSheet` passes `maxHeight={520}` and
 *    the sheet clamped that against nothing at all. On a 375x667 dp SE-class
 *    screen, 520 + grabber + title + subtitle + search + Cancel + the bottom
 *    inset is ~738 dp against 667 dp of screen. The card is bottom-anchored, so
 *    the overflow came off the TOP: the grabber, "Select category" and the
 *    subtitle were clipped away entirely (absent from the view hierarchy) and the
 *    search field landed at y=0, under the status-bar clock.
 *  - **Hid behind the KEYBOARD.** With a narrow search ("centrif", 2 matches) the
 *    content-height card is short, and on Android the Modal is not resized for
 *    the IME, so the whole card — search field, both rows and Cancel — sat inside
 *    the bottom 876 px the IME was covering. Only the title stayed visible.
 *
 * The two pull in opposite directions ("do not grow past the top" vs "do not
 * shrink below the keyboard"), so they are solved as ONE calculation: the card is
 * clamped into the space between the top inset and the top of the keyboard, and
 * it is LIFTED by the keyboard height rather than being allowed to shrink into
 * it. Fixing either one alone re-creates the other.
 */

/**
 * Design floor for the card's bottom padding. Used as the lower bound against the
 * live safe-area inset — `Math.max`, not `+`: 28 is the design's own breathing
 * room and on a gesture-nav / iOS device the inset is already about that, so
 * adding both would open a dead gap under Cancel on some devices and not others.
 */
export const SHEET_PADDING_BOTTOM = 28;

/** The card's own top padding, paid for out of the chrome budget. */
export const SHEET_PADDING_TOP = 10;

/**
 * Backdrop that must stay visible ABOVE the card, on top of the safe-area inset.
 * Without it a full-height sheet reads as an opaque screen with no way out, and
 * the grabber lands against the status bar.
 */
export const SHEET_TOP_GAP = 24;

/**
 * What the card's non-scrolling chrome costs, used for the FIRST paint only —
 * `Sheet` measures the real thing with `onLayout` and passes that in from the
 * second paint on. Roughly: grabber 4 + 12 margin, paddingTop 10, title ~21,
 * subtitle 13 + 4 + 14, a sticky search field ~46, Cancel 14 + ~18 + 14 + 6.
 * Deliberately on the generous side: over-estimating costs a few dp of list,
 * under-estimating puts the header back under the status bar for one frame.
 */
export const SHEET_CHROME_ESTIMATE = 152;

/**
 * The list never collapses to nothing. If the space is so tight that even this
 * does not fit, one scrollable row plus a nudge of overflow beats an empty card.
 */
export const SHEET_SCROLL_MIN = 96;

/** Absolute floor for the card, so absurd inputs cannot render it invisible. */
const SHEET_CARD_MIN = 160;

export type SheetLayoutInput = {
  /** `useWindowDimensions().height`. */
  windowHeight: number;
  /** `useSafeAreaInsets().top` — status bar / notch. */
  insetTop: number;
  /** `useSafeAreaInsets().bottom` — home indicator / Android nav bar. */
  insetBottom: number;
  /** Live IME height, 0 when hidden. */
  keyboardHeight: number;
  /** The `maxHeight` prop: what the CONSUMER asked for, as a cap not a promise. */
  requestedMaxHeight: number;
  /** Measured (or estimated) height of grabber + title + subtitle + stickyHeader + Cancel. */
  chromeHeight: number;
};

export type SheetLayout = {
  /** `maxHeight` for the card, so it can never grow past the top gap. */
  cardMaxHeight: number;
  /** `maxHeight` for the scrollable body — the requested cap, clamped to what fits. */
  scrollMaxHeight: number;
  /** `paddingBottom` for the card. */
  paddingBottom: number;
  /** How far to lift the card off the bottom so the keyboard cannot cover it. */
  liftBy: number;
};

export function sheetLayout(input: SheetLayoutInput): SheetLayout {
  const {
    windowHeight,
    insetTop,
    insetBottom,
    keyboardHeight,
    requestedMaxHeight,
    chromeHeight,
  } = input;

  const liftBy = Math.max(0, keyboardHeight);

  // With the keyboard up the card sits on top of the IME, which already covers
  // the nav bar / home indicator, so the bottom inset would be a dead gap.
  const paddingBottom =
    liftBy > 0 ? SHEET_PADDING_BOTTOM : Math.max(Math.max(0, insetBottom), SHEET_PADDING_BOTTOM);

  // The window, minus what we must not draw into: the top inset, the backdrop gap
  // we promise to keep, and the keyboard.
  const available = windowHeight - Math.max(0, insetTop) - SHEET_TOP_GAP - liftBy;
  const cardMaxHeight = Math.max(SHEET_CARD_MIN, available);

  // What is left for the list once the chrome and the bottom padding are paid
  // for. `requestedMaxHeight` is honoured when it fits and ignored when it does
  // not — that single `Math.min` is the whole of the first bug.
  const room = cardMaxHeight - Math.max(0, chromeHeight) - paddingBottom;
  const scrollMaxHeight = Math.max(
    SHEET_SCROLL_MIN,
    Math.min(Math.max(0, requestedMaxHeight), room),
  );

  return { cardMaxHeight, scrollMaxHeight, paddingBottom, liftBy };
}
