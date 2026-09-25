/**
 * `OptionCard` — one member of a radio group, shown as a card with a title, a
 * supporting line, an optional count, and an optional PREVIEW of what choosing
 * it produces.
 *
 *     ┌──────────────────────────────────────────┐
 *     │  ( )  Single product                     │
 *     │       One batch, all photos pooled.      │
 *     └──────────────────────────────────────────┘
 *     ╔══════════════════════════════════════════╗
 *     ║  (●)  Multiple products           ( 10 ) ║
 *     ║       10 separate listings, one per      ║
 *     ║       detected product.                  ║
 *     ║   ┌────┐┌────┐┌────┐┌────┐┌───           ║
 *     ║   │ 1  ││ 2  ││ 3  ││ 4  ││ 5            ║
 *     ║   └────┘└────┘└────┘└────┘└───           ║
 *     ╚══════════════════════════════════════════╝
 *
 * ── PROVENANCE (UI_SOURCING_RULES.md) ─────────────────────────────────────
 *
 * L1 — already in this codebase? The shape existed only as
 *      `components/scanner/DetectionGroupCard.tsx`: a NativeWind card from
 *      before the v2 kit. It is what this replaces, and it is not reusable —
 *      `brand-*` classes, no palette roles, no material.
 *      The web seller flow was checked too (`GreenBridgeSeller-release/src/
 *      pages/new-submission-upload/`): it renders this decision inside a much
 *      larger page component, nothing extractable.
 * L2 — the kit? `SegmentedControl` is two equal destinations in a track, with
 *      no room for a description or a preview. `PillButton` carries the radio
 *      SEMANTICS (`role="radio"`, `accessibilityState.checked`) and they are
 *      mirrored here. `TintedRow` is a single offer, not a choice among some.
 *      No option card. Added here rather than in the screen, per the barrel's
 *      own instruction.
 * L3 — searched for a maintained RN implementation. `react-native-radio-
 *      buttons-group` (MIT), `react-native-radio-group`, `radio-react-native`
 *      and `fluentui-react-native`'s RadioGroup are all label+value radio
 *      LISTS — none carries a description, a count or a preview slot.
 *      Opensource UI's card radio group is the right shape but is React +
 *      Tailwind for the web, not RN.
 *
 * ⚠️ HAND-ROLLED, and saying so because the rule requires it: the search
 * found no RN component shipping "radio + description + arbitrary preview".
 * What is NOT hand-rolled is the composition — ground, ramp, radius and ink
 * all come from `Surface`/`Text`/the palette, and the a11y contract is copied
 * from `PillButton`.
 *
 * ── WHY THE PREVIEW IS A SLOT AND NOT A `thumbs` PROP ──
 *
 * The card it replaces took `groupThumbs: Photo[][]` and rendered a row per
 * group. On a 10-group scan that is ten labelled rows of ragged thumbnails
 * inside a radio button — the card grew with the data until the option it was
 * describing scrolled off the top, and the two options stopped being
 * comparable at a glance. A slot keeps the card a fixed shape and makes the
 * preview's density the preview's own problem (see `GroupCoverStrip`).
 */
import React, { type ReactNode } from 'react';
/*
  ⚠️ `Pressable` from REACT-NATIVE, not from react-native-gesture-handler.

  This was written the other way round first, copying `TintedRow`, and the card
  was DEAD: pressing "Single product" left "Multiple products" selected.
  Clicking the TITLE rather than the card centre made no difference, so it was
  not a mis-aimed click landing in the preview scroller. Swapping this one
  import fixed it, verified by reading the selection back off the DOM.

  ⚠️ WHAT IS PROVEN vs WHAT IS A GUESS. Proven: with the gesture-handler
  `Pressable` this card did not respond, and with the react-native one it does.
  NOT proven: why. The obvious story — "RNGH's Pressable does not work on this
  surface" — is FALSE, because `PrimaryAction` uses the gesture-handler import
  too and its presses worked in the very same browser run. The remaining
  difference is that this card nests a horizontal `ScrollView` (the preview)
  INSIDE the pressable, and a native scroll view inside an RNGH gesture is a
  known way to have the tap cancelled. That is a hypothesis, not a measurement.

  Practical rule until someone measures it: take `Pressable` from
  gesture-handler when the control sits inside an RNGH gesture subtree (Home's
  pager — see `TintedRow`); take the react-native one when the control CONTAINS
  a scrollable. `DetectionGroupCard`, the card this replaces, used the RN one.
*/
import { Pressable, StyleSheet, View } from 'react-native';

