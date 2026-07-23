import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Linking, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Check,
  Clock,
  FileCheck,
  FileText,
  Hourglass,
  Lock,
  Mail,
  MailCheck,
  PartyPopper,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';

import { useLogout } from '@/features/auth/useLogout';
import { useRecheckApproval } from '@/features/auth/useLogin';
import { deriveApprovalChecklist, type StepKey, type StepState } from '@/features/auth/approvalChecklist';
import { LoginError, type ApprovalStateExtra } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';
import { haptics } from '@/lib/haptics';

// ── brand palette (the app renders light-only — app.config userInterfaceStyle) ──
const FOREST_DEEP = '#0f3a27';
const FOREST = '#14452f';
const FOREST_MID = '#236b48';
const LEAF = '#34d399';
const OK = '#16a34a';
const AMBER = '#e08a12';
const INK = '#0e1b14';
const SUB = '#55665e';
const FAINT = '#93a49b';
const LINE = '#e6ede9';
const CARD_ALT = '#f5f9f7';

// ── animated hero bits ──────────────────────────────────────────────────────
function Ripple({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }), -1, false));
  }, [delay, p]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: 0.5 + p.value * 0.95 }], opacity: 0.5 * (1 - p.value) }));
  return <Animated.View pointerEvents="none" style={[styles.ripple, s]} />;
}

function PulseRing({ color }: { color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.5 }], opacity: 0.7 * (1 - p.value) }));
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { borderColor: color }, s]} />;
}

// ── per-step presentation (icon + copy), keyed by state ──────────────────────
type StepMeta = { Icon: LucideIcon; title: string; sub: string; tag: string };

function stepMeta(key: StepKey, state: StepState, t: (k: string, o?: { defaultValue?: string }) => string): StepMeta {
  const d = (k: string, dv: string) => t(`mobile.auth.pending.steps.${k}`, { defaultValue: dv });
  switch (key) {
    case 'account':
      return { Icon: UserCheck, title: d('accountTitle', 'Account created'), sub: d('accountSub', 'Welcome to GreenBidz'), tag: d('tagDone', 'Done') };
    case 'email':
      return state === 'done'
        ? { Icon: MailCheck, title: d('emailTitle', 'Email verified'), sub: d('emailSubDone', 'Your email is confirmed'), tag: d('tagVerified', 'Verified') }
        : { Icon: Mail, title: d('emailTitleAction', 'Verify your email'), sub: d('emailSubAction', 'Tap the link we emailed you'), tag: d('tagAction', 'Action') };
    case 'documents':
      return state === 'done'
        ? { Icon: FileCheck, title: d('docsTitle', 'Business documents'), sub: d('docsSubDone', 'Registration received'), tag: d('tagReceived', 'Received') }
        : { Icon: FileText, title: d('docsTitleAction', 'Upload business documents'), sub: d('docsSubAction', 'Business registration required'), tag: d('tagRequired', 'Required') };
    case 'review':
    default:
      if (state === 'done') return { Icon: ShieldCheck, title: d('reviewTitle', 'Admin review'), sub: d('reviewSubDone', 'Approved by our team'), tag: d('tagApproved', 'Approved') };
      if (state === 'wait') return { Icon: Lock, title: d('reviewTitle', 'Admin review'), sub: d('reviewSubWait', 'Unlocks after the steps above'), tag: d('tagWaiting', 'Waiting') };
      return { Icon: Clock, title: d('reviewTitle', 'Admin review'), sub: d('reviewSubReview', 'Usually within 1 business day'), tag: d('tagInReview', 'In review') };
  }
}

const MEDALLION: Record<StepState, { bg: string; fg: string; border: string }> = {
  done: { bg: 'rgba(22,163,74,0.12)', fg: OK, border: 'rgba(22,163,74,0.28)' },
  review: { bg: 'rgba(224,138,18,0.14)', fg: AMBER, border: 'rgba(224,138,18,0.32)' },
  action: { bg: 'rgba(224,138,18,0.14)', fg: AMBER, border: 'rgba(224,138,18,0.32)' },
  wait: { bg: CARD_ALT, fg: FAINT, border: LINE },
};

