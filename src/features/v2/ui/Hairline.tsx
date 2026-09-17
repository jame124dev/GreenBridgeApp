/**
 * `Hairline` — t6's structural device.
 *
 * The design brief for turn 6 is "Sleeker — space instead of boxes": sections
 * are separated by a rule and whitespace, not by nesting each one in a card.
 * That makes this 1pt line the most load-bearing element in the whole system,
 * which is why it is a component and not four lines of inline style.
 *
 * ⚠️ NOT `StyleSheet.hairlineWidth`. On a 3x screen that is 0.33pt, and at
 * this contrast (#F2F5F3 on #FFFFFF is a 1.1:1 step) it renders as an
 * intermittent smudge — visible on some rows and not others down the same
 * list. The canvas draws 1pt; we draw 1pt.
 *
 * `inset` matches the rule to the content it divides: a full-bleed rule under
 * a section, or one that starts at the gutter when it separates list rows.
 */
import React from 'react';
import { View } from 'react-native';

import { GUTTER, HAIRLINE_WIDTH, useV2Colors } from '@/theme/v2';

export function Hairline({
  inset = 'none',
  strong = false,
}: {
  /** `gutter` aligns the rule with the 24pt content edge; `none` bleeds full width. */
  inset?: 'none' | 'gutter';
  /** A section break that must read as a break, rather than a row divider. */
  strong?: boolean;
}) {
  const c = useV2Colors();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: HAIRLINE_WIDTH,
        backgroundColor: strong ? c.hairlineStrong : c.hairline,
        marginHorizontal: inset === 'gutter' ? GUTTER : 0,
      }}
    />
  );
}
