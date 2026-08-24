import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/constants/theme';

import type { GateReason } from './signInPromptStore';

/**
 * What a guest sees on a tab that is genuinely account-based.
 *
 * Rendered INSTEAD OF the signed-in screen, as a sibling component — never as an
 * early return inside it. The authed screens open sockets and fire authenticated
 * queries from their hooks; an early return would either change the hook count
 * between renders (React throws once the guest signs in) or leave those hooks
 * firing 401s for someone who has no account. A wrapper keeps them unmounted.
 *
 * These three tabs are allowed to be gated: Guideline 5.1.1(v) permits requiring
 * an account for account-based features. What is NOT allowed — and what got
 * 1.0.3 (21) rejected — is gating browse and search, which stay open.
 */
export function GuestTabState({ reason }: { reason: GateReason }) {
  const { t } = useTranslation();

  const COPY: Record<string, { title: string; body: string }> = {
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
  };
  const copy = COPY[reason] ?? COPY.account;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md, paddingBottom: spacing['2xl'] }}>
        <Text variant="title">
          {t(`mobile.auth.guestTab.${reason}.title`, { defaultValue: copy.title })}
        </Text>
        <Text tone="secondary">
          {t(`mobile.auth.guestTab.${reason}.body`, { defaultValue: copy.body })}
        </Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            label={t('mobile.auth.gate.createAccount', { defaultValue: 'Create account' })}
            onPress={() => router.push('/(auth)/register')}
            fullWidth
          />
          <Button
            label={t('mobile.auth.gate.signIn', { defaultValue: 'I already have an account' })}
            onPress={() => router.push('/(auth)/login')}
            variant="secondary"
            fullWidth
          />
          {/* The way OUT. A guest who lands here must be able to get back to the
              part of the app that needs no account, or this is a wall again. */}
          <Button
            label={t('mobile.auth.guestTab.browse', { defaultValue: 'Browse equipment instead' })}
            onPress={() => router.replace('/(lab)/(tabs)/browse')}
            variant="ghost"
            fullWidth
          />
        </View>
      </View>
    </Screen>
  );
}
