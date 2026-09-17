/**
 * `PickerRow` — a settled choice, shown as a STATEMENT with a quiet way to
 * change it. The read-only half of a picker.
 *
 * Category on 7c, marketplace on 7b, and anything else the person has decided
 * and might revisit.
 *
 *     ┌────────────────────────────────────────────────┐
 *     │  101 LAB                              Change   │
 *     │  Where this listing will be published          │
 *     └────────────────────────────────────────────────┘
 *
 * ── WHY A STATEMENT AND NOT THREE RADIOS ──
 *
 * Three radios for a question already answered is a form; this is the workflow
 * reading of the same data (`UX_DESIGN_RULES.md`, "Adaptive UI"). The options
 * come back on demand, behind "Change".
 *
 * ── WHY IT IS NOT A `Field` MODE ──
 *
 * `Field` wraps a `TextInput` — its whole surface is `variant`, `lines`,
 * `multiline`, `placeholderTextColor`. A mode with no input at all would share
 * the label and the ground and nothing else, and would leave a component whose
 * two halves have disjoint props. The split is at "does the person type into
 * it", which is also what decides whether a keyboard appears.
 *
 * ── THE EMPTY STATE ASKS ──
 *
 * With no value it does not render a blank row: it says what is missing and
 * why, and the action becomes "Choose". That is the AI-UX rule — low
 * confidence requests clarification rather than guessing — and on 7c an empty
 * required category is measurably better than a wrong one (`routingState.ts`).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_PAD, radius, space, useV2Colors } from '@/theme/v2';

import { MaterialFill } from './Surface';
import { QuietAction } from './QuietAction';
import { Text } from './Text';

export function PickerRow({
  value,
  detail,
  emptyTitle,
  emptyDetail,
  onChange,
  /** What is being chosen — "category", "marketplace". Used in the spoken label. */
  noun,
  testID,
}: {
  value?: string | null;
  /** The settled value's supporting line. */
  detail?: string;
  /** Shown INSTEAD of the value when nothing is set. Say what is missing. */
  emptyTitle: string;
  /** And why it matters. */
  emptyDetail?: string;
  /**
   * Omit when there is nothing to change to.
   *
   * A settled value with only one possible answer is a STATEMENT, and a
   * "Change" that opens a list of one is a control that wastes a tap to tell
   * you no. Without this the row still reports the value — it just stops
   * pretending there is a decision left.
   */
  onChange?: () => void;
  noun: string;
  testID?: string;
}) {
  const c = useV2Colors();
  const set = !!value;

  return (
    <View testID={testID} style={[styles.row, { backgroundColor: c.surface }]}>
      {/* Material. Same call as `Field`, which it sits beside on 7c details —
          a settled choice and an editable one should differ in their CONTENT,
          not in whether they have depth. */}
      <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      <View style={styles.text}>
        <Text variant="action" color={set ? 'ink' : 'inkSubtle'}>
          {set ? value : emptyTitle}
        </Text>
        {set ? (
          detail ? (
            <Text variant="caption" color="inkMuted" style={styles.sub}>
              {detail}
            </Text>
          ) : null
        ) : emptyDetail ? (
          <Text variant="caption" color="inkSubtle" style={styles.sub}>
            {emptyDetail}
          </Text>
        ) : null}
      </View>

      {onChange ? (
      <QuietAction
        label={set ? 'Change' : 'Choose'}
        onPress={onChange}
        tone="accent"
        variant="captionMedium"
        // "Change" alone is ambiguous once two of these sit on one screen, and
        // the value is inside the row, so a screen reader never reads it with
        // the button.
        accessibilityLabel={set ? `Change ${noun}, currently ${value}` : `Choose a ${noun}`}
      />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    padding: CARD_PAD,
    borderRadius: radius.lg,
  },
  // minWidth:0 or a long value pushes "Change" off the right edge.
  text: { flex: 1, minWidth: 0 },
  sub: { marginTop: space.xs },
});
