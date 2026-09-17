/**
 * `SectionHeader` — the tracked eyebrow that opens every section.
 *
 *     DRAFTS                                    See all 7
 *
 * 10pt / 600 / .16em tracking, uppercase. Used 37 times across the canvas and
 * the most distinctive type treatment in the design: with no boxes to group
 * content, this label plus the whitespace above it is what makes a section
 * read as a section.
 *
 * The optional action is the only place a link appears in the middle of a
 * screen, so it is styled once here and nowhere else.
 *
 * Note on `alignItems: 'baseline'`: the canvas aligns the 10pt eyebrow and
 * the 12pt action on their baselines, not their boxes. Centring them instead
 * makes the eyebrow sit visibly low.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { GUTTER, MIN_TOUCH, space, usePressFeedback } from '@/theme/v2';

import { Chip } from './Chip';
import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  chip,
  chipTone = 'accent',
  trailing,
  tone = 'subtle',
  gutter = true,
}: {
  title: string;
  /** e.g. "See all 7". Say what it does and how many, as the canvas does. */
  actionLabel?: string;
  onAction?: () => void;
  /**
   * A badge after the title — "AI" on a field the model filled in.
   *
   * `Chip` at `sm` is 26pt on `micro` type, which is the drawn badge exactly.
   * Do NOT pass a glyph with it here: a 34pt pill beside a 10pt label
   * outweighs the label it is qualifying.
   */
  chip?: string;
  chipTone?: 'accent' | 'neutral';
  /** Right-aligned content — a character count, "Use my location". */
  trailing?: ReactNode;
  /** `muted` for a field label; `subtle` for a list section. */
  tone?: 'subtle' | 'muted';
  /** Off when the header sits inside an already-padded container. */
  gutter?: boolean;
}) {
  // Docs/UIUXRuleSet/responsiveness.md R4. `scale: false`: the label is 12pt
  // inside a hitSlop-grown target, so scaling the visible text would be the
  // only thing that moved and would read as a twitch.
  const action = usePressFeedback({ scale: false });

  return (
    <View style={[styles.row, gutter && styles.gutter]}>
      <Text variant="eyebrow" color={tone === 'muted' ? 'inkMuted' : 'inkSubtle'}>
        {title}
      </Text>

      {chip ? <Chip label={chip} tone={chipTone} /> : null}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}

      {actionLabel && onAction ? (
        <AnimatedPressable
          onPress={onAction}
          onPressIn={action.onPressIn}
          onPressOut={action.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          // The label is 12pt tall; the tap target must not be.
          hitSlop={{ top: space['3xl'], bottom: space['3xl'], left: space['3xl'], right: space['3xl'] }}
          style={[styles.action, action.animatedStyle]}
        >
          <Text variant="captionMedium" color="accentInk">
            {actionLabel}
          </Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // `center`, not `baseline`: a chip has no baseline to share with the label,
    // and on baseline it hangs below the text it qualifies.
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.lg,
    marginBottom: space.sm,
  },
  trailing: { marginLeft: 'auto' },
  gutter: { paddingHorizontal: GUTTER },
  action: { minHeight: undefined, justifyContent: 'center' },
});

/** Exported so screens can reason about the tap target without re-deriving it. */
export const SECTION_ACTION_MIN_TOUCH = MIN_TOUCH;
