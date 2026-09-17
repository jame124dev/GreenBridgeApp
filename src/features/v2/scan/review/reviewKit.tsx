/**
 * Chrome shared by the four Review steps.
 *
 * This is the review flow's OWN module, not a staging area. It was one: five
 * components were reported here as kit gaps by the screens that needed them.
 * Three of those turned out to be general and have moved into
 * `src/features/v2/ui/` — `PillButton`, `Stepper`, `SoftPanel`. Import those
 * from the kit.
 *
 * What is left is the two pieces that are genuinely specific to this wizard
 * and would be wrong as kit primitives, because both know about `ReviewStep`:
 *
 *   StepHeader   the header sheet all four steps share — back, title, draft
 *                state, `STEP n OF 4 · NAME`, percent, the 3pt track.
 *                Pass `progress={false}` on a cold open: with it on, the screen
 *                claimed "75%" above "there is no item to review".
 *   Eyebrow      the tracked section label row, with the AI chip and an
 *                optional right-hand control (`LABEL [AI] ······ Use my location`)
 *
 * `Eyebrow` DID fold into `SectionHeader` (2026-09-03) — the layout lives
 * there now and `Eyebrow` is a four-line wrapper that keeps the `ai` prop.
 * text link and this one takes an arbitrary control.
 *
 * Nothing here invents a value: every measure is a token, and the shapes are
 * `docs/v2-design/screens/7b.html`–`7e.html` as drawn.
 */
import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { GlyphButton, ProgressLine, SectionHeader, Text } from '@/features/v2/ui';
import {
  icon,
  space,
  useV2Colors,
} from '@/theme/v2';

import { REVIEW_STEP_TOTAL, type ReviewStep, reviewStepIndex, reviewStepLabel } from './wizardState';


// ── StepHeader ─────────────────────────────────────────────────────────────

/**
 * The green sheet at the top of every Review step.
 *
 *     [←]  Review your item                          Draft · 2 of 3
 *     STEP 3 OF 4 · PRICING                                     75%
 *     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
 *
 * Goes in `Screen`'s `header` prop — `Screen` owns the wash, the 34pt curve and
 * the notch inset, so this is only the content.
 *
 * `ProgressLine on="wash"` is not cosmetic: the default track is `fill`, a
 * ~1.02:1 step against the wash, i.e. invisible. Same reason the four-step
 * `Timeline` rail can never live in this sheet — its connector is `fill` too.
 *
 * The drawing says "Draft" flat. It was drawn for one item; smart-detect
 * routinely produces three, and then nothing on screen says which one you are
 * editing. So the word carries the position when — and only when — there is
 * more than one.
 */
export function StepHeader({
  step,
  itemIndex,
  itemTotal,
  onBack,
  progress = true,
}: {
  step: ReviewStep;
  /** Zero-based position in the queue; `-1` for the single-product draft. */
  itemIndex: number;
  itemTotal: number;
  onBack: () => void;
  /**
   * Show the step counter, the percentage and the bar.
   *
   * ⚠️ PASS `false` WHEN THERE IS NO ITEM. With it on, a cold-open review
   * screen read "STEP 3 OF 4 · PRICING — 75%" with a three-quarters-filled
   * bar directly above "There is no item to review right now." The screen was
   * claiming real progress through a flow the person is not in. Caught on a
   * device; no test would have.
   */
  progress?: boolean;
}) {
  const c = useV2Colors();
  const stepNumber = reviewStepIndex(step) + 1;
  const percent = Math.round((stepNumber / REVIEW_STEP_TOTAL) * 100);
  const draftLabel =
    itemTotal > 1 ? `Draft · ${itemIndex + 1} of ${itemTotal}` : 'Draft';

  return (
    <>
      <View style={styles.titleRow}>
        {/*
          `GlyphButton` is named for where it was first needed (inside a `Field`)
          but it is exactly this shape — a bare tappable glyph, press feedback
          from `usePressFeedback`, the 44pt target made up with `hitSlop`. Worth
          a rename in the kit; not worth a fifth hand-rolled icon button.
        */}
        <GlyphButton accessibilityLabel="Back" onPress={onBack}>
          <ArrowLeft size={icon['2xl']} color={c.ink} strokeWidth={1.8} />
        </GlyphButton>

        <Text variant="h2" style={styles.title} numberOfLines={1}>
          Review your item
        </Text>

        {/*
          Only when there IS a draft. On a cold open the header was still
          labelling the screen "Draft" beside "Nothing to review yet" — the
          same class of mistake as the progress bar below, one word smaller.
        */}
        {progress ? (
          <Text variant="captionMedium" color="inkMuted">
            {draftLabel}
          </Text>
        ) : null}
      </View>

      {progress ? (
        <>
          <View style={styles.progressMeta}>
            <Text variant="eyebrow" color="inkMuted">
              {`Step ${stepNumber} of ${REVIEW_STEP_TOTAL} · ${reviewStepLabel(step)}`}
            </Text>
            <Text variant="captionMedium" color="inkMuted">{`${percent}%`}</Text>
          </View>

          <ProgressLine
            value={stepNumber}
            total={REVIEW_STEP_TOTAL}
            on="wash"
            label={`Review progress, step ${stepNumber} of ${REVIEW_STEP_TOTAL}`}
          />
        </>
      ) : null}
    </>
  );
}

// ── Eyebrow ────────────────────────────────────────────────────────────────

/**
 * A section label. The design's grouping device: this tracked 10pt line plus
 * the whitespace above it, with no box.
 *
 * `ai` marks a value the model filled in — 7b–7e put the chip only where
 * something was guessed, never on a field the person owns (currency, price
 * format, installation), which is the canvas's own rule for it.
 *
 * link; here it holds a chip and a control.
 */
/**
 * A field label above an input, with an optional "AI" badge.
 *
 * ── WHY THIS IS NOW FOUR LINES ──
 *
 * It used to draw its own row: flex, gap, a `Chip`, a `marginLeft:auto`
 * trailing slot. `SectionHeader` drew the same row, differing only in the
 * title's colour — two implementations of one layout, which is how they drift.
 * The layout now lives in `SectionHeader` and this keeps the ergonomics the
 * nine call sites want: `ai={aiFilled.brand}` rather than
 * `chip={aiFilled.brand ? 'AI' : undefined}` spelled out nine times.
 */
export function Eyebrow({
  label,
  ai = false,
  trailing,
}: {
  label: string;
  ai?: boolean;
  /** Right-aligned control — "Use my location", a character count. */
  trailing?: ReactNode;
}) {
  return (
    <SectionHeader
      title={label}
      tone="muted"
      gutter={false}
      chip={ai ? 'AI' : undefined}
      chipTone="accent"
      trailing={trailing}
    />
  );
}

// ── PillButton ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // StepHeader
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3xl'],
    marginBottom: space['5xl'],
  },
  title: { flex: 1, minWidth: 0 },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },

  // Eyebrow




  disabled: { opacity: 0.45 },
});
