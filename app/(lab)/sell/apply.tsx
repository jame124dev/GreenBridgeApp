/**
 * Seller status — the destination of the sell gate.
 *
 * `launchSellerScan()` sends anyone who is not an APPROVED seller here instead
 * of opening the camera, from all five sell entry points (lab home ×2, lab chat
 * ×2, chat controller). This screen answers four situations, decided from
 * `useSellerUpgradeStatus()` alone:
 *
 *   approved              → "you can list now" + straight into the scan flow
 *   pending               → "with our team" + a way back into the app
 *   rejected              → the reviewer's reason, and what happens next
 *   no application (null) → "selling needs a verified business account"
 *
 * ⛔⛔ THE APPLICATION FORM WAS DELETED HERE — DO NOT PUT IT BACK WITHOUT READING
 * THIS. App Review rejected 1.0.3 (19) on 2026-08-20 under **Guideline 3.1.1**:
 *
 *   "The app includes an account registration feature for businesses and
 *    organizations, which is considered access to external mechanisms for
 *    purchases or subscriptions to be used in the app.
 *    Next Steps: Remove the account registration features for business and
 *    organizations."
 *
 * The form on this screen was that feature: a "Your business" section asking for
 * company name, tax / business-registration number, business type, and a
 * business-registration certificate upload. It is the SECOND time this exact
 * objection was raised — 1.0.0 (14) was rejected for it too, and 1.0.0 (16) was
 * only approved because the app had been reduced to sign-in-only. Commit
 * `3e2e12e` then reintroduced registration under the message "3.1.1-safe"; it was
 * not. An earlier mitigation moved the company/tax fields OUT of signup and INTO
 * this form, which kept them in the binary — Apple said *remove*, not *move*.
 *
 * Why deleted rather than put behind a flag: **Guideline 2.3.1** forbids hidden or
 * undocumented features, naming features that are disabled at review time and
 * enabled afterwards. A flag-gated unreachable form is precisely that, and would
 * trade one rejection for a worse one.
 *
 * The BUSINESS REQUIREMENT is unchanged. Sellers still must be verified — company
 * name, tax number and registration certificate are still mandatory — they are
 * simply collected off-app by the team, and `/seller-upgrade/my-status` still
 * decides who may publish (see `sellerSubmitGate.ts`). Nothing about who can sell
 * changed; only where the details are gathered.
 *
 * NO OUTBOUND LINK, deliberately. Guideline 3.1.3's preamble forbids encouraging
 * a purchasing path outside the app, and rejection #3 in this app's history was
 * caused by an in-app link to a web page carrying a Company field. So this screen
 * states the position and stops — no "sign up at…", no browser hand-off.
 *
 * Strings are `t(key, { defaultValue })` — Phase 4 owns `src/i18n/locales/*`.
 */
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { GuestTabState } from '@/features/auth/GuestTabState';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import { useAuth } from '@/stores/authStore';
import { SellerStatusCard } from '@/features/seller/SellerStatusCard';
import { useSellerUpgradeStatus } from '@/features/seller/useSellerUpgrade';
import { brand, spacing } from '@/constants/theme';

