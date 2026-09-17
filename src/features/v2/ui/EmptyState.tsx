/**
 * `EmptyState` — a whole screen with nothing in it yet.
 *
 * Not `SectionNote`: that is one line under a section header, inside a screen
 * that otherwise has content. This is the case where the screen IS empty.
 *
 * ── Why this exists ──
 *
 * Four screens were built in parallel and produced four different empty
 * states: two with a heading and two without, two indented to the gutter and
 * two accidentally indented to a timeline rail's text column, and all four
 * offering only a quiet "Back to home" link. On a device the inconsistency was
 * obvious and the dead end was worse than the inconsistency.
 *
 * ── The rule it enforces ──
 *
 * **An empty screen is an invitation to act, not a state to report.** So
 * `action` is required, and it should be the thing that would actually fill
 * the screen — "Scan an item" on a review step, not "Back to home". A way out
 * is the secondary option, never the only one.
 *
 * It sits high rather than centred: centring in a tall column under a short
 * header leaves a void above the copy that reads as a broken layout rather
 * than an empty one.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { GUTTER, MAX_CONTENT_WIDTH, SECTION_GAP, space } from '@/theme/v2';

import { PrimaryAction } from './PrimaryAction';
import { QuietAction } from './QuietAction';
import { Text } from './Text';

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  /** What is empty, in the interface's voice. Not "No data". */
  title: string;
  /** Why it is empty and what fills it. One or two sentences. */
  body: string;
  /** The action that would fill this screen. Required — see the note above. */
  actionLabel: string;
  onAction: () => void;
  /** A way out. Optional, and always secondary to the action. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text variant="h3">{title}</Text>
      <Text variant="body" color="inkMuted" style={styles.body}>
        {body}
      </Text>

      <PrimaryAction label={actionLabel} onPress={onAction} style={styles.action} />

      {secondaryLabel && onSecondary ? (
        <QuietAction label={secondaryLabel} onPress={onSecondary} align="start" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Top-aligned. See the note above on why this is not centred.
    paddingTop: SECTION_GAP,
    paddingHorizontal: GUTTER,
    // Cap the measure so the body copy does not run to a tablet's full width.
    maxWidth: MAX_CONTENT_WIDTH,
  },
  body: { marginTop: space.lg },
  action: { marginTop: space['6xl'], marginBottom: space.md },
});
