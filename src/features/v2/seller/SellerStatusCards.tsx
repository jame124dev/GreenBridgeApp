/**
 * What a seller is told while their account is waiting — the app's answer to
 * the web's two banners.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 *
 * Signed into the WEB on 2026-10-06, the same account was shown "Seller
 * account pending approval" with what unlocks and when, plus "Verify your
 * email" with a Resend button. The app showed it nothing: identical to an
 * approved seller, with the block discovered only on pressing publish, after
 * photographing equipment and waiting on the AI. This is the fix for that.
 *
 * ── WHY ONE ROW AND NOT A CARD PER FACT ────────────────────────────────────
 *
 * The first build stacked up to three amber cards here. It worked and was
 * device-verified, and it was wrong: the notice out-shouted "Scan it", and the
 * stack pushed the seller's own drafts off the screen. These are STATUS, not a
 * flow to complete, so they get banner weight — one quiet row with a progress
 * ring and one caption — and the detail lives on `/v2/account-status`, which
 * is the only place amber appears. See `Docs/v2/authv2/_refs/README.md`.
 *
 * ── WHY NOT A BLOCKING SCREEN ──────────────────────────────────────────────
 *
 * ⚠️ This is a ROW ON THE SELLING SCREEN, never a gate, and that is not a
 * style choice. Routing pending users to a dedicated wall is exactly what made
 * a fresh install a dead end, and a sign-in wall in front of browsing is what
 * App Review rejected 1.0.3 (21) for on 2026-08-24 under Guideline 5.1.1(v).
 * See the two standing warnings in `app/_layout.tsx` and `app/index.tsx`.
 * A pending account is a WORKING account; it just cannot publish. Telling
 * someone that is a message, not a door.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, as `TintedRow` does: inside Home's pager
// RN's responder-based Pressable never receives the tap.
import { Pressable } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

import {
  CARD_PAD,
  GUTTER,
  ROW_SUBLINE_GAP,
  control,
  icon,
  press,
  radius,
  space,
  useV2Colors,
} from '@/theme/v2';
import { MaterialFill, QuietAction, Text } from '@/features/v2/ui';

// The hook stays in `features/seller` with the rest of the gate's data layer —
// it navigates nowhere, so it is not a v2 surface. Only this component is.
import { useSellerStatus } from '@/features/seller/useSellerStatus';
import { resendVerificationLink } from '@/services/auth/register';
import { useAuth } from '@/stores/authStore';

/**
 * ⚠️ `…onboarding.sellerStatus`, not `…auth.sellerStatus`.
 *
 * The keys sit inside the `onboarding` block beside `resume`, which is where
 * the rest of this lifecycle's copy lives. Getting this wrong renders the raw
 * key path on screen — and the i18n suite CANNOT catch it: `authCoverage`
 * checks that every key in `en` exists in the other five locales, which it
 * did. Nothing verifies that the component asks for the path the file uses.
 * Caught on a device 2026-10-06, with "mobile.auth.sellerStatus.pending.title"
 * printed inside the card.
 */
const T = 'mobile.auth.onboarding.sellerStatus.';

/** Ring stroke. Thin on purpose: the ring reports, it does not decorate. */
const RING_STROKE = 3;

/**
 * Static progress ring — geometry borrowed from `lab/components/RelevanceRing`
 * (track circle + dash-offset arc, 12 o'clock start, round cap). The draw-on
 * animation was left behind: this row is visible on every app open while the
 * account waits, and a ring that re-draws each time is ambient motion the v2
 * design does not allow. It also keeps Reanimated out of the pager — see the
 * note in `TintedRow`.
 */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const c = useV2Colors();
  const size = control.avatar;
  const center = size / 2;
  const r = center - RING_STROKE / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, done / total));

  return (
    <View style={styles.ring}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={c.accentWash}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={c.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.ringLabel}>
        <Text variant="micro" color="accentInk">
          {`${done}/${total}`}
        </Text>
      </View>
    </View>
  );
}

/**
 * "Resend email", exported so the status screen uses THIS and not a second
 * copy — two resend buttons that disagree about what happened is worse than
 * one that is occasionally wrong. It no longer appears on the home screen;
 * `app/v2/account-status.tsx` is its only mount.
 *
 * ⚠️ IT NEVER CLAIMS SUCCESS IT DOES NOT HAVE. The server answers 500 when the
 * mail fails to send (`services/auth/register.ts` has the detail), so an
 * optimistic "Sent!" would be a lie exactly when the person most needs the
 * truth — they are already waiting on an email that did not arrive. Only a 2xx
 * flips it to sent; anything else offers the tap again with the failure shown.
 *
 * After a success the control is SPENT, not re-armed on a timer: a second send
 * produces a second link and the first one keeps working, which is a confusing
 * inbox. "Check your inbox" is the honest end state.
 */
