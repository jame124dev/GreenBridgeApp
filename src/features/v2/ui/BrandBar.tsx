/**
 * `BrandBar` — the app chrome at the top of every tab screen.
 *
 *     [G] GREENBIDZ                            EN   🔔•
 *
 * Present on all six turn-6 screens. Three screens were built in parallel and
 * all three independently rebuilt this bar; that is precisely the drift this
 * kit exists to stop, so it lives here now and nowhere else.
 *
 * It always sits on the header wash, so the unread dot's ring is `wash` — the
 * ring is what makes a 7pt dot read as a separate mark instead of a smudge on
 * the bell glyph.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Bell } from 'lucide-react-native';

import { getBranding } from '@/theme/branding';

import {
  MIN_TOUCH,
  badgeDot,
  control,
  icon,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
  useV2Theme,
} from '@/theme/v2';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function BrandBar({
  language = 'EN',
  unread = false,
  onNotifications,
  onLanguage,
}: {
  /** Display label only — the real switch lives on Account › Language. */
  language?: string;
  /**
   * `true` for "there is something", or a count. Pass the count where you have
   * one — "Notifications, 3 unread" is worth more to a screen-reader user than
   * "Notifications, unread", and the dot looks the same either way.
   */
  unread?: boolean | number;
  onNotifications?: () => void;
  onLanguage?: () => void;
}) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  // One per control: `usePressFeedback` owns a shared value, so two controls
  // cannot share one instance without pressing together.
  const lang = usePressFeedback({ scale: false });
  const bell = usePressFeedback({ scale: false });
  const count = typeof unread === 'number' ? unread : 0;
  const hasUnread = unread === true || count > 0;

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {/*
          The REAL brand lockup, from `theme/branding.ts` — the same asset the
          old UI's login screen and lab header render, so v2 and the shipped app
          show one company rather than two.

          It replaces a green `accent` square holding the letter "G" plus a
          separate "GreenBidz" wordmark. That is what `6a.html` draws, and it was
          a faithful port — but the canvas was mocking a logo it did not have,
          and the app has had the artwork all along.

          `getBranding()` is site-aware (`SITE_TYPE`), so the 101it / 101machine
          builds get their own mark here for free instead of a hardcoded G.
        */}
        <Image
          source={getBranding().logo}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel={getBranding().logoLabel}
          /*
            ⚠️ DARK GETS A REVERSED (monochrome) LOCKUP, AND IT IS NOT A CHOICE.
            The artwork is a fixed-colour PNG in the OLD brand: navy #001951
            wordmark + teal #00C0A1 nodes. Measured on device against the dark
            header wash #0B2A1E, the navy reads **1.08:1** — the wordmark simply
            is not there, and only the teal dots survive at 6.64:1. WCAG 1.4.11
            wants 3:1 for a meaningful graphic.

            `tintColor` flattens the whole mark to one colour, which is the
            standard reversed treatment and legible at `ink` (#EDF6F1 in dark).
            It costs the teal.

            The RIGHT fix is a proper reversed asset from design — there is no
            light variant in `assets/` or in the canvas `uploads/`, so this holds
            the line until one exists. Light mode is untouched and uses the full
            colour lockup.
          */
          tintColor={scheme === 'dark' ? c.ink : undefined}
        />
      </View>

      <View style={styles.right}>
        {onLanguage ? (
          // Press feedback per Docs/UIUXRuleSet/responsiveness.md R4. `scale:
          // false` — these sit in the header's fixed 44pt boxes, and shrinking
          // a box that small reads as a wobble; the opacity dip carries it.
          <AnimatedPressable
            onPress={onLanguage}
            onPressIn={lang.onPressIn}
            onPressOut={lang.onPressOut}
            accessibilityRole="button"
            accessibilityLabel={`Language, ${language}`}
            style={[styles.tapBox, lang.animatedStyle]}
          >
            <Text variant="captionMedium" color="inkMuted">
              {language}
            </Text>
          </AnimatedPressable>
        ) : (
          <Text variant="captionMedium" color="inkMuted">
            {language}
          </Text>
        )}

        <AnimatedPressable
          onPress={onNotifications}
          onPressIn={bell.onPressIn}
          onPressOut={bell.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={
            count > 0
              ? `Notifications, ${count} unread`
              : hasUnread
                ? 'Notifications, unread'
                : 'Notifications'
          }
          style={[styles.bell, bell.animatedStyle]}
        >
          <Bell size={icon.xl} color={c.ink} strokeWidth={1.75} />
          {hasUnread ? (
            <View
              style={[
                styles.dot,
                { backgroundColor: c.accent, borderColor: c.wash },
              ]}
            />
          ) : null}
        </AnimatedPressable>
      </View>
    </View>
  );
}

// (The old `HIT` hitSlop was removed — both controls now carry a real 44pt box.
//  See the note on `tapBox` below for why slop was the wrong tool here.)

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space['7xl'],
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  /**
   * `gap` is small because each control now carries its OWN 44pt box (see
   * `tapBox`). The visual separation a reader sees is the gap PLUS the padding
   * inside both boxes, so `4xl` (18) here read as ~44dp of air once the boxes
   * were real.
   */
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },

  /**
   * A real 44 × 44 touch target, not `hitSlop`.
   *
   * ⚠️ WHY NOT hitSlop. Measured on device 2026-09-17: the language chip's node
   * is 14.9 × 17.3dp and the bell's is 20 × 20dp, sitting **18dp apart**. With
   * the previous `hitSlop` of 12 on every side, the language chip's hit area
   * ended at 373.6dp and the bell's began at 367.6dp — they **overlapped by
   * 6dp**, so a tap in that band was ambiguous, and the chip still only reached
   * 38.9 × 41.3dp, under the 44 minimum on both axes. Increasing the slop makes
   * the overlap worse, which is the trap: hitSlop is invisible, so two targets
   * can collide without anything looking wrong.
   *
   * A real box cannot overlap its neighbour — the layout keeps them apart.
   * See `Docs/UIUXRuleSet/touch-targets.md` R1 and R4.
   */
  tapBox: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The brand lockup. Height is the `chipSm` step (26) — the same measure the
   * old "G" square occupied, so the bar's rhythm does not move. Width is that
   * height times the artwork's own aspect ratio (1920 × 684 = 2.807), not a
   * scale step: squashing a logo to land on a spacing token is how a brand mark
   * gets distorted. `contain` guarantees it, whatever the site's asset measures.
   */
  logo: {
    height: control.chipSm,
    width: Math.round(control.chipSm * 2.807),
  },
  bell: {
    position: 'relative',
    // Same 44pt box as the language chip — see `tapBox`.
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: badgeDot.size,
    height: badgeDot.size,
    borderRadius: radius.pill,
    borderWidth: badgeDot.ring,
  },
});
