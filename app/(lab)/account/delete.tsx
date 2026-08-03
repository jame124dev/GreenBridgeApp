// Delete-account confirmation (App Store Guideline 5.1.1(v)).
//
// Its own screen rather than a sheet on the Account tab: UX_DESIGN_RULES.md
// requires exactly one primary action per screen, and Account ▸ Security already
// ends in a full-width destructive "Sign out". Here the single dominant action is
// "Delete my account", pinned to a sticky footer so it is never behind a scroll.
//
// `Screen scroll={false}` because Screen's own ScrollView wraps ALL children —
// a footer inside it would scroll away with the content.
import { useState } from 'react';
import { ActivityIndicator, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useDeleteAccount, useDeletionPreview } from '@/features/settings/useAccountDeletion';
import { getAccountDeletionErrorCode } from '@/services/account/accountDeletion';
import { brand, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const preview = useDeletionPreview();
  const deleteMut = useDeleteAccount();

  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const submit = () => {
    if (!password || deleteMut.isPending) return;
    setErrorKey(null);
    haptics.warning();
    deleteMut.mutate(password, {
      onSuccess: () => {
        toast.success(t('mobile.deleteAccount.success'));
        router.replace('/(auth)/login');
      },
      onError: (error) => {
        const code = getAccountDeletionErrorCode(error);
        if (code === 'INVALID_PASSWORD') {
          setErrorKey('mobile.deleteAccount.errorInvalidPassword');
        } else if (code === 'ADMIN_ACCOUNT') {
          setErrorKey('mobile.deleteAccount.errorAdminAccount');
        } else {
          setErrorKey('mobile.deleteAccount.errorNetwork');
        }
      },
    });
  };

  // Only obligations the user can act on are listed, and only when non-zero —
  // a "0 open orders" line would be noise, not information.
  const p = preview.data;
  const outstanding: string[] = [];
  if (p?.hasOutstanding) {
    if (p.liveListings > 0) {
      outstanding.push(t('mobile.deleteAccount.outstandingListings', { count: p.liveListings }));
    }
    if (p.openOrders > 0) {
      outstanding.push(t('mobile.deleteAccount.outstandingOrders', { count: p.openOrders }));
    }
    if (p.unpaidWinningBids > 0) {
      outstanding.push(t('mobile.deleteAccount.outstandingBids', { count: p.unpaidWinningBids }));
    }
  }

  return (
    <Screen scroll={false} padded={false} edges={['top']} keyboardAware>
      <ScrollView
        className="flex-1 px-lg"
        contentContainerStyle={{ paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title" className="mt-lg mb-md">
          {t('mobile.deleteAccount.title')}
        </Text>

        {/* Consequences stated before any input is asked for. */}
        <Card variant="outlined">
          <View className="p-md" style={{ gap: 6 }}>
            <Text
              variant="caption"
              tone="tertiary"
              className="font-bold uppercase tracking-widest"
            >
              {t('mobile.deleteAccount.whatHappensTitle')}
            </Text>
            <Text>{`• ${t('mobile.deleteAccount.bulletSignedOut')}`}</Text>
            <Text>{`• ${t('mobile.deleteAccount.bulletProfileErased')}`}</Text>
            <Text>{`• ${t('mobile.deleteAccount.bulletContentRemoved')}`}</Text>
            <Text>{`• ${t('mobile.deleteAccount.bulletListingsWithdrawn')}`}</Text>
            <Text variant="caption" tone="tertiary" className="mt-sm">
              {t('mobile.deleteAccount.retentionNote')}
            </Text>
          </View>
        </Card>

        {/* Adaptive to progress: an explaining loader, then the warning ONLY if
            it applies — never an empty warning box. */}
        {preview.isLoading ? (
          <View className="flex-row items-center mt-lg" style={{ gap: 8 }}>
            <ActivityIndicator color={brand.primary} />
            <Text tone="secondary">{t('mobile.deleteAccount.checking')}</Text>
          </View>
        ) : outstanding.length > 0 ? (
          <View
            className="mt-lg rounded-2xl p-md"
            style={{ backgroundColor: brand.destructiveBg }}
            accessibilityLabel={t('mobile.deleteAccount.outstandingTitle')}
          >
            <Text className="font-bold mb-xs">
              {t('mobile.deleteAccount.outstandingTitle')}
            </Text>
            {outstanding.map((line) => (
              <Text key={line}>{`• ${line}`}</Text>
            ))}
            <Text variant="caption" tone="secondary" className="mt-sm">
              {t('mobile.deleteAccount.outstandingNote')}
            </Text>
          </View>
        ) : null}

        {/* Re-authentication. */}
        <Text
          variant="caption"
          tone="tertiary"
          className="mt-xl mb-xs font-bold uppercase tracking-widest"
        >
          {t('mobile.deleteAccount.passwordLabel')}
        </Text>
        <TextInput
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            // Clear a stale "wrong password" the moment they start correcting it.
            if (errorKey) setErrorKey(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          testID="delete-account-password"
          accessibilityLabel={t('mobile.deleteAccount.passwordLabel')}
          placeholder={t('mobile.deleteAccount.passwordHint')}
          placeholderTextColor={brand.placeholder}
          className="rounded-xl px-md"
          style={{
            borderWidth: 1,
            borderColor: errorKey ? brand.destructiveStrong : brand.border,
            height: 48,
            color: brand.foreground,
          }}
        />
        {errorKey ? (
          <Text tone="danger" variant="caption" className="mt-xs" testID="delete-account-error">
            {t(errorKey)}
          </Text>
        ) : null}
      </ScrollView>

      {/* Sticky action pair. Cancel is text-weight so the screen keeps exactly
          one dominant action. */}
      <View
        className="px-lg pt-md"
        style={{
          borderTopWidth: 1,
          borderTopColor: brand.border,
          paddingBottom: insets.bottom + spacing.md,
        }}
      >
        <Button
          label={
            deleteMut.isPending
              ? t('mobile.deleteAccount.deleting')
              : t('mobile.deleteAccount.confirmCta')
          }
          onPress={submit}
          variant="danger"
          loading={deleteMut.isPending}
          disabled={!password || deleteMut.isPending}
          fullWidth
          testID="delete-account-submit"
        />
        <Button
          label={t('mobile.deleteAccount.cancel')}
          onPress={() => router.back()}
          variant="ghost"
          disabled={deleteMut.isPending}
          fullWidth
        />
      </View>
    </Screen>
  );
}
