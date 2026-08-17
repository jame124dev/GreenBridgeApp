import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import type { MarketplaceKey } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

/**
 * Marketplace is NOT editable in v1.
 *
 * `MarketplaceCard` renders nothing at all (it is locked to the deployment's
 * site type), so a seller looking for "which marketplace is this on?" finds an
 * absence. An absence reads as an oversight; a lock reads as a decision. This
 * shows the value, the padlock and the reason — and there is no duplicate
 * control, because the real picker is not on screen.
 */
export function LockedMarketplaceRow({ marketplace }: { marketplace: MarketplaceKey }) {
  const { t } = useTranslation();
  const label =
    MARKETPLACE_OPTIONS.find((o) => o.value === marketplace)?.label ?? marketplace.toUpperCase();

  return (
    <View
      className="bg-brand-surface-muted border border-brand-border rounded-sm p-2xl gap-xs"
      accessibilityRole="summary"
      accessibilityLabel={t('mobile.listingEdit.marketplaceLockedA11y', { marketplace: label })}
    >
      <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
        <Text variant="caption" tone="secondary" className="font-bold uppercase tracking-wider">
          {t('mobile.listingEdit.marketplaceLabel')}
        </Text>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <MaterialIcons name="lock-outline" size={14} color={brand.mutedForeground} />
          <Text variant="caption" tone="tertiary" className="font-semi">
            {t('mobile.listingEdit.lockedTag')}
          </Text>
        </View>
      </View>
      <Text variant="bodyMd" tone="primary">
        {label}
      </Text>
      <Text variant="bodySm" tone="tertiary">
        {t('mobile.listingEdit.marketplaceLockedHint')}
      </Text>
    </View>
  );
}