export default function PendingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const logoutMut = useLogout();
  const recheck = useRecheckApproval();
  const approval = useAuth((s) => s.approval);
  const setApproval = useAuth((s) => s.setApproval);
  const [notApprovedYet, setNotApprovedYet] = useState(false);

  const checklist = useMemo(() => deriveApprovalChecklist(approval), [approval]);
  const { overall, steps, doneCount, totalCount } = checklist;

  const check = useCallback(() => {
    if (recheck.isPending) return;
    setNotApprovedYet(false);
    recheck.mutate(undefined, {
      onSuccess: () => haptics.success(), // AuthGuard routes into the app
      onError: (err) => {
        if (err instanceof LoginError && err.code === 'ACCOUNT_PENDING') {
          // Refresh the checklist with the latest server state, stay on screen.
          const next = (err.extra as ApprovalStateExtra | undefined)?.approval;
          if (next) setApproval(next);
          setNotApprovedYet(true);
        } else {
          haptics.error();
        }
      },
    });
  }, [recheck, setApproval]);

  // Auto-check once on open — an approval granted while the app was closed
  // drops the seller straight in.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    check();
  }, [check]);

  const handleSignOut = () =>
    logoutMut.mutate(undefined, { onSuccess: () => router.replace('/(auth)/login') });

  const checking = recheck.isPending;

  // Hero copy + emblem by overall mood.
  const hero =
    overall === 'approved'
      ? { Emblem: PartyPopper, chip: t('mobile.auth.pending.chipApproved', { defaultValue: 'Approved — welcome!' }), chipAmber: false,
          title: t('mobile.auth.pending.titleApproved', { defaultValue: 'You’re approved 🎉' }),
          sub: t('mobile.auth.pending.subApproved', { defaultValue: 'Everything checks out. Taking you into GreenBidz…' }) }
      : overall === 'action'
      ? { Emblem: TriangleAlert, chip: t('mobile.auth.pending.chipAction', { defaultValue: 'Action needed' }), chipAmber: true,
          title: t('mobile.auth.pending.titleAction', { defaultValue: 'A few steps to finish' }),
          sub: t('mobile.auth.pending.subAction', { defaultValue: 'Complete the highlighted items below and your account goes to review automatically.' }) }
      : { Emblem: Hourglass, chip: t('mobile.auth.pending.chipReview', { defaultValue: 'Under review' }), chipAmber: true,
          title: t('mobile.auth.pending.titleReview', { defaultValue: 'Almost there' }),
          sub: t('mobile.auth.pending.subReview', { defaultValue: 'Your account is with our team for a final check. Hang tight — we’ll let you in automatically.' }) };

  // Breathing core.
  const breathe = useSharedValue(0);
  useEffect(() => {
    breathe.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breathe]);
  const coreStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * breathe.value }, { scale: 1 + 0.03 * breathe.value }] }));

  // Rotating processing ring (hidden once approved).
  const rot = useSharedValue(0);
  useEffect(() => {
    rot.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, [rot]);
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 360}deg` }] }));

  const HeroIcon = hero.Emblem;

  return (
    <View style={styles.root}>
      {/* Dark forest hero → light status-bar icons; top pad follows the notch. */}
      <StatusBar style="light" />
      <LinearGradient colors={[FOREST_MID, FOREST, FOREST_DEEP]} style={[styles.hero, { paddingTop: insets.top + 24 }]}>
        <View style={styles.emblem}>
          <Ripple delay={0} />
          <Ripple delay={1000} />
          <Ripple delay={2000} />
          {overall !== 'approved' ? <Animated.View pointerEvents="none" style={[styles.spinRing, ringStyle]} /> : null}
          <Animated.View style={[styles.core, coreStyle]}>
            <HeroIcon size={38} color={FOREST} strokeWidth={2.1} />
          </Animated.View>
        </View>

        <View style={[styles.chip, hero.chipAmber ? null : styles.chipOk]}>
          {overall !== 'approved' ? (
            <View style={styles.chipDotWrap}>
              <PulseRing color="#ffd27a" />
              <View style={styles.chipDot} />
            </View>
          ) : (
            <Check size={13} color="#eafff4" strokeWidth={3} />
          )}
          <Text style={styles.chipText}>{hero.chip}</Text>
        </View>

        <Text style={styles.heroTitle}>{hero.title}</Text>
        <Text style={styles.heroSub}>{hero.sub}</Text>
      </LinearGradient>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{t('mobile.auth.pending.checklist', { defaultValue: 'APPROVAL CHECKLIST' })}</Text>
            <View style={styles.count}>
              <Text style={styles.countText}>
                {t('mobile.auth.pending.count', { defaultValue: `${doneCount} of ${totalCount} done`, done: doneCount, total: totalCount })}
              </Text>
            </View>
          </View>

          <View style={styles.steps}>
            <View style={styles.rail} />
            {steps.map((step) => {
              const meta = stepMeta(step.key, step.state, t);
              const med = MEDALLION[step.state];
              const StepIcon = step.state === 'done' ? Check : meta.Icon;
              return (
                <View key={step.key} style={styles.step}>
                  <View style={[styles.medal, { backgroundColor: med.bg, borderColor: med.border }]}>
                    {step.state === 'review' ? <PulseRing color={med.border} /> : null}
                    <StepIcon size={19} color={med.fg} strokeWidth={2.3} />
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle} numberOfLines={1}>{meta.title}</Text>
                    <Text style={styles.stepSub} numberOfLines={2}>{meta.sub}</Text>
                  </View>
                  <View style={[styles.tag, tagStyle(step.state)]}>
                    <Text style={[styles.tagText, tagTextStyle(step.state)]}>{meta.tag}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {notApprovedYet && overall !== 'action' ? (
            <Text style={styles.note}>
              {t('mobile.auth.pending.notApprovedYet', {
                defaultValue: "Not approved yet — we'll let you in the moment an admin approves your account.",
              })}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <View style={styles.hintRow}>
              <View style={styles.live} />
              <Text style={styles.hintText}>
                {t('mobile.auth.pending.autoHint', { defaultValue: 'Auto-checking every time you open the app' })}
              </Text>
            </View>

            <Pressable
              onPress={check}
              disabled={checking}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <RefreshCw size={18} color="#fff" strokeWidth={2.4} />
              <Text style={styles.btnPrimaryText}>
                {checking
                  ? t('mobile.auth.pending.checking', { defaultValue: 'Checking…' })
                  : t('mobile.auth.pending.checkStatus', { defaultValue: 'Check approval status' })}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => Linking.openURL('https://greenbidz.com/dashboard/settings')}
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecondaryText}>
                {overall === 'action'
                  ? t('mobile.auth.pending.completeOnSite', { defaultValue: 'Complete on website' })
                  : t('mobile.auth.pending.openSite', { defaultValue: 'Open website' })}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSignOut}
              disabled={logoutMut.isPending}
              style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.btnGhostText}>
                {logoutMut.isPending
                  ? t('mobile.auth.pending.signingOut', { defaultValue: 'Signing out…' })
                  : t('mobile.auth.pending.signOut', { defaultValue: 'Sign out' })}
              </Text>
            </Pressable>
          </View>

          <SafeAreaView edges={['bottom']} />
        </ScrollView>
      </View>
    </View>
  );
}

function tagStyle(state: StepState) {
  if (state === 'done') return { backgroundColor: 'rgba(22,163,74,0.12)' };
  if (state === 'action') return { backgroundColor: AMBER };
  if (state === 'review') return { backgroundColor: 'rgba(224,138,18,0.14)' };
  return { backgroundColor: CARD_ALT };
}
function tagTextStyle(state: StepState) {
  if (state === 'done') return { color: OK };
  if (state === 'action') return { color: '#fff' };
  if (state === 'review') return { color: AMBER };
  return { color: FAINT };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  hero: { paddingTop: 78, paddingBottom: 70, paddingHorizontal: 24, alignItems: 'center' },
  emblem: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ripple: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1.5, borderColor: 'rgba(190,255,224,0.5)' },
  spinRing: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 4, borderColor: 'rgba(255,255,255,0.12)', borderTopColor: LEAF },
  core: {
    width: 82, height: 82, borderRadius: 26, backgroundColor: '#eafff5', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: 'rgba(9,30,20,0.34)', borderWidth: 1, borderColor: 'rgba(190,255,224,0.28)',
  },
  chipOk: { backgroundColor: 'rgba(22,163,74,0.35)', borderColor: 'rgba(190,255,224,0.4)' },
  chipDotWrap: { width: 9, height: 9, alignItems: 'center', justifyContent: 'center' },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffd27a' },
  chipText: { color: '#eafff4', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginTop: 20, textAlign: 'center' },
  heroSub: { color: '#d6efe1', fontSize: 14.5, lineHeight: 21, marginTop: 8, textAlign: 'center', maxWidth: 320 },

  sheet: { flex: 1, backgroundColor: '#fff', marginTop: -26, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetContent: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 10, flexGrow: 1 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 12.5, letterSpacing: 1.6, color: FAINT, fontWeight: '800' },
  count: { backgroundColor: 'rgba(35,107,72,0.12)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  countText: { fontSize: 11.5, fontWeight: '800', color: FOREST_MID, letterSpacing: 0.3 },

  steps: { marginTop: 14, position: 'relative' },
  rail: { position: 'absolute', left: 17, top: 36, bottom: 36, width: 2, backgroundColor: LINE },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11 },
  medal: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 36, height: 36, borderRadius: 14, borderWidth: 2 },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 15, fontWeight: '700', color: INK, letterSpacing: -0.1 },
  stepSub: { fontSize: 12.5, color: SUB, marginTop: 2, lineHeight: 17 },
  tag: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  tagText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  note: { marginTop: 10, fontSize: 12.5, lineHeight: 18, color: SUB },

  actions: { marginTop: 'auto', paddingTop: 18, gap: 11 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  live: { width: 7, height: 7, borderRadius: 4, backgroundColor: OK },
  hintText: { fontSize: 12, color: FAINT },
  btn: { height: 52, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  btnPrimary: { backgroundColor: FOREST, shadowColor: FOREST, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  btnPrimaryText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: LINE },
  btnSecondaryText: { color: INK, fontSize: 15, fontWeight: '700' },
  btnGhost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: FAINT, fontSize: 14.5, fontWeight: '700' },
  pressed: { opacity: 0.9 },
});