export function ResendEmailAction() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const email = useAuth((s) => s.profile?.email);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!email) return null;

  if (phase === 'sent') {
    return (
      <Text
        variant="caption"
        style={{ color: c.cautionInk }}
        accessibilityLiveRegion="polite"
      >
        {t(`${T}verify.sent`)}
      </Text>
    );
  }

  return (
    <View style={styles.resend}>
      <QuietAction
        label={t(phase === 'sending' ? `${T}verify.sending` : `${T}verify.resend`)}
        align="start"
        onPress={() => {
          if (phase === 'sending') return;
          setPhase('sending');
          void resendVerificationLink(email)
            .then(() => setPhase('sent'))
            .catch(() => setPhase('error'));
        }}
      />
      {phase === 'error' && (
        <Text
          variant="caption"
          style={{ color: c.danger }}
          accessibilityLiveRegion="assertive"
        >
          {t(`${T}verify.failed`)}
        </Text>
      )}
    </View>
  );
}

/**
 * The single status row. Name kept from the card-stack build so the mount in
 * `SellingPane` does not change.
 */
export function SellerStatusCards() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const s = useSellerStatus();
  // Plain state, not `usePressFeedback`, for the reason given in `TintedRow`.
  const [pressed, setPressed] = useState(false);

  // Guests and fully-settled sellers get nothing at all. A row that says
  // "everything is fine" is noise on every single app open.
  if (!s.signedIn || s.loading) return null;
  if (!s.awaitingApproval && s.emailVerified && !s.onboardingIncomplete) return null;

  /*
   * Four steps, read LIVE from the hook on every render — so the row counts
   * up, and finally withdraws, the moment the server reports a step resolved.
   * The account itself is always done once signed in.
   */
  const total = 4;
  const done =
    1 +
    (s.emailVerified ? 1 : 0) +
    (s.onboardingIncomplete ? 0 : 1) +
    (s.awaitingApproval ? 0 : 1);

  /*
   * One caption for everything. Approval leads because it is the thing they
   * cannot act on; the count is the things they CAN — confirm the email,
   * finish the profile — and both are done on the status screen.
   */
  const needsYou = (s.emailVerified ? 0 : 1) + (s.onboardingIncomplete ? 1 : 0);
  const caption = [
    s.awaitingApproval ? t(`${T}summary.waiting`) : null,
    needsYou > 0 ? t(`${T}summary.needsYou`, { count: needsYou }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /*
   * The title has to match what is actually outstanding. When the only thing
   * left is OUR review, "Finish setting up your account" asks the seller to do
   * something they cannot do — there is nothing left for them to finish.
   */
  const title = t(needsYou > 0 ? `${T}summary.title` : `${T}summary.titleWaiting`);
  const progress = t(`${T}summary.progress`, { done, total });

  return (
    <Pressable
      testID="seller-status-row"
      onPress={() => router.push('/v2/account-status')}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${progress}. ${caption}`}
      style={[styles.row, { opacity: pressed ? press.opacity : 1 }]}
    >
      {/*
        The ground and its border live on a plain View, not on the RNGH
        Pressable: that Pressable does not apply `borderRadius` to its native
        view on Android, so a border set on it draws square (see
        `drafts/draft-card.tsx`). A plain View rounds correctly.
      */}
      <View
        pointerEvents="none"
        style={[styles.ground, { backgroundColor: c.surface, borderColor: c.accentWash }]}
      >
        <MaterialFill role="surface" ink="ink" radius={radius.lg} />
      </View>

      <ProgressRing done={done} total={total} />

      <View style={styles.text}>
        <Text variant="rowTitle" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.sub}>
          {caption}
        </Text>
      </View>

      <ChevronRight size={icon.md} color={c.inkSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * Same margins and padding as `TintedRow`, so this row and the assistant row
   * directly below it are the same width and height. The gutter is HERE and
   * only here — `SellingPane` mounts this bare.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    marginHorizontal: GUTTER,
    paddingVertical: space['3xl'],
    paddingHorizontal: CARD_PAD,
  },
  ground: {
    // `absoluteFillObject` is not in this RN version's types — see the same
    // note in `features/v2/detection/group-mosaic.tsx`.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ring: {
    width: control.avatar,
    height: control.avatar,
    flexShrink: 0,
  },
  ringLabel: {
    // `absoluteFillObject` is not in this RN version's types — see the same
    // note in `features/v2/detection/group-mosaic.tsx`.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  sub: { marginTop: ROW_SUBLINE_GAP },
  resend: { gap: space.xxs },
});
