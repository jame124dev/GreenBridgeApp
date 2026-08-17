// LabHeader — LEFT column: the GreenBidz brand logo with the LOCATION chip
// beneath it. RIGHT cluster (top-aligned): a LANGUAGE chip (globe + code) and the
// NOTIFICATION bell (badge + list sheet). The location chip self-hides (label,
// spinner, or nothing) so the left column height only grows when there's
// something to show.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react-native';
import { HStack } from '@/components/ui';
import { languageBadge } from '@/i18n';
import { fonts, lab, radius, spacing } from '@/constants/theme';
import { getBranding } from '@/theme/branding';
import { LabLocationChip, LabSetLocationChip } from './LabLocationChip';
import { NotificationBell } from '@/features/lab/notifications/NotificationBell';
import type { ResolvedLocation } from '@/services/location/getDeviceLocation';

// The app ships as GreenBidz, so the header shows the GreenBidz logo. It used to
// be a hand-built lockup — an orbit tile plus the words "101LAB" / "BY GREENBIDZ"
// — which named a single marketplace rather than the umbrella brand the app is
// published under. `getBranding()` already resolves the right asset per SITE_TYPE
// (and carries the 101IT / 101machine variants); the header simply wasn't using it.
const branding = getBranding();

// Rendered at a fixed height with the width derived from the asset's own 2.81:1
// ratio, so the wordmark can't stretch and the right-hand cluster keeps its room.
const LOGO_HEIGHT = 30;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * (branding.logoWidth / branding.logoHeight));


type Props = {
  /** Open the language picker (LanguageSheet). Omit to hide the language chip. */
  onLanguagePress?: () => void;
  /** Location cluster (optional — omit to render the header without a chip). */
  location?: {
    value: ResolvedLocation | null;
    detecting: boolean;
    onPress: () => void;
    showSetLocation?: boolean;
  };
};

export function LabHeader({ onLanguagePress, location }: Props) {
  const { t, i18n } = useTranslation();
  const langLabel = languageBadge(i18n.language);

  const hasLocationCache = Boolean(location?.value?.label?.trim());
  const showSet =
    Boolean(location) &&
    Boolean(location?.showSetLocation) &&
    !hasLocationCache &&
    !location?.detecting;

  return (
    <HStack justify="space-between" align="flex-start" style={styles.row}>
      {/* Left column — brand lockup with the location chip beneath it. */}
      <View style={styles.leftCol}>
        <HStack align="center" style={styles.lockup}>
          <Image
            source={branding.logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={branding.logoLabel}
          />
        </HStack>

        {location ? (
          <View style={styles.locationBelow}>
            {showSet ? (
              <LabSetLocationChip detecting={location.detecting} onPress={location.onPress} />
            ) : (
              <LabLocationChip
                location={location.value}
                detecting={location.detecting}
                onPress={location.onPress}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* Right cluster — language chip + notification bell (top-aligned). */}
      <HStack align="center" style={styles.rightCluster}>
        {onLanguagePress ? (
          <Pressable
            onPress={onLanguagePress}
            style={styles.langChip}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${t('mobile.home.languageTitle')}, ${langLabel}`}
          >
            <Globe size={13} color={lab.inkSub} />
            <Text style={styles.langText}>{langLabel}</Text>
          </Pressable>
        ) : null}

        <NotificationBell />
      </HStack>
    </HStack>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: spacing['2xl'] }, // 24
  leftCol: { flexShrink: 1 },
  lockup: { gap: spacing.sm }, // 8
  locationBelow: { marginTop: spacing.md, alignSelf: 'flex-start' }, // 12 — chip sits under the lockup
  rightCluster: { gap: spacing.sm, flexShrink: 0 },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: lab.pillBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md, // 12
    paddingVertical: spacing.xs, // 4
  },
  langText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: lab.inkSub,
    letterSpacing: 0.5,
  },
  logo: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
});
