import { describe, it, expect } from '@jest/globals';

import {
  SHEET_PADDING_BOTTOM,
  SHEET_SCROLL_MIN,
  SHEET_TOP_GAP,
  sheetLayout,
  type SheetLayoutInput,
} from '../sheetLayout';

/**
 * The arithmetic behind both sheet bugs from the 2026-08-19 device pass. A unit
 * test cannot see a status bar or a keyboard, but it CAN see that 520 was never
 * compared to the window height, which is the actual defect in both cases.
 *
 * The two scenarios below are the measured ones, converted to dp:
 *  - FIX 1, `wm size 750x1334` / `wm density 320` -> 375 x 667 dp @2.0. Reported:
 *    the ScrollView measured 1040 px = exactly the 520 dp cap, the grabber/title/
 *    subtitle were clipped out of the hierarchy, and the search field sat at
 *    [40,0][710,72] — flush to y=0, under the clock.
 *  - FIX 2, 1080 x 2400 px @2.625 -> ~411 x 914 dp, IME from y=1524 px -> 334 dp
 *    tall. Reported: card [0,1343][1080,2400], search + both rows + Cancel all
 *    inside the IME.
 */
const base: SheetLayoutInput = {
  windowHeight: 667,
  insetTop: 24,
  insetBottom: 0,
  keyboardHeight: 0,
  requestedMaxHeight: 520,
  chromeHeight: 177,
};

describe('FIX 1 — the card can never grow past the top gap', () => {
  it('clamps the category sheet on an SE-class screen instead of honouring 520', () => {
    const l = sheetLayout(base);
    // The bug: 520 was used verbatim.
    expect(l.scrollMaxHeight).toBeLessThan(520);
    // 667 - 24 top inset - 24 gap = 619 for the card; minus 177 chrome and 28
    // bottom padding = 414 for the list.
    expect(l.cardMaxHeight).toBe(619);
    expect(l.scrollMaxHeight).toBe(414);
  });

  it('keeps the whole card inside the window, with the promised backdrop gap', () => {
    const l = sheetLayout(base);
    const total = base.chromeHeight + l.scrollMaxHeight + l.paddingBottom;
    expect(total).toBeLessThanOrEqual(l.cardMaxHeight);
    expect(total + base.insetTop + SHEET_TOP_GAP).toBeLessThanOrEqual(base.windowHeight);
  });

  it('honours a request that DOES fit — this is a cap, not a resize', () => {
    // A tall phone: 520 is a perfectly good list height there and must survive.
    const l = sheetLayout({ ...base, windowHeight: 914, insetTop: 24 });
    expect(l.scrollMaxHeight).toBe(520);
  });

  it('never inflates a small request', () => {
    const l = sheetLayout({ ...base, windowHeight: 914, requestedMaxHeight: 120 });
    expect(l.scrollMaxHeight).toBe(120);
  });

  it('subtracts a taller chrome, not a constant', () => {
    // The same screen with the search field and subtitle gone gets MORE list.
    const lean = sheetLayout({ ...base, chromeHeight: 100 });
    expect(lean.scrollMaxHeight).toBe(491);
    expect(lean.scrollMaxHeight).toBeGreaterThan(sheetLayout(base).scrollMaxHeight);
  });

  it('scales with the top inset, so a notch is not drawn into', () => {
    const notch = sheetLayout({ ...base, insetTop: 59 });
    expect(notch.cardMaxHeight).toBe(667 - 59 - SHEET_TOP_GAP);
    expect(notch.scrollMaxHeight).toBeLessThan(sheetLayout(base).scrollMaxHeight);
  });
});

describe('FIX 2 — the keyboard lifts the card instead of swallowing it', () => {
  const tall: SheetLayoutInput = { ...base, windowHeight: 914, insetTop: 24, insetBottom: 16 };

  it('lifts the card by exactly the IME height', () => {
    const l = sheetLayout({ ...tall, keyboardHeight: 334 });
    expect(l.liftBy).toBe(334);
  });

  it('does not lift at all when the keyboard is down', () => {
    expect(sheetLayout(tall).liftBy).toBe(0);
  });

  it('drops the bottom inset while lifted — the IME already covers the nav bar', () => {
    expect(sheetLayout(tall).paddingBottom).toBe(SHEET_PADDING_BOTTOM);
    const withInset = sheetLayout({ ...tall, insetBottom: 48 });
    expect(withInset.paddingBottom).toBe(48);
    expect(sheetLayout({ ...tall, insetBottom: 48, keyboardHeight: 334 }).paddingBottom).toBe(
      SHEET_PADDING_BOTTOM,
    );
  });

  // ⛔ THE POINT OF SOLVING BOTH AT ONCE. Lifting the card without also shrinking
  // it would push the header off the TOP of the screen — bug 1, re-created by the
  // fix for bug 2.
  it('shrinks the list by the keyboard as well as lifting past it', () => {
    const down = sheetLayout(tall);
    const up = sheetLayout({ ...tall, keyboardHeight: 334 });
    expect(up.scrollMaxHeight).toBeLessThan(down.scrollMaxHeight);
    const total = tall.chromeHeight + up.scrollMaxHeight + up.paddingBottom;
    // Lifted card + its own height + the top inset + the gap still fit the window.
    expect(up.liftBy + total + tall.insetTop + SHEET_TOP_GAP).toBeLessThanOrEqual(
      tall.windowHeight,
    );
  });

  it('survives the worst case — small screen AND a big keyboard', () => {
    const l = sheetLayout({ ...base, keyboardHeight: 300 });
    expect(l.scrollMaxHeight).toBeGreaterThanOrEqual(SHEET_SCROLL_MIN);
    expect(l.liftBy).toBe(300);
    // 667 - 24 - 24 - 300 = 319 card, minus 177 chrome and 28 padding = 114.
    expect(l.scrollMaxHeight).toBe(114);
  });

  it('shows a row rather than an empty card when the space is impossible', () => {
    const l = sheetLayout({ ...base, keyboardHeight: 560 });
    expect(l.scrollMaxHeight).toBe(SHEET_SCROLL_MIN);
  });
});

describe('sheetLayout is defensive about junk input', () => {
  it('treats negative insets and keyboard heights as zero', () => {
    const l = sheetLayout({ ...base, insetTop: -10, insetBottom: -10, keyboardHeight: -10 });
    expect(l.liftBy).toBe(0);
    expect(l.paddingBottom).toBe(SHEET_PADDING_BOTTOM);
    expect(l.cardMaxHeight).toBe(667 - SHEET_TOP_GAP);
  });

  it('never returns a negative or zero card height', () => {
    const l = sheetLayout({ ...base, windowHeight: 0 });
    expect(l.cardMaxHeight).toBeGreaterThan(0);
    expect(l.scrollMaxHeight).toBeGreaterThan(0);
  });
});
