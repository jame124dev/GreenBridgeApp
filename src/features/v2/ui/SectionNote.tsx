/**
 * `SectionNote` — the line that stands in for a section's content.
 *
 * Loading, empty, and error all land in the same place: under a
 * `SectionHeader`, where rows would otherwise be. Every list screen needs it,
 * and every list screen was about to write its own.
 *
 * Two rules from the design brief, enforced here rather than remembered:
 *
 * • **Explanatory loading, never a bare spinner.** "Looking for your drafts"
 *   tells someone what the wait is for. A spinner tells them the app is busy,
 *   which they already know.
 *
 * • **An empty screen is an invitation to act, not a state.** Pass an
 *   `action` wherever there is something the person can actually do. Errors
 *   say what happened and offer the next step; they do not apologise and they
 *   are never vague.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { GUTTER, space } from '@/theme/v2';

import { QuietAction } from './QuietAction';
import { Text } from './Text';

export function SectionNote({
  children,
  tone = 'muted',
  actionLabel,
  onAction,
  action = 'stacked',
}: {
  children: string;
  /** `danger` for a failure the person can retry. */
  tone?: 'muted' | 'danger';
  /** "Try again", "Add a want". Say what happens, not "Retry". */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Where the action sits.
   *
   * `stacked` (default) puts it on its own line under the note. That is right
   * for a sentence or two — but under a SHORT note it reads as a second
   * paragraph rather than as the note's own control.
   *
   * `inline` puts it at the end of the same row. The row then grows to 44pt,
   * because the action keeps its full touch target: an inline control is not
   * a reason to ship a 20pt tap area.
   */
  action?: 'stacked' | 'inline';
}) {
  return (
    <View
      style={[styles.note, action === 'inline' && styles.inlineRow]}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
    >
      <Text
        variant="caption"
        color={tone === 'danger' ? 'danger' : 'inkSubtle'}
        // minWidth:0 or the note refuses to shrink and pushes the inline
        // action off the right edge.
        style={action === 'inline' ? styles.inlineText : undefined}
      >
        {children}
      </Text>
      {actionLabel && onAction ? (
        <QuietAction
          label={actionLabel}
          onPress={onAction}
          tone="accent"
          variant="captionMedium"
          align="start"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: GUTTER, paddingVertical: space.xl },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: space['2xl'] },
  inlineText: { flex: 1, minWidth: 0 },
});
