// Quiet entry point to the delete-account flow.
//
// Deliberately a low-emphasis text link, NOT a second red button: the Security
// section already ends in a full-width destructive "Sign out", and two equally
// loud destructive controls would break both the one-primary-action and the
// no-duplicate-controls rules in UX_DESIGN_RULES.md. The weight of the decision
// belongs on the confirm screen, not on this row.
//
// Lives in features/settings so the seller fork's app/(tabs)/profile.tsx can
// adopt it in one line.
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';

export function DeleteAccountLink() {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push('/(lab)/account/delete' as unknown as Href);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('mobile.deleteAccount.link')}
      testID="delete-account-link"
      className="items-center py-md"
      hitSlop={8}
    >
      <Text variant="caption" tone="tertiary" className="underline">
        {t('mobile.deleteAccount.link')}
      </Text>
    </Pressable>
  );
}
