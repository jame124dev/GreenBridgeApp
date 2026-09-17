/**
 * `StagedChip` — a chip for something the person has ADDED and can drop again.
 *
 * A staged attachment on the assistant composer; a selected marketplace; any
 * "you put this here, take it away" token.
 *
 * ── WHY THIS IS NOT `Chip` ──
 *
 * `Chip` is decorative and deliberately unreachable: it sets
 * `accessibilityElementsHidden` and `importantForAccessibility="no-hide-
 * descendants"`, because a match score or a count is a value, not a control,
 * and announcing it separately from the row it qualifies is noise.
 *
 * This one contains a real button. Giving `Chip` an `onRemove` would mean a
 * component that is sometimes hidden from the screen reader and sometimes
 * carries the only way to undo an action — so they stay apart, and the split
 * is at "is it a control", not at "does it look like a pill".
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native — RN's is intercepted by
// RNGH inside a gesture container. See `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { X } from 'lucide-react-native';

import { control, icon, radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The × is 16pt of glyph; the target around it has to reach 44. */
const HIT = { top: space.xl, bottom: space.xl, left: space.xl, right: space.xl };

export function StagedChip({
  label,
  onRemove,
  testID,
}: {
  label: string;
  onRemove: () => void;
  testID?: string;
}) {
  const c = useV2Colors();
  // Docs/UIUXRuleSet/responsiveness.md R4. Scale IS on here: the remove button
  // is a small glyph, so a 3% shrink is legible on it in a way it is not on a
  // full-width row — and removing a file deserves a clear "yes, that one".
  const remove = usePressFeedback();

  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: c.fill }]}>
      {/* `flexShrink: 1` + `numberOfLines`: a staged file can be
          "IMG_20260903_121314_scan_of_the_nameplate.jpg" and it must truncate
          rather than push its own remove button off the row. */}
      <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <AnimatedPressable
        onPress={onRemove}
        onPressIn={remove.onPressIn}
        onPressOut={remove.onPressOut}
        accessibilityRole="button"
        // Named, not "Remove": a row of five chips would otherwise announce
        // "Remove" five times with no way to tell them apart.
        accessibilityLabel={`Remove ${label}`}
        hitSlop={HIT}
        style={remove.animatedStyle}
      >
        <X size={icon.sm} color={c.inkSubtle} strokeWidth={2} />
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    maxWidth: '100%',
    height: control.chip,
    paddingHorizontal: space['2xl'],
    borderRadius: radius.pill,
  },
  label: { flexShrink: 1 },
});
