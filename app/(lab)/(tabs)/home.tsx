// (lab) Home — Gemini-first, prompt-forward composer screen.
// Top of the 101LAB flow: a calm centered column — hero mark + mode-aware
// greeting → AI composer (the visual hero) → mode toggle → fill-only prompt
// pills. Fully interactive; spec NewVersion/10-home-gemini-redesign.md §4/§5/§8/§9,
// tokens/recipes per NewVersion/00-foundation.md. Tab bar SHOWS here.
//
// The composer + a clear Send is the single entry. On Send:
//   • LAB_CHAT_ENABLED → open the first turn (useLabTurn) + navigate to the real
//     chat thread screen (/(lab)/chat) which renders the streaming reply + cards.
//   • flag OFF → keep the exact static behavior (navigate to /(lab)/processing).
// Composer mode + input are held in the shared `useComposer` store so downstream
// screens read them without prop-drilling.
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Screen, LanguageSheet } from '@/components/ui';
import {
  AiComposer,
  AttachmentChips,
  HomeRecentListings,
  HomeRecentWants,
  LabHeader,
  LabScreenBg,
  ModeToggle,
  useTabBarHeight,
} from '@/features/lab/components';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useThread } from '@/features/lab/stores/threadStore';
import { useLabTurn } from '@/features/lab/hooks/useLabTurn';
import { useAttachmentPicker } from '@/features/lab/hooks/useAttachmentPicker';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import { useSellerLocation } from '@/features/location/useSellerLocation';
import { LAB_CHAT_ENABLED } from '@/lib/flags';
import { buyBlue, fonts, greenDarkest, lab, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

export default function LabHome() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const { width } = useWindowDimensions();

  const { t } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);

  const mode = useComposer((s) => s.mode);
  const input = useComposer((s) => s.input);
  const setMode = useComposer((s) => s.setMode);
  const setInput = useComposer((s) => s.setInput);

  // Live AI turn (P1). Only exercised when LAB_CHAT_ENABLED; with the flag off
  // the handlers below keep the exact static navigate-only behavior. The hook is
  // always instantiated (Rules of Hooks) but does nothing until `start()`.
  const labTurn = useLabTurn();
  const picker = useAttachmentPicker();
  const hasAttachments = useComposer((s) => s.attachments.length > 0);

  // Location for the top-right header chip. Instantiated at the screen (mirrors
  // the seller index.tsx) so the hook's silent, permission-granted-only refresh
  // runs once per Home visit and warms the shared MMKV cache the in-chat strip
  // reads later. Unconditional (Rules of Hooks) — additive, no chat-flag gate.
  const { location, detecting, detect } = useSellerLocation();

  const onLocationPress = async () => {
    haptics.tap();
    const res = await detect();
    if (res.ok) {
      // A NEW label triggers the chip's own POP-bounce; the system success
      // haptic here marks the resolve. (denied path carries no haptic — the
      // toast is the feedback.)
      haptics.success();
    } else if (res.reason === 'denied') {
      toast.error(t('mobile.labHome.locationDeniedToast'));
    } else {
      // unavailable (stale dev-client / geocode failed) — neutral, never red.
      toast(t('mobile.labHome.locationUnavailableToast'));
    }
  };


  // Responsive hero greeting across 3 width tiers (small / regular / large).
  // Tracking scales with size (-0.035 × fontSize) so big sizes stay tight and
  // small ones aren't over-condensed — a clean type ramp, not one fixed size.
  const gSize =
    width <= 360
      ? { fontSize: 26, lineHeight: 32, letterSpacing: -0.91 }
      : width <= 400
        ? { fontSize: 29, lineHeight: 35, letterSpacing: -1.0 }
        : { fontSize: 32, lineHeight: 38, letterSpacing: -1.12 };

  const onSend = () => {
    const message = input.trim();
    if (LAB_CHAT_ENABLED) {
      // A turn is sendable with text OR staged attachments (attachments route
      // the turn to /detect/stream even with an empty message).
      if (!message && !hasAttachments) return;
      haptics.impact(); // MEDIUM — primary CTA
      // Open the first turn here (so the stream is already in flight on entry),
      // then hand off to the chat thread which renders the streaming reply.
      // `start()` reads + clears the staged attachments internally.
      useThread.getState().startTurn();
      void labTurn.start(message);
      setInput(''); // clear the composer on send (clean return on back)
      router.push({ pathname: '/(lab)/chat', params: { q: message } });
      return;
    }
    // Static path (flag off): forward state + navigate, exactly as Phase 1.
    haptics.impact();
    router.push('/(lab)/processing');
  };

  // Sell-mode photo/document uploads hand off to the native scan flow (camera →
  // AI detect → review → submit); buyer-mode uploads stay inline for image
  // search. (NewVersion/12 §4 — reuse seller scan, replace inline.)
  const onPhoto = () => {
    if (mode === 'sell') {
      haptics.tap();
      launchSellerScan();
      return;
    }
    void picker.pickCamera();
  };

  const onAttach = () => {
    if (mode === 'sell') {
      haptics.tap();
      launchSellerScan();
      return;
    }
    void picker.pickDocument();
  };

  return (
    <LabScreenBg>
      <Screen
        scroll
        padded={false}
        keyboardAware
        edges={['top']}
        style={styles.screen}
        contentContainerStyle={{
          // Screen's SafeAreaView already insets the top — just a small gap so
          // the header hugs the status bar like a standard app (no double inset).
          paddingTop: spacing.sm,
          paddingHorizontal: 22,
          // Clear the frosted tab bar (its live height) + a content gap, rather
          // than a magic 110 that silently breaks if the tab bar height changes.
          paddingBottom: tabBarHeight + spacing['2xl'] + spacing.xl,
        }}
      >
      <LabHeader
        onLanguagePress={() => {
          haptics.tap();
          setLangOpen(true);
        }}
        location={{
          value: location,
          detecting,
          onPress: onLocationPress,
          // Cold prompt: offer "Set location" when there's no cache yet. If the
          // native module is missing the first detect() resolves 'unavailable'
          // (neutral toast) and no cache is written, so the chip stays hidden
          // thereafter — no dead control.
          showSetLocation: true,
        }}
      />

      {/* Mode-aware greeting — single warm line, accent on the last word.
          (The big centered orbit hero mark was dropped so the Recent listings
          section shares the fold — the header lockup carries the brand mark.) */}
      <Text style={[styles.greeting, gSize]}>
        {t(`mobile.labHome.greetingLead.${mode}`)}{' '}
        <Text style={[styles.greetingAccent, { color: mode === 'buy' ? buyBlue : greenDarkest }]}>
          {t(`mobile.labHome.greetingAccent.${mode}`)}
        </Text>
      </Text>

      {/* AI composer — the visual hero */}
      <View style={styles.composer}>
        <AiComposer
          mode={mode}
          value={input}
          placeholder={t(`mobile.labHome.placeholder.${mode}`)}
          sendLabel={t(`mobile.labHome.sendLabel.${mode}`)}
          onChangeText={setInput}
          onSend={onSend}
          onPhoto={onPhoto}
          onAttach={onAttach}
          canSend={input.trim().length > 0 || hasAttachments}
        />
      </View>

      {/* Staged attachments (thumbnails / doc chips, each removable) */}
      <AttachmentChips style={styles.chips} />

      {/* Mode toggle — moved below the composer (prompt-first; sell/buy scopes). */}
      <View style={styles.toggleWrap}>
        <ModeToggle mode={mode} onChange={setMode} />
      </View>

      {/* Recent listings — a mini seller dashboard under the composer. Sell-mode
          only ("my listings" is a seller concept); hides itself when empty. */}
      {mode === 'sell' && <HomeRecentListings />}

      {/* Recent wants — the buyer-mode mirror ("My Wants" preview). Buy-mode only;
          gated on WTB_ENABLED via useWants; hides itself when empty/signed-out. */}
      {mode === 'buy' && <HomeRecentWants />}

      {/* Language picker — globe chip in the header opens this (reuses the seller
          LanguageSheet; i18n.changeLanguage re-renders every t() on the screen). */}
      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
      </Screen>
    </LabScreenBg>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  greeting: {
    fontFamily: fonts.headingBold,
    // letterSpacing lives on the computed `gSize` object so tracking scales with
    // the active font size (-0.035 × size) per foundation §2b.
    color: lab.ink,
    textAlign: 'center',
    marginTop: spacing['3xl'], // 32 — more air under the header for hero presence
  },
  greetingAccent: {}, // color set inline (buyBlue in buy mode, else greenDarkest)
  composer: { marginTop: spacing['2xl'] }, // 24
  chips: { marginTop: spacing.md }, // 12 — flush to the shared 22px padding edge
  toggleWrap: {
    width: '78%',
    alignSelf: 'center',
    marginTop: spacing.xl, // 20 (ModeToggle's track carries its own marginBottom)
  },
});
