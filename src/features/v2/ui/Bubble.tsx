/**
 * `Bubble` — one turn in a conversation.
 *
 *   assistant   ╭──────────────────╮      `fill`, tail bottom-LEFT
 *               │ …                │
 *               ╰─┬────────────────╯
 *
 *                      ╭────────────────┬─╮   `accentWash`, tail bottom-RIGHT
 *                      │              … │ │
 *                      ╰────────────────╯     right-aligned
 *
 * ── WHY THIS EXISTS, AND WHY IT DIVERGES FROM `app/v2/chat.tsx` ──
 *
 * The kit had no conversation primitives; `chat.tsx` flagged that as a KIT GAP
 * and inlined its own `UserBubble`. This is the second screen to need one (3a,
 * the voice turn), so the shape moves into the kit rather than being written a
 * second time.
 *
 * But it is NOT a lift-and-shift of `chat.tsx`'s bubble, and the difference is
 * deliberate. That screen boxes only the USER and lets the assistant answer as
 * prose on the page ground — "space instead of boxes", right for a long written
 * answer you read top to bottom. The canvas boxes BOTH sides on 3a
 * (`t3-full.html`), and for a voice transcript that is correct: the turns are
 * short, they alternate quickly, and with one side unboxed there is nothing to
 * tell you at a glance where a spoken turn started and stopped.
 *
 * So the two screens genuinely want different things, and this component
 * carries the transcript shape. `chat.tsx` is NOT migrated onto it — that is a
 * change to a live screen and a separate decision, tracked on the checklist.
 *
 * ── THE TAIL ──
 *
 * One corner drops from `radius.lg` to `space.sm`, on the side the speaker is
 * on. It is the whole reason the two sides read as two voices even when the
 * grounds are close, so it is not optional and not configurable.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, useV2Colors } from '@/theme/v2';

import { Text } from './Text';

export type BubbleFrom = 'assistant' | 'user';

export function Bubble({
  from,
  text,
  children,
  style,
  testID,
}: {
  from: BubbleFrom;
  /** The turn itself. Omit when the bubble is built from `children` instead. */
  text?: string;
  /** Anything richer than a line of speech — a priced answer, a divider, a CTA. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useV2Colors();
  const mine = from === 'user';

  return (
    <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
      <View
        testID={testID}
        style={[
          styles.bubble,
          mine ? styles.tailRight : styles.tailLeft,
          { backgroundColor: mine ? c.accentWash : c.fill },
          style,
        ]}
      >
        {text ? (
          <Text variant="row" color={mine ? 'accentInk' : 'ink'}>
            {text}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%' },
  rowLeft: { alignItems: 'flex-start' },
  rowRight: { alignItems: 'flex-end' },
  bubble: {
    // 84–88% on the canvas. One value: a bubble that changes width by speaker
    // reads as a layout bug, not as emphasis.
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingHorizontal: space['3xl'],
    paddingVertical: space.xl,
    gap: space.xl,
  },
  tailLeft: { borderBottomLeftRadius: space.sm },
  tailRight: { borderBottomRightRadius: space.sm },
});