import { CARD_PAD, radius, space, useV2Colors } from '@/theme/v2';

import { Chip } from './Chip';
import { MaterialFill } from './Surface';
import { Text } from './Text';

export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  /** Optional trailing count, e.g. the number of listings this choice makes. */
  countLabel,
  /** Rendered full-bleed-ish under the copy. Omit for a plain option. */
  preview,
  testID,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  countLabel?: string;
  preview?: ReactNode;
  testID?: string;
}) {
  const c = useV2Colors();

  return (
    <Pressable
      testID={testID}
      onPress={onSelect}
      accessibilityRole="radio"
      /*
        `selected`, NOT `checked`. `PillButton` (the kit's other radio) forks on
        exactly this: `checked` for `role="checkbox"`, `selected` for
        `role="radio"`. Written as `checked` first, and the rendered node came
        back carrying `role="radio"` with no state attribute at all — a radio
        that never says whether it is on. Read off the DOM, not guessed.
      */
      accessibilityState={{ selected }}
      /*
        AND the modern spelling, because the two reach different platforms.
        `react-native-web@0.21`'s `createDOMProps` reads `aria-selected` and
        never looks at `accessibilityState` (see its `_excluded` list), so on
        web the line above alone renders `role="radio"` with no state — checked
        by dumping the node's attributes, which came back with `aria-label` and
        `role` and nothing else. Native reads `accessibilityState`. Emitting
        both is the only way the radio announces itself on both.
      */
      aria-selected={selected}
      /*
        ONE spoken node for the whole card. `Chip` hides its own descendants
        (Chip.tsx:49-50), so the count would otherwise never be read, and the
        description is the half that makes the choice meaningful.
      */
      accessibilityLabel={[title, countLabel, description].filter(Boolean).join('. ')}
      style={[
        styles.card,
        {
          backgroundColor: selected ? c.accentWash : c.surface,
          /*
            2pt in BOTH states, never 0 → 2 on selection. A border that appears
            on select reflows the card by 4pt, and with two of them stacked the
            unselected one visibly jumps as the selection moves.
          */
          borderColor: selected ? c.accent : c.hairline,
        },
      ]}
    >
      {/* The ramp, so a selected card is lit like every other raised surface
          in the kit rather than being a flat block of accentWash. */}
      <MaterialFill role={selected ? 'accentWash' : 'surface'} radius={radius.lg} />

      <View style={styles.head}>
        {/*
          flat: a 22pt ring. Below the size at which a gradient reads as
          anything but a smudge (Row.tsx:248).
        */}
        <View
          style={[styles.ring, { borderColor: selected ? c.accent : c.hairlineStrong }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* flat: a 10pt dot. */}
          {selected ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            {/* `minWidth: 0` via flex — a long translated title must wrap
                rather than shove the count chip off the row. */}
            <View style={styles.titleText}>
              <Text variant="rowTitle" color="ink">
                {title}
              </Text>
            </View>
            {countLabel ? <Chip label={countLabel} tone={selected ? 'accent' : 'neutral'} /> : null}
          </View>
          <Text variant="caption" color="inkMuted" style={styles.description}>
            {description}
          </Text>
        </View>
      </View>

      {preview ? <View style={styles.preview}>{preview}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: CARD_PAD,
    // The gradient is absolutely filled and clipped to the radius.
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  ring: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Optically centres the ring against the first line of the title.
    marginTop: 2,
  },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  copy: { flex: 1, gap: space.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  titleText: { flex: 1 },
  description: {},
  // Breaks the gutter so the strip runs to the card's edge — see
  // `GroupCoverStrip` for why the bleed is worth the negative margin.
  preview: { marginTop: space.sm, marginHorizontal: -CARD_PAD, marginBottom: -CARD_PAD },
});
