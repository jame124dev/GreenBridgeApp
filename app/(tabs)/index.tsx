import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Camera, MapPin, Globe } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'react-native-css-interop';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { toast } from 'sonner-native';

cssInterop(LinearGradient, {
  className: 'style',
});

import { Screen, Text, LanguageSheet } from '@/components/ui';
import { RecentSubmissionsList } from '@/components/scanner/RecentSubmissionsList';
import { haptics } from '@/lib/haptics';
import { SMART_DETECT_ENABLED } from '@/lib/flags';
import { useAuth } from '@/stores/authStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { useSellerLocation } from '@/features/location/useSellerLocation';
import { routes } from '@/lib/routes';
import { languageBadge } from '@/i18n';


export default function ScanHomeScreen() {
  const profile = useAuth((s) => s.profile);
  const hydrate = useScanDraft((s) => s.hydrate);
  const hydrated = useScanDraft((s) => s.hydrated);

  const { t, i18n } = useTranslation();
  const langLabel = languageBadge(i18n.language);
  const [langSheetOpen, setLangSheetOpen] = useState(false);

  const { location, detecting, detect } = useSellerLocation();

  const onLocationPress = async () => {
    haptics.tap();
    const res = await detect();
    if (!res.ok && res.reason === 'denied') {
      toast.error(
        t('mobile.home.locationDeniedBody', {
          defaultValue: 'Enable location access in Settings so we can show your area.',
        })
      );
    }
  };

  const scale = useSharedValue(1);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const startScan = () => {
    haptics.tap();
    // Flush-always: each Scan tap is a fresh session. Any in-progress draft,
    // queued grouped items, and warm `pendingDetection` are reset. The dedicated
    // drafts surface (planned) will be the only way to resume saved work — for
    // now, Scan = new scan, no resume. `getScanResumeRoute` is kept in
    // `scanResume.ts` so the drafts surface can reuse the precedence tree.
    useScanDraft.getState().reset();
    if (SMART_DETECT_ENABLED) {
      router.push(routes.scanCamera);
      return;
    }
    router.push(routes.scanListingMethod);
  };

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

  if (!hydrated || !profile) return null;

  return (
    <Screen padded={false} scroll={false} edges={['top']}>
      {/* App Bar Header */}
      <View className="px-lg pt-sm pb-md bg-white border-b border-neutral-100 shadow-sm gap-md">
        <View className="flex-row items-center justify-between gap-sm">
          {/* Current location */}
          <Pressable
            onPress={onLocationPress}
            disabled={detecting}
            className="flex-1 gap-[1px] active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.home.locationA11y', {
              defaultValue: 'Your location, tap to update',
            })}
          >
            <View className="flex-row items-center gap-xs">
              <MapPin size={18} color="#10B981" />
              <Text variant="bodyMd" tone="primary" className="font-bold flex-shrink" numberOfLines={1}>
                {location?.label || t('mobile.home.locationSet', { defaultValue: 'Set location' })}
              </Text>
              {detecting && (
                <View className="ml-xs">
                  <ActivityIndicator size="small" color="#10B981" />
                </View>
              )}
            </View>
            <Text variant="caption" tone="tertiary" className="ml-[21px]" numberOfLines={1}>
              {location?.address ||
                location?.country ||
                t('mobile.home.locationTapHint', { defaultValue: 'Tap to detect your area' })}
            </Text>
          </Pressable>

          {/* Header Actions */}
          <View className="flex-row items-center gap-sm flex-shrink-0">
            <Pressable
              onPress={() => setLangSheetOpen(true)}
              className="bg-neutral-100 border border-neutral-200 rounded-xl px-md py-xs flex-row items-center gap-xs active:bg-neutral-200"
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${t('mobile.home.languageTitle')}, ${langLabel}`}
            >
              <Globe size={14} color="#4B5563" />
              <Text variant="bodySm" tone="secondary" className="font-semibold">
                {langLabel}
              </Text>
            </Pressable>
            <Pressable
              className="w-9 h-9 rounded-full bg-primary-900 justify-center items-center border border-neutral-200 shadow-sm active:opacity-80"
              onPress={() => router.push(routes.profile)}
              accessibilityRole="button"
              accessibilityLabel={`Profile, ${profile.name}`}
            >
              <Text variant="caption" tone="inverse" className="font-semibold text-[13px]">
                {getInitials(profile.name)}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Greeting Row */}
        <View className="flex-row items-center gap-xs">
          <View className="bg-neutral-100 px-sm py-[2px] rounded">
            <Text variant="caption" tone="secondary" className="font-bold tracking-wider text-[10px]">
              STAFF
            </Text>
          </View>
          <Text variant="caption" tone="brand" className="font-bold tracking-wider text-[10px] text-primary-800">
            M{String(profile.id).padStart(3, '0')}
          </Text>
          <Text variant="body" tone="secondary" className="flex-shrink" numberOfLines={1}>
            Hi,{' '}
            <Text variant="body" className="font-bold text-neutral-900">
              {profile.name.split(' ')[0]}
            </Text>
            .
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-xl pt-md pb-2xl">
        {/* Compact Vertical Scan Card */}
        <Pressable
          onPress={startScan}
          accessibilityRole="button"
          accessibilityLabel="Scan and upload equipment"
          className="mt-xs rounded-2xl overflow-hidden shadow-md active:scale-[0.985] active:opacity-95"
        >
          <LinearGradient
            colors={['#14452f', '#236b48']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="py-2xl px-xl items-center"
          >
            <Animated.View
              style={animatedStyle}
              className="w-14 h-14 rounded-2xl bg-white/10 items-center justify-center mb-md border border-white/20"
            >
              <Camera color="#ffffff" size={26} strokeWidth={2} />
            </Animated.View>
            <Text variant="title" tone="inverse" className="font-bold tracking-tight">
              {t('mobile.home.scanTitle')}
            </Text>
            <Text variant="bodySm" tone="inverse" className="mt-xs text-center opacity-90 px-lg">
              {t('mobile.home.scanSubtitle')}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Manual grouped fallback */}
        {SMART_DETECT_ENABLED && (
          <Pressable
            onPress={startManualGrouped}
            hitSlop={8}
            accessibilityRole="button"
            className="self-center py-md mt-xs active:opacity-80"
          >
            <Text variant="bodySm" tone="brand" className="font-semibold text-center">
              {t('mobile.home.scanOneByOne')}
            </Text>
          </Pressable>
        )}

        {/* Recent Submissions List Feed */}
        <RecentSubmissionsList />
      </ScrollView>

      <LanguageSheet visible={langSheetOpen} onClose={() => setLangSheetOpen(false)} />
    </Screen>
  );
}
