/**
 * The scroll arithmetic for a streaming chat thread.
 *
 * This logic shipped in `app/(lab)/chat.tsx` and was then copied into v2's chat
 * — two copies, no tests on either, because reaching it meant rendering a
 * screen. Extracted to `threadScroll.ts`, these are the rules that were only
 * ever recorded in comments.
 */
import {
  FOLLOW_BAND_IDLE,
  FOLLOW_BAND_LIVE,
  bottomTarget,
  distanceToEnd,
  isAtBottom,
  pinTarget,
  shouldFollow,
} from '../threadScroll';

/** A thread twice the viewport tall, scrolled to the very top, no pin. */
const unpinned = {
  contentHeight: 2000,
  spacerHeight: 0,
  scrollY: 0,
  viewportHeight: 1000,
};

describe('distanceToEnd', () => {
  it('measures to the end of content when nothing is pinned', () => {
    expect(distanceToEnd(unpinned)).toBe(1000);
  });

  /**
   * ⚠️ THE ONE THAT MATTERS. With a message pinned there is a viewport-tall
   * blank tail below the answer. Not subtracting it makes a reader who IS at
   * the end of the answer look a whole viewport away from it — the jump control
   * appears, and tapping it scrolls into empty space.
   */
  it('subtracts the pin spacer', () => {
    const pinned = { ...unpinned, contentHeight: 3000, spacerHeight: 1000, scrollY: 2000 };
    // 3000 − 1000 spacer − (2000 + 1000) = −1000: past the end of the answer.
    expect(distanceToEnd(pinned)).toBe(-1000);
  });

  it('is 0 at the exact end of real content', () => {
    expect(distanceToEnd({ ...unpinned, scrollY: 1000 })).toBe(0);
  });
});

describe('isAtBottom', () => {
  it('is true at the end', () => {
    expect(isAtBottom({ ...unpinned, scrollY: 1000 }, false)).toBe(true);
  });

  it('is false a screen away', () => {
    expect(isAtBottom(unpinned, false)).toBe(false);
  });

  /**
   * The band widens during a live turn because streaming reflow moves the end
   * by tens of pixels on its own. A reader 100px up is following an idle thread
   * loosely, but is still "at the bottom" of one that is actively growing.
   */
  it('accepts a wider gap while a turn is live', () => {
    const at100 = { ...unpinned, scrollY: 900 }; // distance = 100
    expect(isAtBottom(at100, false)).toBe(false);
    expect(isAtBottom(at100, true)).toBe(true);
  });

  it('treats the band as exclusive at its exact value', () => {
    const atBand = { ...unpinned, scrollY: 1000 - FOLLOW_BAND_IDLE }; // distance = 80
    expect(isAtBottom(atBand, false)).toBe(false);
    expect(FOLLOW_BAND_LIVE).toBeGreaterThan(FOLLOW_BAND_IDLE);
  });
});

describe('shouldFollow', () => {
  const following = { atBottom: true, dragging: false, pinActive: false, scheduled: false };

  it('follows when at the bottom and nothing objects', () => {
    expect(shouldFollow(following)).toBe(true);
  });

  it.each([
    ['the reader scrolled up', { atBottom: false }],
    ['a finger is down', { dragging: true }],
    ['a message is pinned', { pinActive: true }],
    ['a scroll is already queued this frame', { scheduled: true }],
  ])('does not follow when %s', (_why, override) => {
    expect(shouldFollow({ ...following, ...override })).toBe(false);
  });

  /**
   * `pinActive` has to beat `atBottom`. On send the pin scrolls the new message
   * to the top, which leaves the reader at the bottom of a short thread — so
   * without this veto the very next token would yank the pinned message away,
   * which is the behaviour the pin exists to stop.
   */
  it('lets the pin override being at the bottom', () => {
    expect(shouldFollow({ ...following, pinActive: true })).toBe(false);
  });
});

describe('bottomTarget', () => {
  it('lands on the end of the answer, above the spacer tail', () => {
    // 3000 − 1000 spacer − 1000 viewport + 16 gap
    expect(bottomTarget({ contentHeight: 3000, spacerHeight: 1000, viewportHeight: 1000 }, 16)).toBe(
      1016,
    );
  });

  /** A thread shorter than its viewport must not compute a negative offset. */
  it('never returns a negative offset', () => {
    expect(bottomTarget({ contentHeight: 200, spacerHeight: 0, viewportHeight: 1000 }, 16)).toBe(0);
  });

  /** The two screens pass different tokens — lab's md is 12, v2's 3xl is 16. */
  it('honours the caller gap rather than a baked-in constant', () => {
    const m = { contentHeight: 3000, spacerHeight: 1000, viewportHeight: 1000 };
    expect(bottomTarget(m, 12)).toBe(1012);
    expect(bottomTarget(m, 16)).toBe(1016);
  });
});

describe('pinTarget', () => {
  it('puts the row at the top, less the gap', () => {
    expect(pinTarget(500, 16)).toBe(484);
  });

  /** The first message of a thread sits at y≈0; gap must not push it negative. */
  it('never returns a negative offset', () => {
    expect(pinTarget(4, 16)).toBe(0);
  });
});
