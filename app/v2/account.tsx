/**
 * 6f — Account.
 *
 * Drawn in `docs/v2-design/screens/6f.html`: a centred identity on the green
 * header sheet, verification as a 3pt line with one sentence of guidance, then
 * two quiet hairline-separated lists. Sign out is grey text — for a signed-in
 * person there is no green pill anywhere on this screen, which is the whole
 * reason it reads as calm.
 *
 * ── DATA: read real, write later ─────────────────────────────────────────
 *   identity       authStore.profile + useUserProfile()
 *   verification   useUserProfile() + authStore.approval, DERIVED — see
 *                  `verificationSteps`. The canvas's "2 of 4" is a mock; the
 *                  four steps here are the four facts the API actually knows.
 *   My listings    useRecentSubmissions()
 *   Drafts         useListDrafts(), behind `draftsEnabled()`
 *   Notifications  useNotificationPreferences() (MMKV-only today)
 *   Language       useUserProfile().languageRegion
 *   bell dot       useLabNotifications().unreadCount
 *
 * Every WRITE this screen shows — sign out, delete account — is rendered and
 * left inert behind `TODO(v2-writes)`. Nothing here mutates anything.
 *
 * ── GUEST MODE ───────────────────────────────────────────────────────────
 * Guests keep the whole map of the app; each row asks for an account through
 * `requireAuth` only when it is tapped (App Review 5.1.1(v), 2026-08-24 — the
 * rejection was for gating at the door). `SignInPrompt` is mounted once in
 * `app/v2/_layout.tsx`, so this screen does not render it.
 *
 * ── KIT ──────────────────────────────────────────────────────────────────
 * The brand bar, the trailing value/pill cluster, the quiet text buttons and
 * the verification track were all local copies in the first pass. They were
 * reported as kit gaps, reconciled into `src/features/v2/ui/` as `BrandBar`,
 * `RowTrailing`, `QuietAction` and `ProgressLine`, and are composed here.
 */
import React, { useCallback } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { routes } from '@/lib/routes';
import { User } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useLogout } from '@/features/auth/useLogout';
import { useUserProfile } from '@/features/auth/useUserProfile';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
// Straight from the hook module, not the `@/features/settings` barrel: that
// barrel re-exports the old settings cards and would drag bottom-sheet and
// react-hook-form into a v2 route that uses neither.
import { useNotificationPreferences } from '@/features/settings/useNotificationPreferences';
import {
  BrandBar,
  Hairline,
  PrimaryAction,
  ProgressLine,
  QuietAction,
  Row,
  RowTrailing,
  Screen,
  SectionHeader,
  Text,
} from '@/features/v2/ui';
import { draftsEnabled } from '@/lib/flags';
import { haptics } from '@/lib/haptics';
import type { UserProfile } from '@/services/auth/userProfile';
import { useListDrafts } from '@/services/drafts/draftHooks';
import { useAuth, type ApprovalState } from '@/stores/authStore';
import {
  GUTTER,
  SECTION_GAP,
  control,
  icon,
  radius,
  space,
  useV2Colors,
} from '@/theme/v2';

/**
 * How many listings to ask for when all we want is the number. The endpoint
 * returns rows, not a total, so the count is honest up to here and shows
 * "20+" beyond it rather than lying with a capped figure.
 */
const LISTINGS_PROBE = 20;

/**
 * Support is a mailto, never the website — see `QuickActionsStrip` for the two
 * App Review rejections behind that (2.1, then 3.1.1).
 */
const SUPPORT_EMAIL = 'support@greenbidz.com';

// ── Derivations ────────────────────────────────────────────────────────────

/**
 * The four verification facts the backend actually reports, in the order a
 * seller completes them. `approval` (from loginV3) wins where it exists — it
 * is the server's own verdict — and the profile fills in the rest.
 */
function verificationSteps(
  profile: UserProfile | undefined,
  approval: ApprovalState | null,
): { done: boolean; missing: string }[] {
  const personal = profile?.personalInfo;
  const docs = profile?.documents;
  return [
    {
      done: approval?.email_verified ?? !!profile?.email,
      missing: 'a verified email address',
    },
    { done: !!personal?.phone, missing: 'a phone number' },
    { done: !!personal?.company, missing: 'your business details' },
    {
      done:
        approval?.documents?.business_registration ??
        !!docs?.businessRegCertificate?.length,
      missing: 'business documents',
    },
  ];
}

