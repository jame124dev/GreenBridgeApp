/**
 * `AuthShell` — the wash-hero frame shared by sign in, sign up and recovery.
 *
 * This is the "V2 Wash Hero" direction, chosen 2026-09-23 from five Stitch
 * explorations (see `Docs/V2_CHECKLIST.md`). Three parts:
 *
 *   1. A wash panel that bleeds to the top of the phone, holding the brand
 *      bar and the title block. It is `Screen`'s own header sheet, run
 *      `headerFlush` so it has no bottom curve of its own.
 *   2. A `base`-coloured sheet whose curved top edge cuts up into that wash.
 *      The sheet is the same colour as the page, so the only thing that reads
 *      is the curve biting into the green.
 *   3. One sticky primary action in `Screen`'s footer, which measures itself
 *      and rides the keyboard.
 *
 * ── WHY THE CURVE IS IN THE HEADER AND NOT A NEGATIVE MARGIN ──
 *
 * The obvious build is a sheet inside the scroll body with
 * `marginTop: -space['6xl']`, overlapping the header above it. On iOS that
 * works. **On Android a `ScrollView` clips its children to its bounds**, so
 * the 26pt that makes the effect is exactly the 26pt that gets cut — the
 * curve lands flush against the wash and the whole device disappears, on one
 * platform, with nothing thrown and every test green.
 *
 * So the sheet's top edge — the curve, and the segmented control sitting in
 * it — is the LAST thing in the fixed header, bled back out to full width
 * with `marginHorizontal: -GUTTER`. The scrolling body then continues on the
 * page ground, which is the same colour, and the seam is invisible. This also
 * matches the drawing, where the segment is `flex-shrink-0` above the
 * scrolling region rather than part of it: it must not scroll away, because
 * it is how you get to the other form.
 *
 * ── WHY THE TITLE LIVES OUT HERE AND NOT IN THE SCREEN ──
 *
 * Because the title is state, and the design changes it per step: "Welcome
 * back" / "Create your account" / "Check your email", and on the final step
 * the title block is REMOVED entirely so the outcome has the screen to
 * itself. A shell that always drew a title would force each step to invent a
 * heading it does not want, which is how a wizard ends up claiming progress
 * through a flow the person is not in.
 *
 * ── WHY THE SEGMENTED CONTROL IS HERE AND NOT IN EACH SCREEN ──
 *
 * Sign in and sign up are two routes (`AuthGuard` routes to `/(auth)/login`
 * globally, so they cannot collapse into one). The control has to be
 * byte-identical on both or it will visibly jump when it switches them, so it
 * is declared once — the same reasoning as `HOME_MODE_TABS` in `Tabs`.
 *
 * It is also the ONLY route between the two forms now. The old screens each
 * carried a text link at the bottom ("Don't have an account? Create account",
 * "Already have an account? Sign in"); with the segment above the fields
 * those are a second control doing the same job two thumb-lengths apart,
 * which is the duplicate-control item of `UX_DESIGN_RULES.md`.
 */
import React, { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useTranslation } from 'react-i18next';

import { languageBadge } from '@/i18n';
import { LanguageSheet } from '@/components/ui';
import {
  BrandBar,
  Screen,
  SegmentedControl,
  Text,
  type SegmentItem,
} from '@/features/v2/ui';
import { GUTTER, radius, space, useV2Colors } from '@/theme/v2';

export type AuthMode = 'signin' | 'signup';

/** Declared once so the control cannot drift between the two routes it switches. */
const SEGMENT_ORDER: readonly AuthMode[] = ['signin', 'signup'];

