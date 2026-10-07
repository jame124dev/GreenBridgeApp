/**
 * Account status — "where has my seller application got to?"
 *
 * ── WHY IT IS HERE AND NOT `app/(auth)/pending.tsx` ────────────────────────
 *
 * That screen exists, is finished, and is unreachable: the RootLayout guard
 * replaces to the home route for any signed-in user inside the `(auth)` group,
 * so nothing can show it (its own header says so). Rather than resurrect a
 * dead end inside `(auth)`, this is the v2-language equivalent living where
 * the rest of the v2 app lives, reached from the status card on the Selling
 * home.
 *
 * ── TWO INVARIANTS CARRIED OVER, BOTH LOAD-BEARING ─────────────────────────
 *
 * 1. **IT NEVER BLOCKS.** It is a screen you choose to open, not a wall. A
 *    pending account is a working account — browsing, drafting, wants and
 *    messages all work, and only publishing is gated (`canSubmitListing`).
 *    Making this a gate is what made a fresh install a dead end once already.
 *
 * 2. **NO OUTBOUND NAVIGATION.** `Linking` and `WebBrowser` are deliberately
 *    not imported. App Review rejected build 14 under Guideline 3.1.1 for an
 *    "Open website" button on the equivalent screen, and this is a screen an
 *    unapproved reviewer can reach. "Ask us about it" goes to the in-app
 *    assistant. This file is added to `MUST_NOT_NAVIGATE` in
 *    `src/__tests__/externalLinks.test.ts` so the build fails if that changes.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Check, CircleAlert, Clock, Lock } from 'lucide-react-native';

import { AuthShell } from '@/features/v2/auth/AuthShell';
import { PrimaryAction, QuietAction, Text } from '@/features/v2/ui';
import { type StepState } from '@/features/auth/approvalChecklist';
import { useSellerStatus } from '@/features/seller/useSellerStatus';
import { ResendEmailAction } from '@/features/v2/seller/SellerStatusCards';
import { CARD_PAD, icon, radius, space, useV2Colors } from '@/theme/v2';
import { useAuth } from '@/stores/authStore';

const T = 'mobile.auth.onboarding.accountStatus.';

/** The marker at the head of each row. State is carried by SHAPE, not only colour. */
function StepMarker({ state }: { state: StepState }) {
  const c = useV2Colors();
  if (state === 'done') {
    // The ramp gives large surfaces depth; on a 28pt dot it muddies the tick.
    return (
      // flat: a state dot, not a surface.
      <View style={[styles.marker, { backgroundColor: c.accent }]}>
        <Check size={icon.sm} color={c.onAccent} strokeWidth={2.5} />
      </View>
    );
  }
  if (state === 'action') {
    return (
      <View style={[styles.marker, styles.markerRing, { borderColor: c.cautionLine }]}>
        <CircleAlert size={icon.sm} color={c.cautionInk} strokeWidth={2} />
      </View>
    );
  }
  if (state === 'review') {
    return (
      <View style={[styles.marker, styles.markerRing, { borderColor: c.accent }]}>
        <Clock size={icon.sm} color={c.accent} strokeWidth={2} />
      </View>
    );
  }
  return <View style={[styles.marker, styles.markerRing, { borderColor: c.hairlineStrong }]} />;
}

