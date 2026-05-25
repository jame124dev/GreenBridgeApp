import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScanLine, FileText, CheckCircle2, History } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';

import { RecentSubmissionsList } from '@/components/scanner/RecentSubmissionsList';
import { getScanResumeRoute } from '@/lib/scanResume';
import { routes } from '@/lib/routes';
import { verifyScanSessionFiles } from '@/services/upload/persistPhotos';
import { useAuth } from '@/stores/authStore';
import { useScanDraft } from '@/stores/scanDraftStore';
import { getBranding } from '@/theme/branding';
import { useRecentSubmissions } from '@/features/scanner/useRecentSubmissions';

export default function ScanHomeScreen() {
  const profile = useAuth((s) => s.profile);
  const hydrate = useScanDraft((s) => s.hydrate);
  const hydrated = useScanDraft((s) => s.hydrated);
  const hasDraft = useScanDraft((s) => s.hasDraft);
  const reset = useScanDraft((s) => s.reset);

  const draft = useScanDraft((s) => s.current);
  const queuedItems = useScanDraft((s) => s.queuedItems);

  const draftCount = queuedItems.length + (draft ? 1 : 0);

  const recentSubmissionsQuery = useRecentSubmissions();
  const submissionsCount = recentSubmissionsQuery.data?.length ?? 0;

  const { logoLabel } = getBranding();
  const scrollViewRef = useRef<ScrollView>(null);

  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  // Animation values
  const pulseAnim = useMemo(() => new Animated.Value(0.4), []);
  const ringAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Monitor NetInfo
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isInternetReachable);
    });
    return () => unsubscribe();
  }, []);

  // Online dot pulse animation
  useEffect(() => {
    if (isOnline === true) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0.4);
    }
  }, [isOnline, pulseAnim]);

  // Giant scan button ring loop
  useEffect(() => {
    Animated.loop(
      Animated.timing(ringAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, [ringAnim]);

  const startScan = () => {
    if (hasDraft()) {
      Alert.alert(
        'Resume scan?',
        'You have an in-progress listing. Continue where you left off or start fresh?',
        [
          {
            text: 'Start fresh',
            style: 'destructive',
            onPress: () => {
              reset();
              router.push(routes.scanListingMethod);
            },
          },
          {
            text: 'Resume',
            onPress: async () => {
              const state = useScanDraft.getState();
              const ok = await verifyScanSessionFiles({
                current: state.current,
                queuedItems: state.queuedItems,
                pendingPhotos: state.pendingPhotos,
              });
              if (!ok) {
                Alert.alert(
                  'Draft expired',
                  'Saved photos or documents are no longer on this device. Start a new scan.',
                  [{ text: 'OK', onPress: () => reset() }],
                );
                return;
              }
              router.push(
                getScanResumeRoute({
                  mode: state.mode,
                  queuedItems: state.queuedItems,
                  current: state.current,
                }),
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }
    router.push(routes.scanListingMethod);
  };

  const handleDraftCardPress = async () => {
    if (draftCount === 0) {
      Alert.alert(
        'No drafts',
        'You have no saved drafts at the moment. Tap the scan button to start a new listing.'
      );
      return;
    }
    const state = useScanDraft.getState();
    const ok = await verifyScanSessionFiles({
      current: state.current,
      queuedItems: state.queuedItems,
      pendingPhotos: state.pendingPhotos,
    });
    if (!ok) {
      Alert.alert(
        'Draft expired',
        'Saved photos or documents are no longer on this device. Start a new scan.',
        [{ text: 'OK', onPress: () => reset() }],
      );
      return;
    }
    router.push(
      getScanResumeRoute({
        mode: state.mode,
        queuedItems: state.queuedItems,
        current: state.current,
      }),
    );
  };

  const scrollToSubmissions = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (!hydrated) return null;
  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* App Bar Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>{logoLabel}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push(routes.activityHistory)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Activity history"
          >
            <History color="#0a4a2f" size={22} />
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

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scroll}>
        {/* Welcome Text */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.greeting}>
            {getGreeting()}, {profile.name.split(' ')[0]}
          </Text>
          <Text style={styles.subtitle}>Industrial Equipment Capture</Text>
        </View>

        {/* Network Status indicator */}
        {isOnline !== null ? (
          <View style={styles.statusContainer}>
            <View style={styles.dotContainer}>
              <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
              {isOnline && (
                <Animated.View
                  style={[
                    styles.statusDotPulse,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [0.4, 1],
                        outputRange: [0.6, 0],
                      }),
                      transform: [
                        {
                          scale: pulseAnim.interpolate({
                            inputRange: [0.4, 1],
                            outputRange: [1, 2.5],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
            </View>
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        ) : null}

        {/* Giant Pulsing Scan Button */}
        <View style={styles.scanSection}>
          <View style={styles.scanButtonWrapper}>
            <Animated.View
              style={[
                styles.scanRing,
                {
                  opacity: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 0],
                  }),
                  transform: [
                    {
                      scale: ringAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.45],
                      }),
                    },
                  ],
                },
              ]}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Animated.View
              style={[
                styles.scanRing,
                {
                  opacity: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.15, 0],
                  }),
                  transform: [
                    {
                      scale: ringAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.85],
                      }),
                    },
                  ],
                },
              ]}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <Pressable
              style={styles.giantScanButton}
              onPress={startScan}
              accessibilityRole="button"
              accessibilityLabel="Scan equipment"
            >
              <ScanLine color="#ffffff" size={48} />
              <Text style={styles.scanButtonText}>TAP TO SCAN</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>
            Take nameplate & equipment photos — AI handles specs listing details.
          </Text>
        </View>

        {/* Bento Grid */}
        <View style={styles.bentoGrid}>
          <Pressable
            style={styles.bentoCard}
            onPress={handleDraftCardPress}
            accessibilityRole="button"
            accessibilityLabel={`Saved Drafts, ${draftCount} items pending`}
          >
            <View style={styles.bentoCardHeader}>
              <View style={styles.bentoIconBackground}>
                <FileText color="#0a4a2f" size={22} />
              </View>
              {draftCount > 0 ? (
                <View style={styles.badgePending}>
                  <Text style={styles.badgePendingText}>PENDING</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.bentoVal}>{draftCount}</Text>
            <Text style={styles.bentoLabel}>Saved Drafts</Text>
          </Pressable>

          <Pressable
            style={styles.bentoCard}
            onPress={scrollToSubmissions}
            accessibilityRole="button"
            accessibilityLabel={`Recent Batches, ${submissionsCount} items submitted`}
          >
            <View style={styles.bentoCardHeader}>
              <View style={styles.bentoIconBackground}>
                <CheckCircle2 color="#0a4a2f" size={22} />
              </View>
              <View style={styles.badgeSubmitted}>
                <Text style={styles.badgeSubmittedText}>SUBMITTED</Text>
              </View>
            </View>
            <Text style={styles.bentoVal}>{submissionsCount}</Text>
            <Text style={styles.bentoLabel}>Recent Batches</Text>
          </Pressable>
        </View>

        {/* Recent Submissions List Feed */}
        <RecentSubmissionsList query={recentSubmissionsQuery} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      },
    }),
  },
  logoText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: '#0f172a',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0a4a2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  welcomeContainer: {
    marginBottom: 8,
  },
  greeting: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#0f172a',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 12,
    marginBottom: 28,
  },
  dotContainer: {
    width: 8,
    height: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    position: 'relative',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotPulse: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  dotOffline: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  scanSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  scanButtonWrapper: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 20,
  },
  scanRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    borderColor: '#0a4a2f',
    backgroundColor: 'transparent',
  },
  giantScanButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#0a4a2f',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0a4a2f',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 10px 25px rgba(10, 74, 47, 0.25)',
      },
    }),
  },
  scanButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#ffffff',
    marginTop: 10,
    letterSpacing: 1.5,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  bentoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  bentoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bentoIconBackground: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePending: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#fffbeb',
  },
  badgePendingText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#b45309',
  },
  badgeSubmitted: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
  },
  badgeSubmittedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    color: '#15803d',
  },
  bentoVal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#0f172a',
  },
  bentoLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
});
