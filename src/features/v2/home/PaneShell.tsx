/**
 * `PaneShell` — the bottom half of the Home sheet, plus that mode's body.
 *
 * Home's green sheet is SPLIT between two owners:
 *
 *   Screen header (fixed)   brand bar + the Selling/Buying tabs, drawn with
 *                           `headerFlush` so it has no bottom corners
 *   PaneShell (swipes)      the rest of the wash — display line, subline,
 *                           primary action — carrying the 34pt curved bottom
 *
 * Both are `c.wash`, so it reads as one sheet even though the lower half
 * slides sideways with the mode.
 *
 * ⚠️ DO NOT add `renderToHardwareTextureAndroid` / `shouldRasterizeIOS` here.
 * It was tried, on the theory that translating two `LinearGradient` banners
 * was the UI-thread cost. Measured on a device it made things WORSE — jank
 * 4.70% → 9.63%, `Slow UI thread` 7 → 13 — because this pane contains a
 * ScrollView, and rasterising a view whose contents change forces a texture
 * re-upload every frame instead of saving one.
 *
 * The split is here and not lower because the brand bar is IDENTICAL in both
 * modes: if it swiped, the logo would slide out while a matching one slid in,
 * which is the tell of a pager pretending to be tabs. The tabs hold still for
 * the same reason — they are the control, not the content.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
// NOT react-native's ScrollView — see the note on the scroller below.
import { RTVScrollView } from 'reanimated-tab-view';

import { GUTTER, HEADER_SHEET_RADIUS, space, useV2Colors } from '@/theme/v2';

export function PaneShell({
  sheet,
  children,
  testID,
}: {
  /** The mode-specific remainder of the green sheet. */
  sheet: ReactNode;
  /** The body below the sheet. Scrolls. */
  children: ReactNode;
  testID?: string;
}) {
  const c = useV2Colors();

  return (
    <View style={styles.pane} testID={testID}>
      {/* flat: the header sheet, and it rides a SWIPING pane — rasterising
          the Home panes measured 4.70% to 9.63% jank. */}
      <View style={[styles.sheet, { backgroundColor: c.wash }]}>{sheet}</View>

      {/*
        ⚠️ `RTVScrollView`, NOT react-native's `ScrollView`.

        `TabView` wraps every pane in a `GestureDetector` carrying a
        `Gesture.Pan`. A plain `ScrollView` inside it never receives a vertical
        drag — the pan claims the touch and the list simply does not move. On
        device, signed in, Home's DRAFTS section sat permanently below the fold
        with no way to reach it, while the HORIZONTAL swipe between Selling and
        Buying kept working. That asymmetry is the signature of this bug.

        It hid for weeks because a GUEST has no drafts and no listings, so
        nothing on Home was ever tall enough to need scrolling. It appeared the
        first minute a real account was used.

        `RTVScrollView` is the library's own scroller, built to hand the
        vertical axis to the list and the horizontal axis to the pager. Same
        props as `ScrollView`, so this is a swap, not a rewrite.
      */}
      <RTVScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </RTVScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Width is set by the pager, which lays two of these out in a row.
  pane: { flex: 1 },
  flex: { flex: 1 },
  sheet: {
    // The curved bottom lives here, not on the fixed header above it.
    borderBottomLeftRadius: HEADER_SHEET_RADIUS,
    borderBottomRightRadius: HEADER_SHEET_RADIUS,
    paddingHorizontal: GUTTER,
    /**
     * INTERNAL ≤ EXTERNAL. This is the sheet's own bottom padding — space
     * INSIDE the header group. The gap from the sheet to the first body block
     * is `blockGap` (GUTTER, 24) in the panes.
     *
     * It was `space['8xl']` (34), i.e. the space inside the group was LARGER
     * than the space separating it from the next group. That inversion is what
     * made the boundary read as a void rather than as a break: measured on
     * device 2026-09-17, the hero sheet ended at 450dp on an ~840dp screen with
     * the first row at 525dp.
     *
     * `5xl` (22) puts it just under the 24 that follows, so the sheet closes and
     * the next block begins, instead of the two competing.
     * See `Docs/UIUXRuleSet/spacing-and-layout.md` R2.
     */
    paddingBottom: space['5xl'],
  },
  body: { paddingBottom: space['6xl'] },
});