export default function AccountStatusScreen() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const status = useSellerStatus();

  /*
   * THE SAME FOUR FACTS THE HOME ROW'S RING COUNTS, in the same order, from
   * the same hook — so the two can never disagree about how far along someone
   * is. They did at first: the ring counted account/email/profile/approval
   * while this screen used `deriveApprovalChecklist`, which reports
   * account/email/documents/review from `authStore.approval`. That object is
   * never populated (loginV3's ACCOUNT_PENDING body carries no `approval`),
   * so its `documents` step could never appear and its counts were a
   * different number from the ring's on the same account.
   *
   * `deriveApprovalChecklist` is left alone — `app/(auth)/pending.tsx` still
   * uses it.
   */
  const steps = [
    { key: 'account', state: 'done' as StepState },
    { key: 'email', state: (status.emailVerified ? 'done' : 'action') as StepState },
    { key: 'profile', state: (status.onboardingIncomplete ? 'action' : 'done') as StepState },
    { key: 'review', state: (status.awaitingApproval ? 'review' : 'done') as StepState },
  ];

  return (
    <AuthShell
      mode="signup"
      segmented={false}
      testID="v2-account-status"
      title={t(`${T}title`)}
      subtitle={t(`${T}subtitle`)}
      footer={
        <PrimaryAction
          label={t(`${T}browseCta`)}
          onPress={() => router.replace('/v2/browse')}
          testID="v2-account-status-browse"
        />
      }
      footerQuiet={
        <QuietAction label={t(`${T}askCta`)} onPress={() => router.push('/v2/chat')} />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.steps}>
          {steps.map((s, i) => (
            <View key={s.key} style={styles.step}>
              <View style={styles.markerCol}>
                <StepMarker state={s.state} />
                {/* The connector stops after the last marker, not before it. */}
                {i < steps.length - 1 && (
                  // flat: a 2pt divider between markers, not a surface.
                  <View style={[styles.connector, { backgroundColor: c.hairlineStrong }]} />
                )}
              </View>
              <View style={styles.stepText}>
                <Text variant="bodySemi" color={s.state === 'wait' ? 'inkMuted' : 'ink'}>
                  {t(`${T}steps.${s.key}.title`)}
                </Text>
                <Text variant="caption" color="inkSubtle">
                  {s.key === 'email' && s.state === 'action' && profile?.email
                    ? t(`${T}steps.email.sentTo`, { email: profile.email })
                    : t(`${T}steps.${s.key}.body`)}
                </Text>
                {/* The SAME control as the card on the Selling home, imported
                    rather than re-implemented — two resend buttons that
                    disagree about what happened is worse than one. */}
                {s.key === 'email' && s.state === 'action' && <ResendEmailAction />}
                {/*
                  ⚠️ THE ONLY DISCOVERABLE WAY BACK INTO THE WIZARD.
                  Collapsing the home cards into one row removed the "Finish
                  your seller profile" entry, which left the resume flow
                  reachable only by attempting a publish and being bounced
                  (`sellerSubmitGate.ts`). That is the same undiscoverable
                  state the row was built to fix. Do not remove this without
                  putting the entry somewhere else first.
                */}
                {s.key === 'profile' && s.state === 'action' && (
                  <QuietAction
                    label={t(`${T}steps.profile.cta`)}
                    align="start"
                    onPress={() => router.push('/(auth)/onboarding-mock')}
                  />
                )}
              </View>
            </View>
          ))}
        </View>

        {/* What still works, so the screen is not purely a list of blockers. */}
        {/* flat: ramping accentWash lifts it toward the card it sits on. */}
        <View style={[styles.panel, { backgroundColor: c.accentWash }]}>
          {/* `eyebrow` already carries the letterspaced caps — setting
              letterSpacing/textTransform by hand here is what `v2Adherence`
              forbids, and rightly: it forks the type scale per screen. */}
          <Text variant="eyebrow" style={{ color: c.accentInk }}>
            {t(`${T}canDo.title`)}
          </Text>
          {(['browse', 'wants', 'drafts'] as const).map((k) => (
            <View key={k} style={styles.canDoRow}>
              <Check size={icon.sm} color={c.accent} strokeWidth={2.5} />
              <Text variant="caption" color="ink">
                {t(`${T}canDo.${k}`)}
              </Text>
            </View>
          ))}
          {/*
            The glyph follows the SENTENCE, not the row.
            A padlock beside "Publishing is open" is a contradiction the eye
            catches before the words do — seen on a device 2026-10-06, where an
            unapproved-but-not-pending session rendered exactly that.
          */}
          <View style={styles.canDoRow}>
            {status.awaitingApproval ? (
              <Lock size={icon.sm} color={c.inkSubtle} strokeWidth={2} />
            ) : (
              <Check size={icon.sm} color={c.accent} strokeWidth={2.5} />
            )}
            <Text
              variant="caption"
              color={status.awaitingApproval ? 'inkSubtle' : 'ink'}
            >
              {status.awaitingApproval ? t(`${T}canDo.locked`) : t(`${T}canDo.unlocked`)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.xl },
  steps: { gap: space.xs },
  step: { flexDirection: 'row', gap: space.md },
  markerCol: { alignItems: 'center' },
  marker: {
    width: 28,
    height: 28,
    // `radius.pill`, not a hand-computed half-width — a circle is the pill
    // token at this size, and `v2Adherence` forbids raw borderRadius numbers.
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerRing: { borderWidth: 2 },
  /** Fills the gap to the next marker; the row's own height sets the length. */
  connector: { width: 2, flex: 1, marginVertical: space.xxs },
  stepText: { flex: 1, paddingBottom: space.lg, gap: space.xxs },
  panel: { marginTop: space.lg, borderRadius: radius.lg, padding: CARD_PAD, gap: space.sm },
  canDoRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