export default function SellerApplyScreen() {
  const { t } = useTranslation();
  const statusQ = useSellerUpgradeStatus();
  const signedIn = useAuth((st) => !!st.profile);

  const status = statusQ.data ?? null;

  /*
    ── State 0: A GUEST ──────────────────────────────────────────────────────

    This branch is new, and it is the one a signed-out person actually hits.
    `useSellerUpgradeStatus` is `enabled: signedIn`, so for a guest the query
    never runs: `isLoading` is false, `isError` is false, and `data` is
    `undefined`. Every branch below therefore fell through to State 5, which
    told a person who has no account at all that "selling needs a verified
    business account" and offered them one button — "Back to browsing". A true
    sentence, answering a question they had not asked, and a dead end.

    What they need is an account — and this app already has one component for
    saying so. `GuestTabState` is what a guest sees on Account, Messages and
    Wants, and `'sell'` was ALREADY a valid `GateReason`; it simply had no copy
    entry, so it fell through the map's default and showed the Account text.
    Reusing it is what keeps the four gates a guest can hit in one session
    looking like one app.

    Its shape matches the web app's own guest gate —
    `nextjs-port/src/shared/components/ai/aiChatShared.tsx:1484` (`GateCard` →
    `GateLink`): short title, ONE supporting line, one CTA ("Create a free
    account to continue" / "Sign in or sign up to list items and manage your
    bids." / "Create account").

    ⚠️ WHY THIS DOES NOT REOPEN THE GUIDELINE 3.1.1 PROBLEM described at the
    top of this file. Read before changing the destination.

      • It routes to `app/(auth)/register.tsx`, the app's own PERSONAL account
        signup — email, name, password, confirm. That screen's docblock records
        that company, tax id and business type were deliberately removed from
        it for this exact reason, and `grep -niE "company|tax|business"` over it
        returns only those comments. It is not a business-registration form.
      • It is an IN-APP route, not an outbound link. Rejection #3 was caused by
        an in-app link to a WEB page carrying a Company field; 3.1.3's preamble
        is about steering to an off-app commercial path. `router.push` to a
        bundled screen is neither.
      • The direction is the opposite of the sentence deleted from
        `register.tsx:521`. That one pushed a NEW USER toward the business
        application ("apply to sell from the Sell tab"). This one offers a
        person with no account the ordinary way to get one.

    If the destination ever changes, or signup regains a company/tax field,
    this branch has to be re-reviewed against that note — not just edited.
  */
  if (!signedIn) {
    return <GuestTabState reason="sell" />;
  }

  // ── State 1: checking. An explaining line, never a bare spinner. ──────────
  if (statusQ.isLoading) {
    return (
      <Screen edges={['top']}>
        <View className="flex-1 items-center justify-center" style={{ gap: 12 }}>
          <ActivityIndicator color={brand.primary} />
          <Text tone="secondary">
            {t('mobile.seller.apply.checking', {
              defaultValue: 'Checking whether you can list yet…',
            })}
          </Text>
        </View>
      </Screen>
    );
  }

  // ── State 2: we could not find out. Recoverable, with a way onwards. ──────
  if (statusQ.isError) {
    return (
      <Screen edges={['top']}>
        <View className="flex-1 justify-center" style={{ gap: 16 }}>
          <Text variant="title">
            {t('mobile.seller.apply.errorTitle', { defaultValue: 'We could not check your status' })}
          </Text>
          <Text tone="secondary">
            {statusQ.error?.message ??
              t('mobile.seller.apply.errorBody', {
                defaultValue: 'The connection dropped before we heard back.',
              })}
          </Text>
          <Button
            label={t('mobile.seller.apply.retry', { defaultValue: 'Try again' })}
            onPress={() => void statusQ.refetch()}
            loading={statusQ.isFetching}
            leftIcon={<RefreshCw size={17} color="#fff" strokeWidth={2.4} />}
            fullWidth
          />
          <Button
            label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  // ── State 3: approved — the only state with a door into the scan flow. ────
  if (status?.status === 'approved') {
    return (
      <Screen edges={['top']}>
        <View style={{ gap: 16, paddingTop: spacing.lg }}>
          <SellerStatusCard status={status}>
            <Button
              label={t('mobile.seller.apply.startListing', { defaultValue: 'Start a listing' })}
              onPress={launchSellerScan}
              leftIcon={<Camera size={18} color="#fff" strokeWidth={2.3} />}
              fullWidth
            />
          </SellerStatusCard>
          <Button
            label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
            onPress={() => router.back()}
            variant="ghost"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  // ── State 4: pending — the team already has this person's details. ────────
  if (status?.status === 'pending') {
    return (
      <Screen edges={['top']}>
        <View style={{ gap: 16, paddingTop: spacing.lg }}>
          <SellerStatusCard status={status}>
            <Button
              label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
              onPress={() => router.back()}
              fullWidth
            />
          </SellerStatusCard>
          <Pressable
            onPress={() => void statusQ.refetch()}
            disabled={statusQ.isFetching}
            accessibilityRole="button"
            className="flex-row items-center justify-center py-md"
            style={{ gap: 8 }}
          >
            <RefreshCw size={15} color={brand.textMuted} strokeWidth={2.2} />
            <Text variant="bodySm" tone="secondary" className="font-semi">
              {statusQ.isFetching
                ? t('mobile.seller.apply.refreshing', { defaultValue: 'Checking…' })
                : t('mobile.seller.apply.refresh', { defaultValue: 'Check for an update' })}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── State 5: not a verified seller (no application, or a rejected one) ────
  // Was the application form. See the Guideline 3.1.1 note at the top of this
  // file before adding any field, upload or outbound link back to this branch.
  //
  // A rejected application still shows the reviewer's own sentence — a person who
  // was turned down is owed the reason, and `SellerStatusCard` renders it. It sits
  // ABOVE the explanation, the same order the form used, so the specific answer
  // precedes the general one.
  const isRejected = status?.status === 'rejected';

  return (
    <Screen edges={['top']}>
      <View style={{ gap: 16, paddingTop: spacing.lg }}>
        {status && isRejected ? <SellerStatusCard status={status} /> : null}

        <Text variant="title">
          {isRejected
            ? t('mobile.seller.apply.blockedTitleRejected', {
                defaultValue: 'Your seller account is not active',
              })
            : t('mobile.seller.apply.blockedTitle', {
                defaultValue: 'Selling needs a verified business account',
              })}
        </Text>

        <Text tone="secondary">
          {isRejected
            ? t('mobile.seller.apply.blockedBodyRejected', {
                defaultValue:
                  'Our team will follow up with you about what is needed to activate it. You can keep browsing equipment, messaging sellers and saving drafts in the meantime.',
              })
            : t('mobile.seller.apply.blockedBody', {
                defaultValue:
                  'Listings on GreenBidz come from verified businesses, and our team completes that verification with you directly — we will be in touch. You can keep browsing equipment, messaging sellers and saving drafts of anything you plan to list.',
              })}
        </Text>

        {/* Drafts are the load-bearing half of that sentence: the scan flow lets
            anyone photograph, run the AI and SAVE — only publishing is gated
            (sellerSubmitGate.ts). Saying so here is what keeps this screen from
            reading as a dead end. */}
        <Button
          label={t('mobile.seller.apply.backToBrowsing', { defaultValue: 'Back to browsing' })}
          onPress={() => router.back()}
          fullWidth
        />
      </View>
    </Screen>
  );
}
