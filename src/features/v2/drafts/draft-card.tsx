/**
 * Draft card — adapted from the `seller-bid-card.tsx` lineage.
 *
 * Left thumbnail (with +N multi-item badge for bulk scans), top row with
 * draft flow label ('AI Draft' / 'Manual Draft') and age chip (or resuming
 * spinner), two-line title, and bottom stats line.
 *
 * Uses `MaterialFill` for surface depth and `usePressFeedback` for tactile
 * spring press animation.
 */
import React, { useState } from 'react';
// `Pressable` from REACT-NATIVE, not gesture-handler — the RNGH one does not
// apply this card's `borderRadius` + `overflow: 'hidden'` to its native view on
// Android, so the card drew square around a rounded ground. Measured on device
// 2026-09-25; see the full note in `features/v2/ui/ListCard.tsx`.
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Trash2 } from 'lucide-react-native';

import { Chip, MaterialFill, Text } from '@/features/v2/ui';
import { icon, press, radius, space, usePressFeedback, useV2Colors } from '@/theme/v2';
import { compactAgo, draftTitle, photoUri, plural } from '@/features/v2/listings/presentation';
import type { DraftSummary } from '@/services/drafts/draftApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DraftCard({
  draft,
  isResuming,
  onPress,
  statusLabel,
  onDiscard,
  discardLabel,
  onSubmit,
  submitLabel,
  isSubmitting,
  needs,
}: {
  draft: DraftSummary;
  isResuming?: boolean;
  /**
   * Omitted → the card is read-only. A Listed or Discarded draft must not
   * resume: re-opening a published draft and submitting it again lists the
   * same equipment twice (`usePublishDraft.ts`, "RETIRE THE SERVER DRAFT").
   */
  onPress?: () => void;
  /** Replaces "Tap to resume" on a read-only card, e.g. "Listed". */
  statusLabel?: string;
  /**
   * Omitted → no discard affordance. Passed ONLY on the active tab: a
   * discarded draft is already a soft delete, and discarding a listed one
   * would hide a row whose equipment is live on the marketplace.
   *
   * It is the caller's job to confirm before writing — this only reports the
   * press. `app/v2/drafts.tsx` puts the kit's `ConfirmSheet` behind it.
   */
  onDiscard?: () => void;
  /** Required with `onDiscard` — an icon-only button has no visible text. */
  discardLabel?: string;
  /**
   * Omitted → no submit affordance. The screen passes this only on the active
   * tab AND only when the seller may publish at all, so an unapproved account
   * is never shown a control that would bounce it.
   *
   * It is LABELLED, unlike discard: submitting is the consequential act on
   * this row, and an icon alone would not say what it does.
   */
  onSubmit?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  /**
   * What this draft still needs, e.g. "Needs a photo". Replaces the third
   * line's "Tap to resume" when present. Omitted when the draft is ready, or
   * while readiness is still being worked out — an empty line is better than
   * one that says "ready" and then refuses.
   */
  needs?: string;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback();
  const [failed, setFailed] = useState(false);
  const [discardPressed, setDiscardPressed] = useState(false);
  const [submitPressed, setSubmitPressed] = useState(false);

  const cover = photoUri(draft.thumbnail_object);
  const showImage = Boolean(cover) && !failed;
  const count = Number(draft.product_count) || 0;
  const extra = Math.max(0, count - 1);

  const ago = compactAgo(draft.updated_at);
  const title = draftTitle(draft);
  const modeLabel = draft.flow === 'ai' ? 'AI Draft' : 'Manual Draft';
  /*
   * The third line answers "what happens if I press this?".
   *
   * `needs` wins over "Tap to resume" when the draft is short of the publish
   * bar: a seller scanning the list wants to know WHICH item is holding them
   * up without opening each one. It is the same sentence the publish would
   * have shown after refusing — said before the press instead of after.
   */
  const tail = needs ?? (onPress ? 'Tap to resume' : (statusLabel ?? ''));
  const stats = count > 1 ? `${plural(count, 'item', 'items')}  ·  ${tail}` : tail;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isResuming || !onPress}
      accessibilityRole="button"
      accessibilityLabel={ago ? `${title}. ${modeLabel}. ${ago}` : `${title}. ${modeLabel}`}
      style={[styles.card, { borderColor: c.hairlineStrong }, animatedStyle]}
      testID={`v2-drafts-${draft.id}`}
    >
      <View style={[styles.ground, { backgroundColor: c.surface }]}>
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      <View>
        <View style={styles.thumbClip}>
          {showImage ? (
            <Image
              style={styles.thumb}
              resizeMode="cover"
              source={{ uri: cover as string }}
              onError={() => setFailed(true)}
            />
          ) : (
            // flat: a placeholder where a photograph would be, not a control.
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: c.fill }]}>
              <Text variant="micro" color="inkSubtle">
                No photo
              </Text>
            </View>
          )}
        </View>
        {extra > 0 ? (
          // flat: a count badge, 20pt — too small to carry a ramp.
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Text variant="micro" color="onAccent">
              +{extra}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text variant="caption" color="inkSubtle" style={styles.ref} numberOfLines={1}>
            {modeLabel}
          </Text>
          {isResuming ? (
            <ActivityIndicator size="small" color={c.accent} />
          ) : ago ? (
            <Chip label={ago} tone="accent" />
          ) : null}
          {/*
            NOT the kit's `IconAction`: its own docblock scopes it to a 46pt
            accent circle beside a display heading, and one of those per row
            would out-weigh the row's own title. This is the compact row-trash
            already used by `features/scanner/components/drafts/DraftCard.tsx`
            (`Trash2`, size 20, `hitSlop`), moved onto v2 tokens.

            `hitSlop` is what carries the 44pt target — the glyph itself is
            20pt, so without it this fails FORM_INPUT_RULES' minimum.
          */}
          {onDiscard && !isResuming ? (
            <Pressable
              onPress={onDiscard}
              hitSlop={space.lg}
              onPressIn={() => setDiscardPressed(true)}
              onPressOut={() => setDiscardPressed(false)}
              accessibilityRole="button"
              accessibilityLabel={discardLabel}
              testID={`v2-drafts-discard-${draft.id}`}
              /*
                ⚠️ ARRAY OF OBJECTS — never the callback form of `style`.
                NativeWind's interop takes over the inline `style` prop on RN
                primitives and spreads it — spreading a function yields `{}`,
                so the whole style is silently dropped at runtime while jest,
                where the interop is never registered, renders it perfectly.
                See memory `reference-nativewind-drops-function-styles`.
              */
              style={[styles.discard, discardPressed && styles.discardPressed]}
            >
              <Trash2 size={icon.md} color={c.inkSubtle} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>

        <Text variant="rowTitle" numberOfLines={2} style={styles.title}>
          {title}
        </Text>

        <View style={styles.footRow}>
          <Text variant="caption" color="inkSubtle" numberOfLines={1} style={styles.stats}>
            {stats}
          </Text>
          {/*
            A nested Pressable inside the card's own Pressable. The inner one
            wins the responder, so pressing Submit does not also resume — but
            it must NOT be the RNGH Pressable here: this card deliberately uses
            RN's, and mixing the two inside one row gives the gesture-handler
            child priority over the RN parent in a way that swallows the card
            tap on Android.
          */}
          {onSubmit ? (
            <Pressable
              onPress={onSubmit}
              disabled={isSubmitting}
              hitSlop={space.sm}
              onPressIn={() => setSubmitPressed(true)}
              onPressOut={() => setSubmitPressed(false)}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
              accessibilityState={{ disabled: !!isSubmitting, busy: !!isSubmitting }}
              testID={`v2-drafts-submit-${draft.id}`}
              // Array of objects — never the callback form. See the note on the
              // discard control above.
              style={[
                styles.submit,
                { borderColor: c.accent },
                submitPressed && styles.submitPressed,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Text variant="micro" style={{ color: c.accent }} numberOfLines={1}>
                  {submitLabel}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: space.lg,
  },
  ground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /*
    The radii live on a wrapper `View`, not on the `<Image>`: Android drops
    per-corner radii on an Image (measured 2026-09-25 — a uniform `borderRadius`
    rounded all four corners while the per-corner pair rounded none). A View
    clips its children, so they work here. See `ListCard.tsx` for the test.
  */
  thumbClip: {
    width: space['8xl'] * 3,
    height: space['8xl'] * 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    minWidth: space['3xl'],
    height: space['3xl'],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  body: { flex: 1, minWidth: 0, padding: space.xl, gap: space.xxs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ref: { flex: 1, minWidth: 0 },
  discard: { padding: space.xxs },
  discardPressed: { opacity: press.opacity },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flex: 1, minWidth: 0 },
  /**
   * Outlined, not filled. `PrimaryAction` is the one green pill a screen is
   * allowed, and a list of these would put N of them on one screen — so this
   * reads as the row's action without competing with the screen's.
   */
  submit: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    flexShrink: 0,
  },
  submitPressed: { opacity: press.opacity },
  title: { minWidth: 0, marginBottom: space.xs },
});
