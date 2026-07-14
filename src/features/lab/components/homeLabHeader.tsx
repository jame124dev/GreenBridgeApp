// LabHeader — LEFT column: brand lockup (OrbitLogo tile + 101LAB / BY GREENBIDZ)
// with the LOCATION chip beneath it. RIGHT cluster (top-aligned): a LANGUAGE chip
// (globe + code) and the NOTIFICATION bell (badge + list sheet). The location
// chip self-hides (label, spinner, or nothing) so the left column height only
// grows when there's something to show.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react-native';
import { HStack } from '@/components/ui';
import { languageBadge } from '@/i18n';
import { fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { OrbitLogo } from './homeOrbitLogo';
import { LabLocationChip, LabSetLocationChip } from './LabLocationChip';
import { NotificationBell } from '@/features/lab/notifications/NotificationBell';
import type { ResolvedLocation } from '@/services/location/getDeviceLocation';


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
          <View style={styles.logoTile}>
            <OrbitLogo size={19} />
          </View>
          <View>
            <Text style={styles.wordmark}>101LAB</Text>
            <Text style={styles.byline}>BY GREENBIDZ</Text>
          </View>
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
  logoTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: fonts.headingBold,
    fontSize: 16,
    lineHeight: 16,
    color: lab.ink,
    letterSpacing: -0.32,
  },
  byline: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    lineHeight: 10,
    letterSpacing: 1.19,
    color: lab.inkSub,
    marginTop: 2,
  },
});
