import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Layers, Package } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen, Stack } from '@/components/ui';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { useScanDraft, type ListingMode } from '@/stores/scanDraftStore';
import { colors, fonts, fontSize, lineHeight, radius, spacing } from '@/theme';

// Listing-method picker — Single vs Grouped. The two method cards are a custom
// page composition (icon disc + title + description in a tall card), so they
// stay page-local rather than forcing them into the generic <Card> primitive.

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
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <View style={styles.cardIcon}>{icon}</View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{description}</Text>
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
      <Pressable style={styles.back} onPress={() => safeBack()} hitSlop={12}>
        <ChevronLeft color={colors.foreground} size={24} />
      </Pressable>

      <Stack gap="md" style={styles.header}>
        <Text style={styles.title}>{t('mobile.listingMethod.heading')}</Text>
        <Text style={styles.subtitle}>{t('mobile.listingMethod.subtitle')}</Text>
      </Stack>

      <Stack gap="3xl">
        <MethodCard
          title={t('mobile.listingMethod.singleTitle')}
          description={t('mobile.listingMethod.singleDesc')}
          icon={<Package color={colors.primary} size={28} />}
          onPress={() => choose('single')}
        />

        <MethodCard
          title={t('mobile.listingMethod.groupedTitle')}
          description={t('mobile.listingMethod.groupedDesc')}
          icon={<Layers color={colors.primary} size={28} />}
          onPress={() => choose('grouped')}
        />
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: spacing.md, alignSelf: 'flex-start' },
  header: { marginTop: spacing['3xl'], marginBottom: spacing['6xl'] },
  title: { fontFamily: fonts.heading, fontSize: fontSize['6xl'], color: colors.foreground },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.xl, color: colors.mutedForeground },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['5xl'],
  },
  cardPressed: { opacity: 0.9 },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  cardTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSize['3xl'], color: colors.foreground },
  cardDesc: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    lineHeight: lineHeight.normal,
  },
});
