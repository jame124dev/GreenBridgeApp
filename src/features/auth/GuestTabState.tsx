import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PrimaryAction, QuietAction, Screen, Text } from '@/features/v2/ui';
import { GUTTER, space } from '@/theme/v2';

import type { GateReason } from './signInPromptStore';

/**
 * What a guest sees on a tab or screen that is genuinely account-based.
 *
 * Rendered INSTEAD OF the signed-in screen, as a sibling component — never as an
 * early return inside it. The authed screens open sockets and fire authenticated
 * queries from their hooks; an early return would either change the hook count
 * between renders (React throws once the guest signs in) or leave those hooks
 * firing 401s for someone who has no account. A wrapper keeps them unmounted.
 *
 * These screens are allowed to be gated: Guideline 5.1.1(v) permits requiring an
 * account for account-based features. What is NOT allowed — and what got
 * 1.0.3 (21) rejected — is gating browse and search, which stay open.
 *
 * ── THE SHAPE ─────────────────────────────────────────────────────────────
 *
 * Title, ONE supporting line, one primary action, then the two ways onwards.
 * It is the same gate the web app draws — see `GateCard` → `GateLink` in
 * `nextjs-port/src/shared/components/ai/aiChatShared.tsx:1484`, which is a
 * short title, a one-line subtitle and a single "Create account" CTA — so a
 * person meeting the gate on the site and in the app meets the same thing.
 *
 * Ported to the v2 kit (was `@/components/ui` `Button`/`Screen`/`Text` on the
 * `spacing` constants). All four reasons move together, which is the point: a
 * guest can reach several of these in one session and they should not look
 * like different apps.
 */
export function GuestTabState({ reason }: { reason: GateReason }) {
  const { t } = useTranslation();

  /*
    ⚠️ KEEP A CASE FOR EVERY `GateReason`. The map falls back to `account`, so a
    missing reason does not crash — it quietly shows the WRONG copy. `sell` was
    missing, which is why a guest who tapped Sell was told "Your account. Sign
    in to manage your listings, saved searches and messages." — an answer to a
    question they had not asked.
  */
  const COPY: Record<GateReason, { title: string; body: string }> = {
    account: {
      title: 'Your account',
      body: 'Sign in to manage your listings, saved searches and messages. You can keep browsing equipment without an account.',
    },
    want: {
      title: 'Tell us what you need',
      body: "Save what you're looking for and we'll match it against equipment as it arrives. Needs an account so we know who to notify.",
    },
    message: {
      title: 'Your messages',
      body: 'Conversations with sellers live in your account, so you can pick them up on any device.',
    },
    sell: {
      title: 'Create an account to sell',
      /*
        ONE line, and it says what the account is FOR. The screen this replaces
        opened with "Selling needs a verified business account" and three
        sentences about verification being completed off-app — all true, all
        addressed to someone who has an account and is waiting on approval, and
        none of it the guest's next step. Verification is still explained, on
        the same screen, once they are signed in and it applies to them.

        ⚠️ Deliberately says "an account", not "a business account", and the
        button below goes to the app's PERSONAL signup. See the Guideline 3.1.1
        note at the top of `app/(lab)/sell/apply.tsx` before rewording this.
      */
      body: 'Register with us to list equipment, save drafts and message buyers.',
    },
    notifications: {
      title: 'Your alerts',
      body: 'Alerts about bids, offers and matches are tied to your account, so we know where to send them.',
    },
    draft: {
      title: 'Your drafts',
      body: 'Keep a draft listing and pick it up later on any device. Needs an account to save it to.',
    },
    /*
      `offer` is declared in `GateReason` but nothing passes it today — a grep
      over `src` and `app` finds the union member and no caller. Written out
      anyway because the `Record<GateReason, …>` above is TOTAL on purpose: a
      partial map is what let `sell` fall through to the Account copy for
      however long it has been shipping. If this text ever appears on screen,
      the gate that produced it is new and the wording should be checked
      against it.
    */
    offer: {
      title: 'Make an offer',
      body: 'Offers go to the seller under your name, so they know who they are dealing with.',
    },
  };
  const copy = COPY[reason] ?? COPY.account;

  return (
    <Screen scroll={false} testID={`guest-gate-${reason}`}>
      <View style={styles.wrap}>
        <Text variant="h2">
          {t(`mobile.auth.guestTab.${reason}.title`, { defaultValue: copy.title })}
        </Text>
        <Text variant="body" color="inkMuted" style={styles.body}>
          {t(`mobile.auth.guestTab.${reason}.body`, { defaultValue: copy.body })}
        </Text>

        <View style={styles.actions}>
          <PrimaryAction
            label={t('mobile.auth.gate.createAccount', { defaultValue: 'Register with us' })}
            onPress={() => router.push('/(auth)/register')}
            testID={`guest-gate-${reason}-register`}
          />
          {/*
            `tinted`, not `quiet`. Both are secondary, but this is a real
            destination for anyone who already has an account, and the kit's own
            note on `PrimaryAction` measures `quiet`'s outline at 1.27:1 in
            light — under the 3:1 WCAG 1.4.11 asks of a control boundary, so the
            pill is not actually perceivable.
          */}
          <PrimaryAction
            label={t('mobile.auth.gate.signIn', { defaultValue: 'I already have an account' })}
            onPress={() => router.push('/(auth)/login')}
            variant="tinted"
            testID={`guest-gate-${reason}-signin`}
          />
          {/* The way OUT. A guest who lands here must be able to get back to the
              part of the app that needs no account, or this is a wall again. */}
          <QuietAction
            label={t('mobile.auth.guestTab.browse', { defaultValue: 'Browse equipment instead' })}
            onPress={() => router.replace('/(lab)/(tabs)/browse')}
            align="center"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /*
    Top-aligned, not vertically centred. The previous version used
    `justifyContent: 'center'`, which floats the title in the middle of the
    screen and leaves the eye no starting point — and at the largest text size
    the block ran off both ends. `EmptyState` in the kit documents the same
    choice.
  */
  wrap: { flex: 1, paddingHorizontal: GUTTER, paddingTop: space['5xl'] },
  body: { marginTop: space.sm, maxWidth: 420 },
  actions: { marginTop: space.xl, gap: space.sm },
});
