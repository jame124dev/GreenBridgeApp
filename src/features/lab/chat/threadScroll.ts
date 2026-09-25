/**
 * The scroll arithmetic behind a streaming chat thread.
 *
 * ── WHY THIS EXISTS ──
 *
 * `app/(lab)/chat.tsx` worked this out over several rounds — its comments name
 * the jump bugs each rule prevents. On 2026-09-21 v2's chat got the same
 * behaviour by COPYING it, which left the repo holding the same four decisions
 * twice, in two screens, with no test on either. This is that logic, once.
 *
 * Pure and JSX-free on purpose: these are the parts worth pinning, and until
 * now they could only be reached by rendering a chat screen, which is why
 * neither copy was ever tested.
 *
 * ── THE FOUR DECISIONS ──
 *
 * 1. Distance is measured to the end of REAL content, never to the end of the
 *    pin spacer's blank tail.
 * 2. The "still following" band is WIDER during a live turn.
 * 3. While a message is pinned, the stream does not auto-follow at all.
 * 4. Never move the view while a finger is down.
 *
 * The screens keep what is genuinely theirs: their own spacing token for the
 * gap above a pinned row (lab's `spacing.md` is 12, v2's `space['3xl']` is 16 —
 * different scales, so `topGap` is a parameter and not a constant in here).
 */

/**
 * How close to the end still counts as "at the bottom".
 *
 * TWO numbers: while a turn is live the answer reflows as it grows — a tall
 * image card lands, a list wraps — and a single tight band reads those reflows
 * as "the reader has scrolled away".
 *
 * ⚠️ WHAT THIS ACTUALLY GOVERNS, once a message is pinned: the JUMP-TO-LATEST
 * PILL, not following. `shouldFollow` vetoes on `pinActive`, and a pinned
 * message stays pinned for the rest of the conversation (see that function), so
 * after the first send the band decides only whether the pill is shown. An
 * earlier version of this comment implied it kept the view following mid-answer;
 * a fresh reviewer read the code, found follow unreachable, and reported it as a
 * bug. It is not a bug — but the comment was wrong about which behaviour the
 * number serves.
 *
 * Provenance: both were tuned in `app/(lab)/chat.tsx` on this app's own
 * content. They are not from a published recommendation; see
 * `Docs/v2/CHAT-BEHAVIOUR-RESEARCH.md` §3.3 for a threshold claim that was
 * cited here once and withdrawn when the sources turned out not to make it.
 */
export const FOLLOW_BAND_IDLE = 80;
export const FOLLOW_BAND_LIVE = 120;

export type ThreadMetrics = {
  /** Total scrollable content height, spacer included. */
  contentHeight: number;
  /** Height of the viewport-tall tail under the last message; 0 when unpinned. */
  spacerHeight: number;
  /** Current scroll offset. */
  scrollY: number;
  /** Visible height of the scroll view. */
  viewportHeight: number;
};

/**
 * Pixels between the bottom of the viewport and the end of the real answer.
 *
 * ⚠️ The spacer is subtracted. Without that, a pinned thread reports a full
 * viewport of "distance" that is just blank tail, so the jump-to-latest control
 * appears while the reader is already looking at the end of the answer — and
 * tapping it scrolls into empty space.
 *
 * Can go negative once scrolled into the tail; callers only compare it.
 */
export function distanceToEnd(m: ThreadMetrics): number {
  return m.contentHeight - m.spacerHeight - (m.scrollY + m.viewportHeight);
}

/** Is the reader close enough to the end to count as following it? */
export function isAtBottom(m: ThreadMetrics, liveTurn: boolean): boolean {
  return distanceToEnd(m) < (liveTurn ? FOLLOW_BAND_LIVE : FOLLOW_BAND_IDLE);
}

/**
 * Should a content-size change drag the view down to the new end?
 *
 * Every one of these is a veto, and each has a reason:
 *  • `pinActive`  — a pinned message stays put; the answer grows beneath it.
 *  • `dragging`   — never fight a finger that is already on the screen.
 *  • `scheduled`  — one scroll per frame, so a burst of tokens glides instead
 *                   of stacking overlapping animations.
 *  • `atBottom`   — the reader scrolled up to re-read; leave them there.
 *
 * ⚠️ `pinActive` IS PERMANENT ONCE A MESSAGE EXISTS, AND THAT IS THE DESIGN.
 * The shipped chat states it outright — *"once there's a user message on screen
 * we never auto-follow the stream to the bottom; the pinned message stays at
 * the top and the answer grows below it. (The scroll-to-bottom pill still lets
 * the user jump down.)"* Following and pinning are alternatives, not partners:
 * a reader cannot both keep their question in view and be dragged to the tail.
 *
 * This sentence is restored here because the extraction that created this file
 * dropped it, and a reviewer reading `shouldFollow` in isolation then diagnosed
 * dead code. Auto-follow is genuinely reachable only BEFORE the first send —
 * which is the one moment there is nothing to pin. Do not "fix" it by clearing
 * `pinActive` on settle; that re-introduces the yank the pin exists to prevent.
 */
export function shouldFollow(s: {
  atBottom: boolean;
  dragging: boolean;
  pinActive: boolean;
  scheduled: boolean;
}): boolean {
  return s.atBottom && !s.dragging && !s.pinActive && !s.scheduled;
}

/**
 * Where "jump to latest" should land: the end of the answer, not the end of
 * the spacer. `topGap` is the screen's own breathing room above that point.
 *
 * Clamped at 0 — a thread shorter than its viewport would otherwise compute a
 * negative offset and bounce.
 */
export function bottomTarget(
  m: Pick<ThreadMetrics, 'contentHeight' | 'spacerHeight' | 'viewportHeight'>,
  topGap: number,
): number {
  return Math.max(0, m.contentHeight - m.spacerHeight - m.viewportHeight + topGap);
}

/**
 * Where a pinned row should sit: its own offset, less the screen's gap.
 *
 * Clamped at 0 so the FIRST message of a thread cannot scroll the view to a
 * negative offset.
 */
export function pinTarget(rowY: number, topGap: number): number {
  return Math.max(0, rowY - topGap);
}