/** "a, b and c" — the sentence under the line names what is left to do. */
function joinPhrases(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Two letters from whatever identity we have. */
function initialsFor(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '';
}

/**
 * A count we can stand behind, or nothing at all. A placeholder "0" while a
 * query is in flight reads as "you have none", which is a different claim.
 */
function countLabel(n: number | undefined, more: boolean): string | undefined {
  if (n === undefined) return undefined;
  return more ? `${n}+` : String(n);
}

/**
 * A `Row` is one accessible element, so nothing in its trailing slot is ever
 * announced. Anything a value or a pill says has to be folded into the label.
 */
function rowLabel(title: string, value?: string): string | undefined {
  return value ? `${title}, ${value}` : undefined;
}

// ── Local pieces ───────────────────────────────────────────────────────────

/** Centred identity on the green sheet: brand bar, avatar, name, one grey line. */
function IdentityHeader({
  initials,
  name,
  detail,
  language,
  unread,
  onBell,
}: {
  initials: string;
  name: string;
  detail: string;
  language: string;
  unread: number;
  onBell: () => void;
}) {
  const c = useV2Colors();
  return (
    <View>
      <BrandBar language={language} unread={unread > 0} onNotifications={onBell} />

      {/* flat: an identity tile, not a control — nothing here is pressable. */}
      <View style={[styles.avatar, { backgroundColor: c.accent }]}>
        {initials ? (
          <Text variant="h2" color="onAccent">
            {initials}
          </Text>
        ) : (
          <User size={icon.hero} color={c.onAccent} />
        )}
      </View>

      <Text variant="h2" numberOfLines={2} style={styles.centred}>
        {name}
      </Text>
      {detail ? (
        <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.detail}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Verification: a label, a fraction, a 3pt line, one sentence saying what is
 * left. The sentence names the outstanding steps rather than restating the
 * fraction — "2 of 4" alone tells nobody what to do next.
 */
function VerificationBlock({
  steps,
  loading,
  failed,
  onRetry,
}: {
  steps: { done: boolean; missing: string }[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const outstanding = steps.filter((s) => !s.done).map((s) => s.missing);
  const settled = !loading && !failed;

  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text variant="rowTitle">Verification</Text>
        {settled ? (
          <Text variant="caption" color="inkMuted">{`${done} of ${total}`}</Text>
        ) : null}
      </View>

      {/* Nothing is claimed until the profile has landed — an empty track is
          honest about not knowing, a filled one is not. */}
      <ProgressLine value={settled ? done : 0} total={total} label="Verification progress" />

      {loading ? (
        <Text variant="caption" color="inkSubtle">
          Checking what is still outstanding…
        </Text>
      ) : failed ? (
        <View>
          <Text variant="caption" color="inkSubtle">
            We could not load your verification status just now.
          </Text>
          <QuietAction
            label="Try again"
            onPress={onRetry}
            tone="accent"
            variant="captionMedium"
            testID="v2-account-verification-retry"
          />
        </View>
      ) : outstanding.length === 0 ? (
        <Text variant="caption" color="inkSubtle">
          Everything we need is on file. Your account is fully verified.
        </Text>
      ) : (
        <Text variant="caption" color="inkSubtle">
          {`Add ${joinPhrases(outstanding)} to finish.`}
        </Text>
      )}
    </View>
  );
}

/** What a guest sees where a seller sees verification progress. */
function GuestBlock({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={styles.block}>
      {/*
        No heading here. The header sheet directly above already says
        "Browsing as a guest" — repeating it produced the same sentence twice,
        back to back, on device. This block's job is to say what an account
        gets you, not to re-announce the state.
      */}
      <Text variant="caption" color="inkSubtle" style={styles.guestBody}>
        Your listings, drafts, offers and messages live behind an account.
        Browsing and search stay open either way.
      </Text>
      <PrimaryAction
        label="Sign in"
        onPress={onSignIn}
        style={styles.guestAction}
        testID="v2-account-sign-in"
      />
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function V2Account() {
  const signOut = useLogout();
  const isGuest = useIsGuest();
  const session = useAuth((s) => s.profile);
  const approval = useAuth((s) => s.approval);

  const profileQuery = useUserProfile();
  const profile = profileQuery.data;

  // Counts. Each hook self-gates on a signed-in id, so a guest fetches nothing
  // and never sees a 401 — the hooks stay mounted so the hook count cannot
  // change the moment somebody signs in.
  const listingsQuery = useRecentSubmissions(LISTINGS_PROBE);
  const draftsOn = draftsEnabled() && !!session?.id;
  const draftsQuery = useListDrafts({ enabled: draftsOn, retry: 0 });
  const { unreadCount } = useLabNotifications();
  const { prefs } = useNotificationPreferences();

  const listingCount = listingsQuery.isSuccess ? listingsQuery.data.length : undefined;
  const draftCount = draftsQuery.isSuccess ? draftsQuery.data.drafts.length : undefined;

  // Identity. The cached session paints immediately and the profile query fills
  // in the fuller name and the city when it lands, so the header never flashes
  // an empty state on a warm start.
  const name = profile?.displayName || session?.name || 'Your account';
  const email = profile?.email || session?.email || '';
  const city = profile?.personalInfo.address?.city ?? '';
  const role = session?.role ? session.role[0].toUpperCase() + session.role.slice(1) : '';
  const detail = isGuest
    ? 'Sign in to sell, save and message'
    : [role, city].filter(Boolean).join(' · ');
  const language = (profile?.languageRegion.language || 'en').slice(0, 2).toUpperCase();
  const currency = profile?.languageRegion.currency || 'USD';

  const notificationsOn = Object.values(prefs).filter(Boolean).length;
  const notificationsTotal = Object.keys(prefs).length;
  const notificationSummary =
    notificationsOn === 0
      ? 'Off'
      : notificationsOn === notificationsTotal
        ? 'Instant'
        : `${notificationsOn} of ${notificationsTotal}`;

  const listingsValue = countLabel(listingCount, listingCount === LISTINGS_PROBE);
  const draftsValue = countLabel(draftCount, !!draftsQuery.data?.next_cursor);
  const localeValue = `${language} · ${currency}`;

  const go = useCallback((run: () => void) => {
    haptics.tap();
    run();
  }, []);

  const openSupport = useCallback(async () => {
    haptics.tap();
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('GreenBidz app support')}`;
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error('no mail client');
      await Linking.openURL(url);
    } catch {
      // Simulator, or a device with no mail account configured. Show the
      // address rather than failing silently — support stays reachable.
      toast.info(`Email us at ${SUPPORT_EMAIL}`);
    }
  }, []);

  return (
    <Screen
      testID="v2-account"
      header={
        <IdentityHeader
          initials={isGuest ? '' : initialsFor(name, email)}
          name={isGuest ? 'Browsing as a guest' : name}
          detail={detail}
          language={language}
          unread={unreadCount}
          onBell={() =>
            go(() => requireAuth('notifications', () => router.push('/notifications')))
          }
        />
      }
    >
      <View style={styles.body}>
        {isGuest ? (
          <GuestBlock onSignIn={() => go(() => requireAuth('account', () => undefined))} />
        ) : (
          <VerificationBlock
            steps={verificationSteps(profile, approval)}
            loading={profileQuery.isLoading}
            failed={profileQuery.isError}
            onRetry={() => void profileQuery.refetch()}
          />
        )}

        <SectionHeader title="Selling" />

        <Hairline />
        <Row
          testID="v2-account-listings"
          title="My listings"
          titleVariant="row"
          trailing={<RowTrailing value={listingsValue} />}
          accessibilityLabel={rowLabel('My listings', listingsValue)}
          // v2's own list, not the old `/listings` — that one lives in the
          // `(lab)` tab group, so opening it from here swapped the whole tab bar.
          onPress={() => go(() => requireAuth('account', () => router.push(routes.v2Listings)))}
        />

        {/* Behind EXPO_PUBLIC_DRAFTS, like every other drafts surface: with the
            flag off the endpoint is not deployed and the row would 404. */}
        {draftsOn ? (
          <>
            <Hairline />
            <Row
              testID="v2-account-drafts"
              title="Drafts"
              titleVariant="row"
              trailing={<RowTrailing chip={draftsValue} chipTone="accent" />}
              accessibilityLabel={rowLabel('Drafts', draftsValue)}
              onPress={() => go(() => requireAuth('draft', () => router.push(routes.v2Drafts)))}
            />
          </>
        ) : null}

        <Hairline />
        {/* No offers-received count exists on any endpoint today, and offers
            arrive in the buyer/seller inbox — so that is where this row goes.
            TODO(v2-data): show a real count when the API grows one. */}
        <Row
          testID="v2-account-offers"
          title="Offers received"
          titleVariant="row"
          trailing={<RowTrailing />}
          onPress={() => go(() => requireAuth('offer', () => router.push('/deals')))}
        />

        <View style={styles.sectionGap} />

        <SectionHeader title="Account" />

        {/* TODO(v2-nav): profile, notification preferences and language all
            still live on the old settings screen. Retarget each row as its v2
            sub-screen lands. */}
        <Hairline />
        <Row
          testID="v2-account-profile"
          title="Profile information"
          titleVariant="row"
          trailing={<RowTrailing />}
          onPress={() => go(() => requireAuth('account', () => router.push('/account')))}
        />

        <Hairline />
        <Row
          testID="v2-account-notifications"
          title="Notifications"
          titleVariant="row"
          trailing={<RowTrailing value={notificationSummary} />}
          accessibilityLabel={rowLabel('Notifications', notificationSummary)}
          onPress={() => go(() => requireAuth('notifications', () => router.push('/account')))}
        />

        <Hairline />
        <Row
          testID="v2-account-language"
          title="Language and currency"
          titleVariant="row"
          trailing={<RowTrailing value={localeValue} />}
          accessibilityLabel={rowLabel('Language and currency', localeValue)}
          onPress={() => go(() => requireAuth('account', () => router.push('/account')))}
        />

        <Hairline />
        <Row
          testID="v2-account-help"
          title="Help centre"
          titleVariant="row"
          trailing={<RowTrailing />}
          onPress={() => void openSupport()}
        />

        {!isGuest ? (
          <View style={styles.footerActions}>
            {/*
              Sign-out is WIRED (2026-09-03). `useLogout()` does the whole
              teardown, and using it rather than clearing the auth store is
              load-bearing: it also wipes the React Query cache and the lab
              chat/session/composer stores. Signing out and back in as a
              different account otherwise left the PREVIOUS user's wants,
              matches and badge counts on screen until each query refetched —
              found on a device 2026-08-13, and the reason that hook has the
              shape it does.

              No confirm step: it is reversible, and a confirm on a reversible
              action is the friction the UX rules call out. Deleting the
              account below is the one that asks.
            */}
            <QuietAction
              label="Sign out"
              onPress={() => {
                haptics.warning();
                signOut.mutate();
              }}
              disabled={signOut.isPending}
              testID="v2-account-sign-out"
            />
            {/*
              Account deletion is an App Store requirement (5.1.1(v)) and has to
              survive the redesign even though the canvas omits it.

              ⚠️ THIS FIRED ONLY A HAPTIC. A "Delete account" that does nothing
              is worse than one that is absent: 5.1.1(v) is a rule App Review
              TESTS, so a reviewer presses this button, and a dead one reads as
              a deliberate dark pattern rather than an unfinished screen.

              Now routes to the SHIPPED confirm flow — the same screen the old
              UI's `DeleteAccountLink` opens, which owns `useDeletionPreview`
              and `useDeleteAccount`. Navigating is not deleting: the
              irreversible step stays behind that screen's own confirmation, so
              this stays a read even though the flow it opens is a write.

              TODO(v2-nav): swap for a v2 confirm screen if one is ever drawn.
            */}
            <QuietAction
              label="Delete account"
              onPress={() => {
                haptics.warning();
                router.push('/(lab)/account/delete');
              }}
              variant="caption"
              testID="v2-account-delete"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Header
  avatar: {
    width: control.avatarLg,
    height: control.avatarLg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: space.sm,
    marginBottom: space['3xl'],
  },
  centred: { textAlign: 'center' },
  detail: { textAlign: 'center', marginTop: space.xs },

  // Body
  body: { paddingTop: space['7xl'] },
  block: { paddingHorizontal: GUTTER, paddingBottom: space['6xl'] },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  guestBody: { marginTop: space.sm },
  guestAction: { marginTop: space['4xl'] },
  sectionGap: { height: SECTION_GAP },

  // Footer
  footerActions: { paddingTop: space['7xl'], paddingHorizontal: GUTTER },
});
