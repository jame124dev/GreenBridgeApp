import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DraftSummary } from '@/services/drafts/draftApi';

type Props = {
  draft: DraftSummary;
  onResume: () => void;
  onDelete: () => void;
};

/**
 * Task 9 — one row in the drafts list (`app/scan/drafts.tsx`). Purely
 * presentational: no react-query, no store access. The screen owns data
 * fetching and passes plain callbacks, which keeps this trivially
 * unit-testable (no QueryClient needed — see `__tests__/DraftCard.test.tsx`).
 */
export default function DraftCard({ draft, onResume, onDelete }: Props) {
  const { t } = useTranslation();

  const flowLabel =
    draft.flow === 'ai'
      ? t('mobile.drafts.flowAi', { defaultValue: '🤖 AI' })
      : t('mobile.drafts.flowManual', { defaultValue: '✏️ Manual' });

  const itemCountLabel = t('mobile.drafts.itemCount', {
    count: draft.product_count,
    defaultValue: '{{count}} item',
    defaultValue_other: '{{count}} items',
  });

  return (
    <View className="rounded-sm border border-brand-border-strong bg-brand-surface p-lg gap-sm">
      <Text
        className="font-heading-semi text-2xl text-brand-foreground"
        numberOfLines={1}
      >
        {draft.title}
      </Text>
      <Text className="font-sans text-md text-brand-text-muted">
        {flowLabel} · {itemCountLabel}
      </Text>
      <View className="flex-row gap-xl mt-xs">
        <Pressable onPress={onResume} accessibilityRole="button" hitSlop={8}>
          <Text className="font-semi text-base text-brand-primary">
            {t('mobile.drafts.continue', { defaultValue: 'Continue' })}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={8}>
          <Text className="font-semi text-base text-brand-destructive">
            {t('mobile.drafts.delete', { defaultValue: 'Delete' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
