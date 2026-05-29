import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Layers, Package } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen, Stack, Text } from '@/components/ui';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type ListingMode } from '@/stores/scanDraftStore';
import { brand } from '@/constants/theme';

/**
 * Listing-method picker — Single vs Grouped. The two method cards are a custom
 * page composition (icon disc + title + description in a tall card), so they
 * stay page-local rather than forcing them into the generic `<Card>` primitive.
 *
 * S6.2.b1 — StyleSheet block removed. Pressable kept its `({ pressed })` style
 * callback for the `opacity-90` pressed feedback (same exception pattern as
 * DetectionGroupCard in S6.2.a — className doesn't compose with the callback).
 */
function MethodCard({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
      className="bg-brand-surface rounded-xl border border-brand-border p-xl"
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View className="w-12 h-12 rounded-full bg-brand-primary-surface items-center justify-center mb-md">
        {icon}
      </View>
      <Text variant="title" className="font-semi">
        {title}
      </Text>
      <Text variant="bodyMd" tone="tertiary" className="mt-xs leading-6">
        {description}
      </Text>
    </Pressable>
  );
}

export default function ListingMethodScreen() {
  const { t } = useTranslation();
  const setListingMode = useScanDraft((s) => s.setListingMode);

  const choose = (mode: ListingMode) => {
    setListingMode(mode);
    router.push(routes.scanCamera);
  };

  return (
    <Screen>
      <Pressable
        className="mt-sm self-start"
        onPress={() => safeBack()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
      >
        <ChevronLeft color={brand.foreground} size={24} />
      </Pressable>

      <View className="mt-md mb-2xl">
        <Stack gap="md">
          <Text variant="hero">{t('mobile.listingMethod.heading')}</Text>
          <Text variant="bodyMd" tone="tertiary">
            {t('mobile.listingMethod.subtitle')}
          </Text>
        </Stack>
      </View>

      <Stack gap="3xl">
        <MethodCard
          title={t('mobile.listingMethod.singleTitle')}
          description={t('mobile.listingMethod.singleDesc')}
          icon={<Package color={brand.primary} size={28} />}
          onPress={() => choose('single')}
        />

        <MethodCard
          title={t('mobile.listingMethod.groupedTitle')}
          description={t('mobile.listingMethod.groupedDesc')}
          icon={<Layers color={brand.primary} size={28} />}
          onPress={() => choose('grouped')}
        />
      </Stack>
    </Screen>
  );
}
