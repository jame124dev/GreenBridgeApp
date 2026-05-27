import { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Platform, Animated, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

import { RecentSubmissionsList } from '@/components/scanner/RecentSubmissionsList';
import { LanguageSheet } from '@/components/ui/LanguageSheet';
import { haptics } from '@/lib/haptics';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { useAuth } from '@/stores/authStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';
import { useSellerLocation } from '@/features/location/useSellerLocation';
import { fonts } from '@/theme/typography';
import { colors } from '@/theme/colors';
import { routes } from '@/lib/routes';

// Header label per active language. Falls back to upper-case code for anything unknown.
const LANG_LABELS: Record<string, string> = { en: 'EN', zh: 'ZH', ja: 'JA', th: 'TH' };

export default function ScanHomeScreen() {
  const profile = useAuth((s) => s.profile);
  const hydrate = useScanDraft((s) => s.hydrate);
  const hydrated = useScanDraft((s) => s.hydrated);

  const recentSubmissionsQuery = useRecentSubmissions();

  const { t, i18n } = useTranslation();
  const langLabel = LANG_LABELS[i18n.language] ?? i18n.language.toUpperCase();
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  // Seller's current location for the header. Tap to detect / refresh.
  const { location, detecting, detect } = useSellerLocation();
  const onLocationPress = async () => {
    haptics.tap();
    const res = await detect();
    if (!res.ok && res.reason === 'denied') {
      Alert.alert(
        t('mobile.home.locationDeniedTitle', { defaultValue: 'Location permission needed' }),
        t('mobile.home.locationDeniedBody', {
          defaultValue: 'Enable location access in Settings so we can show your area.',
        }),
      );
    }
  };

  // Animated scale for camera icon
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Micro-interaction: Shutter camera icon pulsing animation
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  const startScan = () => {
    haptics.tap();
    if (SMART_DETECT_ENABLED) {
      // Smart-detection is the default entry: clear any abandoned session so a
      // stale grouped mode/queue can't leak in, then go straight to the camera.
      // The AI decides single-vs-multiple in Processing — no upfront picker.
      useScanDraft.getState().reset();
      router.push(routes.scanCamera);
      return;
    }
    router.push(routes.scanListingMethod);
  };

  // Manual grouped fallback ("scan items one by one") — only surfaced when
  // smart-detection owns the primary Scan button. Pre-sets grouped mode and
  // skips the picker so the seller can't accidentally re-enable smart-detect.
  const startManualGrouped = () => {
    haptics.tap();
    const store = useScanDraft.getState();
    store.reset();
    store.setListingMode('grouped');
    router.push(routes.scanCamera);
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 1).toUpperCase();
  };

  if (!hydrated) return null;
  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* App Bar Header — top row: [location block] | [lang + avatar];
          bottom row: [STAFF chip] + greeting inline. */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          {/* Current location — tap to detect / refresh. */}
          <Pressable
            onPress={onLocationPress}
            disabled={detecting}
            style={styles.locationBlock}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.home.locationA11y', {
              defaultValue: 'Your location, tap to update',
            })}
          >
            <View style={styles.locationTopLine}>
              <MaterialIcons name="location-on" size={18} color={colors.primary} />
              <Text style={styles.locationCity} numberOfLines={1}>
                {location?.label ||
                  t('mobile.home.locationSet', { defaultValue: 'Set location' })}
              </Text>
              {detecting ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 2 }} />
              ) : null}
            </View>
            <Text style={styles.locationSub} numberOfLines={1}>
              {location?.address ||
                location?.country ||
                t('mobile.home.locationTapHint', { defaultValue: 'Tap to detect your area' })}
            </Text>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => setLangSheetOpen(true)}
              style={styles.langButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t('mobile.home.languageTitle')}, ${langLabel}`}
            >
              <Text style={styles.langButtonText}>🌐 {langLabel} ▼</Text>
            </Pressable>
            <Pressable
              style={styles.avatarContainer}
              onPress={() => router.push(routes.profile)}
              accessibilityRole="button"
              accessibilityLabel={`Profile, ${profile.name}`}
            >
              <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.greetingRow}>
          <View style={styles.staffChipPill}>
            <Text style={styles.staffChipLabel}>STAFF</Text>
          </View>
          <Text style={styles.staffChipCode}>M{String(profile.id).padStart(3, '0')}</Text>
          <Text style={styles.greeting} numberOfLines={1}>
            Hi, <Text style={styles.greetingName}>{profile.name.split(' ')[0]}</Text>.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Compact Vertical Scan Card matching reference design */}
        <Pressable
          onPress={startScan}
          accessibilityRole="button"
          accessibilityLabel="Scan and upload equipment"
          style={({ pressed }) => [
            styles.scanCardContainer,
            pressed && styles.scanCardPressed
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanCard}
          >
            <Animated.View style={[styles.scanCardIconWrap, { transform: [{ scale: pulseAnim }] }]}>
              <Camera color="#ffffff" size={26} strokeWidth={2} />
            </Animated.View>
            <Text style={styles.scanCardTitle}>{t('mobile.home.scanTitle')}</Text>
            <Text style={styles.scanCardSubtitle}>
              {t('mobile.home.scanSubtitle')}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Manual grouped fallback — only when smart-detection owns the Scan
            button. Pre-sets grouped mode and opens the camera (no picker). */}
        {SMART_DETECT_ENABLED ? (
          <Pressable
            onPress={startManualGrouped}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.manualGroupedLink}
          >
            <Text style={styles.manualGroupedText}>
              {t('mobile.home.scanOneByOne')}
            </Text>
          </Pressable>
        ) : null}

        {/* Recent Submissions List Feed */}
        <RecentSubmissionsList query={recentSubmissionsQuery} />
      </ScrollView>

      <LanguageSheet visible={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.01)' },
    }),
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationBlock: { flex: 1, gap: 1 },
  locationTopLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationCity: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#0f172a',
    flexShrink: 1,
  },
  locationSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#64748b',
    marginLeft: 21,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  staffChipPill: {
    backgroundColor: '#eef2f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  staffChipLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: '#475569',
  },
  staffChipCode: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: '#14452f',
  },
  // Online/offline indicator that sits next to the STAFF chip
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillOnline: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  statusPillOffline: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusDotOnline: { backgroundColor: '#15803d' },
  statusDotOffline: { backgroundColor: '#dc2626' },
  statusText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  statusTextOnline: { color: '#15803d' },
  statusTextOffline: { color: '#b91c1c' },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#14452f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#14452f',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 4px rgba(10,74,47,0.1)' },
    }),
  },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#ffffff',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  greeting: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: '#475569',
    flexShrink: 1,
  },
  greetingName: {
    fontFamily: fonts.bold,
    color: '#0f172a',
  },
  langButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  langButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: '#334155',
    letterSpacing: 0.2,
  },
  scanCardContainer: {
    marginTop: 4,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#14452f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 5 },
      web: { boxShadow: '0 6px 16px rgba(10, 74, 47, 0.14)' },
    }),
  },
  scanCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }],
  },
  scanCard: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scanCardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  scanCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  scanCardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  manualGroupedLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  manualGroupedText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'center',
  },
});