export function AuthShell({
  mode,
  title,
  subtitle,
  eyebrow,
  segmented = true,
  email,
  leading,
  footer,
  footerQuiet,
  children,
  testID,
}: {
  /** Which segment reads as selected. Also decides where a switch navigates. */
  mode: AuthMode;
  /** Omit BOTH title and subtitle to drop the title block — see the header note. */
  title?: string;
  subtitle?: string;
  /** Tracked line over the title. The brand line on the first step of each form. */
  eyebrow?: string;
  /** Hide the segment on a step that is mid-flow (the code step, the outcome). */
  segmented?: boolean;
  /** Carried across the switch so a typed address survives changing your mind. */
  email?: string;
  /** Between the brand bar and the title — a back chevron, a progress rail. */
  leading?: ReactNode;
  /** The one primary action. Sticky, keyboard-aware, measured by `Screen`. */
  footer?: ReactNode;
  /**
   * The quiet way out under the primary action — "Do later", "Back to sign
   * in". **Dropped while the keyboard is open**, and that is not decoration.
   *
   * The footer rides up with the keyboard and stands between it and the form,
   * so every row in it is taken from the part of the sheet you are typing in.
   * Measured on sign-up: the second row costs ~126px, and without it the
   * first field's own label no longer has to scroll away to make room. An
   * escape hatch is for someone who has stopped typing; it comes back the
   * moment the keyboard does.
   */
  footerQuiet?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const { t, i18n } = useTranslation();
  const c = useV2Colors();
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  /**
   * ⚠️ THE HERO COLLAPSES WHEN THE KEYBOARD OPENS, AND IT HAS TO.
   *
   * Measured on this screen before the collapse existed: the scroll window is
   * 1006px with the keyboard closed and about 284px (~111dp) with it open,
   * while this header kept 625px either way. A field row is ~93px plus its
   * label, so the person filling the form could see one and a half fields —
   * the focused one clipped at the top with its label scrolled off, and the
   * next one sliced by the footer. Sign-up shipped that way and the user sent
   * a screenshot of it.
   *
   * Every gate was green, including the documented footer-collision test
   * (`FORM_INPUT_RULES.md` § 4), which asks whether the footer covers the
   * FOCUSED FIELD — it did not, by 242px. That test passes on an unusable
   * form; the question that matters is how much of the form you can see.
   *
   * So the eyebrow and the subtitle go while typing. They are orientation, and
   * orientation is what you need BEFORE you start, not while your thumbs are
   * busy. The brand bar, the title and the segment stay: the title is what the
   * screen IS, and the segment is the only route to the other form.
   *
   * No animation on purpose — the keyboard is already animating in over the
   * same frames, and a second easing curve on top of it reads as a lurch.
   */
  const keyboardOpen = useKeyboardState((s) => s.isVisible);

  // Labels resolved at render: `t` is not available at module scope, and a
  // cached English label would survive a language change.
  const items: readonly SegmentItem<AuthMode>[] = SEGMENT_ORDER.map((value) => ({
    value,
    label:
      value === 'signin'
        ? t('mobile.auth.signIn')
        : t('mobile.auth.createAccount', { defaultValue: 'Create account' }),
  }));

  const switchTo = (next: AuthMode) => {
    if (next === mode) return;
    // `replace`, not `push`: these are two faces of one decision, so backing
    // out of sign-up should leave auth entirely rather than walk back through
    // sign-in. The email rides along so retyping is never the price of
    // changing your mind.
    const trimmed = email?.trim();
    router.replace({
      pathname: next === 'signin' ? '/(auth)/login' : '/(auth)/register',
      params: trimmed ? { email: trimmed } : {},
    });
  };

  const header = (
    <View>
      {/*
        No bell: nobody is signed in, and its only destination is the old UI's
        notifications screen — arriving at sign-in would be an exit out of v2.
      */}
      <BrandBar
        language={languageBadge(i18n.language)}
        notifications={false}
        onLanguage={() => setLangSheetOpen(true)}
      />

      {leading}

      {title || subtitle ? (
        <View style={[styles.titles, keyboardOpen && styles.titlesTyping]}>
          {eyebrow && !keyboardOpen ? (
            <Text variant="eyebrow" color="accentInk" style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            // One line while typing: "Create your account" is short, but a
            // translated title is not guaranteed to be, and a 3-line display
            // would give back the space the collapse just won.
            <Text variant="display" numberOfLines={keyboardOpen ? 1 : undefined}>
              {title}
            </Text>
          ) : null}
          {subtitle && !keyboardOpen ? (
            <Text variant="lead" color="inkMuted" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* The sheet's top edge — see the header note on why it lives up here.
          Its top padding shrinks with the hero: with the keyboard up, 22pt of
          air above the segment is 22pt not spent on a field. */}
      {/* It is the same `base` the body below sits on, and the seam between
          the two has to be invisible: a ramp would light one half of a
          continuous surface and draw the join it exists to hide. `Screen.tsx`
          is exempt for the same reason. */}
      {/* flat: page ground, not a control. */}
      <View style={[styles.cap, keyboardOpen && styles.capTyping, { backgroundColor: c.base }]}>
        {segmented ? (
          <SegmentedControl
            items={items}
            value={mode}
            onChange={switchTo}
            testID="v2-auth-segment"
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen
      header={header}
      headerFlush
      keyboard
      tabBar={false}
      footer={
        footer || footerQuiet ? (
          <View style={styles.footerStack}>
            {footer}
            {keyboardOpen ? null : footerQuiet}
          </View>
        ) : undefined
      }
      contentStyle={styles.content}
      testID={testID}
    >
      {children}
      <LanguageSheet visible={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** The title block sits below the brand bar, above the sheet's curve. */
  titles: { marginTop: space['3xl'] },
  /** Tight against the brand bar once the eyebrow and subtitle have gone. */
  titlesTyping: { marginTop: space.md },
  eyebrow: { marginBottom: space.sm },
  subtitle: { marginTop: space.md },
  /**
   * The white sheet's curved top, inside the header and bled back to full
   * width. Its bottom edge IS the header's bottom edge, so the scrolling body
   * below continues the same colour with no seam.
   */
  cap: {
    marginTop: space['8xl'],
    marginHorizontal: -GUTTER,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: GUTTER,
    paddingTop: space['5xl'],
    paddingBottom: space.md,
  },
  capTyping: { marginTop: space['5xl'], paddingTop: space['3xl'] },
  /** Pill, then the quiet way out. The gap goes with the row it separates. */
  footerStack: { gap: space['2xl'] },
  /** The body is inside the sheet, so it carries the sheet's gutter. */
  content: { paddingHorizontal: GUTTER, paddingTop: space['3xl'] },
});
