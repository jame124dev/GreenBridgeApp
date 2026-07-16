// (lab) Chat thread — the real conversation surface (NewVersion/dynamic
// 02-action-component-catalog.md + 05-mobile-ux.md). Behind LAB_CHAT_ENABLED:
// Home's Send navigates here with the first turn already open in threadStore.
//
// Ownership of the message list lives HERE (not threadStore, which holds only
// the single in-flight `turn`). On each send: the current live turn is committed
// into `messages`, a user bubble is appended, then a fresh turn is opened via
// `useLabTurn` against the same conversation_id (multi-turn continuity). The live
// bot bubble reveals `turn.text` token-by-token (typewriter) with a thinking
// indicator before the first token, inline response cards from `turn.cards`, and
// on error → an error bubble + Retry.
//
// Flow: home → chat. Tab bar HIDDEN (pushed full-screen). Static path (flag off)
// never reaches this screen — Home keeps its Processing navigation.
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { KeyboardEvents, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { ArrowUp, Camera, ChevronDown, ChevronLeft, Paperclip, Square } from 'lucide-react-native';

import { fonts, radius, spacing } from '@/constants/theme';
import { usePop } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useAttachmentPicker } from '@/features/lab/hooks/useAttachmentPicker';
import { AttachmentChips } from '@/features/lab/components';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import { ChatMessage } from '@/features/lab/chat/ChatMessage';
import { StreamingMessage } from '@/features/lab/chat/StreamingMessage';
import {
  LabListingEditSheet,
  type LabListingEditSheetRef,
} from '@/features/lab/chat/LabListingEditSheet';
import { LabListingGapFiller } from '@/features/lab/chat/LabListingGapFiller';
import { useSession } from '@/features/lab/stores/sessionStore';
import {
  ChatThemeProvider,
  chatDarkTheme,
  chatLightTheme,
  createThemedStyles,
  useColor,
} from '@/features/lab/chat/theme';
import { useChatController } from '@/features/lab/chat/controllers/useChatController';
import { CHAT_UI_V2 } from '@/lib/flags';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// PR-2/R2: the provider is mounted by the exported `LabChat` wrapper below; the
// screen body lives here so it renders UNDER the provider and can consume theme
// hooks (`useColor` / `createThemedStyles`). Light values = today's pixels.
//
// R2 dark wiring: `CHAT_UI_V2` selects the shipping dark theme (D1 §4) vs the
// frozen light singleton. Build-time flag → both are stable references, so the
// selection is fixed per session (no runtime scheme-toggle re-renders). Default
// OFF ⇒ light ⇒ behavior-neutral (snapshots unchanged).
export default function LabChat() {
  return (
    <ChatThemeProvider theme={CHAT_UI_V2 ? chatDarkTheme : chatLightTheme}>
      <LabChatScreen />
    </ChatThemeProvider>
  );
}

function LabChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const { t } = useTranslation();
  const styles = useChromeStyles();

  const picker = useAttachmentPicker();
  const hasAttachments = useComposer((s) => s.attachments.length > 0);

  const scrollRef = useRef<ScrollView>(null);
  // Shared ref so the in-chat location strip's "Enter manually" can focus the
  // composer instead of forcing the user to reach for it.
  const inputRef = useRef<TextInput>(null);
  // The native edit sheet ref stays a view concern (refs must not flow through
  // the controller's render-time return); the controller asks us to present it.
  const editSheetRef = useRef<LabListingEditSheetRef>(null);
  const atBottomRef = useRef(true);
  // Suspend stream-driven auto-follow while the user's finger is on the screen
  // (dragging up to read); rAF-coalesce multiple content-size bursts in a frame
  // into ONE non-animated pin so streaming glides instead of jumping.
  const draggingRef = useRef(false);
  const followScheduledRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Live composer height so the scroll-to-bottom pill sits just above it rather
  // than over a fixed 92pt guess (the composer grows with multiline text +
  // staged attachments).
  const [composerHeight, setComposerHeight] = useState(0);

  // Keyboard visibility → collapse the composer's home-indicator inset while the
  // keyboard is up (the keyboard already clears the indicator), so the input sits
  // flush on the keyboard instead of floating above it with a gap. (bugfix)
  // Use the keyboard-controller's OWN events — with react-native-keyboard-controller
  // active, RN's `Keyboard` events don't fire reliably, so the collapse never
  // triggered and the composer kept its full home-indicator inset (a ~30px strip).
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = KeyboardEvents.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = KeyboardEvents.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Keyboard avoidance driven DETERMINISTICALLY by the keyboard animation value
  // (0 when closed) rather than a `behavior="padding"` KeyboardAvoidingView —
  // the KAV could leave STALE keyboard-height padding after dismiss on some
  // devices (seen on MIUI), which, with the bottom-anchored thread, floated the
  // composer mid-screen over a dead gap. `Math.abs` is sign-agnostic; padding is
  // always 0 when the keyboard is closed, so it can never get stuck. (bugfix)
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardAvoidStyle = useAnimatedStyle(() => ({ paddingBottom: Math.abs(keyboard.height.value) }));

  const scrollToEnd = useCallback((animated = false) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  // View side-effect fired after a send is accepted (was inline in the old
  // send()): pin to bottom + scroll. Identity-stable so the controller's `send`
  // stays memoized.
  const onDidSend = useCallback(() => {
    atBottomRef.current = true;
    setShowScrollDown(false);
    scrollToEnd(true);
  }, [scrollToEnd]);

  // Present the edit sheet on the next tick so the freshly-set seed is read.
  const onPresentEditSheet = useCallback(() => {
    requestAnimationFrame(() => editSheetRef.current?.present());
  }, []);

  // PR-4: all send / commit / abort / retry orchestration + card handlers + the
  // batch wiring + draft/gap derivations live in the controller now.
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const chat = useChatController({ initialQuery, onDidSend, onPresentEditSheet });
  const { mode, apiMode } = chat;
  const accent = useColor(mode === 'sell' ? 'mode.sell' : 'mode.buy');
  const inkColor = useColor('input.text');
  const utilIconColor = useColor('icon.util');
  const placeholderColor = useColor('input.placeholder');

  // Android back → cancel the in-flight turn + leave.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      chat.abort();
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [chat, router]);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      // Widen the "following" band during a live turn so ordinary streaming
      // reflow + taller image cards still count as at-bottom (no false yank-off).
      const NEAR = chat.liveActive ? 120 : 80;
      const atBottom = distanceFromBottom < NEAR;
      atBottomRef.current = atBottom;
      setShowScrollDown(!atBottom);
    },
    [chat.liveActive],
  );

  const onScrollBeginDrag = useCallback(() => {
    draggingRef.current = true;
  }, []);
  const onMomentumScrollEnd = useCallback(
    (e: Parameters<typeof onScroll>[0]) => {
      draggingRef.current = false;
      onScroll(e);
    },
    [onScroll],
  );

  // Anti-jump follow: only pin when already at-bottom AND not dragging; rAF
  // coalesces token bursts in a frame to ONE non-animated scroll (continuous
  // glide, never the overlapping-animated-scroll jump).
  const onContentSizeChange = useCallback(() => {
    if (atBottomRef.current && !draggingRef.current && !followScheduledRef.current) {
      followScheduledRef.current = true;
      requestAnimationFrame(() => {
        followScheduledRef.current = false;
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.tap();
            chat.abort();
            router.back();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labChat.back')}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={inkColor} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'sell' ? t('mobile.labChat.headerTitle.sell') : t('mobile.labChat.headerTitle.buy')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* Keyboard avoidance = flex column + a bottom padding equal to the live
          keyboard height (0 when closed). Deterministic: the composer sits flush
          above the keyboard when open and drops to the bottom when closed, with
          no risk of stale padding stranding it mid-screen. */}
      <Animated.View style={[styles.flex, keyboardAvoidStyle]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          // flexGrow:1 forces the container ≥ viewport; justifyContent:'flex-end'
          // pins a SHORT thread to the bottom (last bubble spacing.md above the
          // composer — kills the dead white area + reads the composer as part of
          // the thread). When content overflows, justifyContent is inert and it
          // scrolls normally (paddingTop still clears the header).
          contentContainerStyle={[
            styles.threadContent,
            { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: spacing.md },
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
        >
          {chat.viewMessages.map((m) => (
            <ChatMessage
              key={m.id}
              msg={m}
              mode={apiMode}
              onSend={chat.onCardSend}
              onRetry={chat.onRetry}
              onUploadPress={chat.handleUploadPress}
              onEditDraft={chat.onEditDraft}
              // The just-committed row replaces the streaming bubble's identical
              // pixels in the same frame → mount it with no entrance (D3).
              handoff={m.id === chat.justSettledId}
              {...chat.batchCtx}
            />
          ))}

          {/* Live streaming bubble (not yet committed) — self-subscribes the
              active turn (A2 I10) and renders the SHARED AssistantMessage subtree
              (A4 §12.7). Renders null when no turn is streaming. */}
          <StreamingMessage
            mode={apiMode}
            onSend={chat.onCardSend}
            onUploadPress={chat.handleUploadPress}
            onEditDraft={chat.onEditDraft}
            {...chat.batchCtx}
          />
        </ScrollView>

        {/* Scroll-to-bottom pill — anchored just above the measured composer. */}
        {showScrollDown ? (
          <ScrollDownPill
            bottom={(composerHeight || 92) + spacing.sm}
            onPress={() => {
              haptics.tap();
              atBottomRef.current = true;
              setShowScrollDown(false);
              scrollToEnd(true);
            }}
          />
        ) : null}

        {/* Composer */}
        <View
          style={[
            styles.composerWrap,
            // Keyboard up → minimal padding (keyboard clears the home indicator);
            // keyboard down → full safe-area inset so the input clears it.
            { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 10) },
          ]}
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
        >
          {/* In-chat listing gap filler (sell mode, draft still has gaps). A
              slide-through stepper anchored to draft state — asks only for the
              missing/low-confidence fields, PUTs each single field, and calls
              onSaved so the draft card above updates live. Collapses to "all set"
              (then unmounts) as the draft fills. */}
          {chat.showGapFiller && chat.latestDraft ? (
            <LabListingGapFiller
              data={chat.latestDraft}
              conversationId={useSession.getState().getConversationId()}
              onSaved={chat.onSaved}
              onManual={() => inputRef.current?.focus()}
            />
          ) : null}
          {/* Staged attachments (attach a photo mid-chat → next send hits /detect/stream) */}
          <AttachmentChips style={styles.chips} />
          <View style={styles.composerRow}>
            <ComposerUtilButton
              label={t('mobile.labChat.takePhoto')}
              onPress={() => (mode === 'sell' ? launchSellerScan() : picker.pickCamera())}
            >
              <Camera size={19} strokeWidth={1.8} color={utilIconColor} />
            </ComposerUtilButton>
            <ComposerUtilButton
              label={t('mobile.labChat.attachFile')}
              onPress={() => (mode === 'sell' ? launchSellerScan() : picker.pickDocument())}
            >
              <Paperclip size={18} strokeWidth={1.8} color={utilIconColor} />
            </ComposerUtilButton>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={chat.input}
              onChangeText={chat.setInput}
              placeholder={mode === 'sell' ? t('mobile.labChat.placeholder.sell') : t('mobile.labChat.placeholder.buy')}
              placeholderTextColor={placeholderColor}
              multiline
              onFocus={() => scrollToEnd(true)}
            />
            {/* One persistent circle that MORPHS Send↔Stop (never remounts).
                Unconditional (both flag states): while a turn streams it is a
                Stop that settles the live turn; otherwise it is Send (greyed only
                when nothing is typed). This is the streaming feedback + the
                structural mid-stream send-guard (no Send affordance during a stream). */}
            <ComposerActionButton
              accent={accent}
              live={chat.liveActive}
              canSend={chat.input.trim().length > 0 || hasAttachments}
              onSend={() => {
                chat.send(chat.input);
                inputRef.current?.focus();
              }}
              onStop={chat.stop}
            />
          </View>
        </View>
      </Animated.View>

      {/* Native "Edit listing" editor sheet — mounted once, seeded per open via
          `editSeed`. On save it appends a fresh listing_draft card (onSaved). */}
      <LabListingEditSheet
        ref={editSheetRef}
        conversationId={useSession.getState().getConversationId()}
        seed={chat.editSeed}
        onSaved={chat.onSaved}
      />
    </View>
  );
}

function ScrollDownPill({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const entering = usePop();
  const styles = useChromeStyles();
  const inkColor = useColor('input.text');
  return (
    <Animated.View entering={entering} style={[styles.pillWrap, { bottom }]} pointerEvents="box-none">
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18n.t('mobile.labChat.scrollToBottom')} style={styles.pill}>
        <ChevronDown size={20} color={inkColor} />
      </Pressable>
    </Animated.View>
  );
}

/** Camera / paperclip utility button in the chat composer — matches the Home
 *  composer's UtilButton look; fires selection haptic then runs the picker. */
function ComposerUtilButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const styles = useChromeStyles();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.utilBox}
    >
      {children}
    </Pressable>
  );
}

/** The composer's single action affordance — ONE persistent circle that morphs
 *  Send↔Stop (it never unmounts, so the transition is a glyph cross-fade, not a
 *  remount). Five derived states off `live`/`canSend`:
 *    IDLE-EMPTY (!live,!canSend) → ArrowUp, opacity 0.45, non-interactive (the
 *                                  ONLY greyed state — never during a stream);
 *    HAS-CONTENT (!live,canSend) → ArrowUp, opacity 1, → onSend();
 *    STREAMING  (live)           → Square, opacity 1, ALWAYS pressable → onStop(),
 *                                  with a calm pulse ring breathing behind it.
 *  The circle background is a constant accent across the morph (buy/sell); only
 *  the glyph swaps. Honors reduced motion (cross-fade only, ring hidden). */
function ComposerActionButton({
  accent,
  live,
  canSend,
  onSend,
  onStop,
}: {
  accent: string;
  live: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}) {
  const styles = useChromeStyles();
  const reduced = useReducedMotion();
  const disabled = !live && !canSend;

  // 0 = Send (ArrowUp), 1 = Stop (Square). Whole-button opacity dims only when
  // disabled. Ring drives the streaming pulse.
  const p = useSharedValue(live ? 1 : 0);
  const dim = useSharedValue(disabled ? 0.45 : 1);
  const ring = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(live ? 1 : 0, {
      duration: reduced ? 100 : 180,
      easing: Easing.out(Easing.quad),
    });
  }, [live, reduced, p]);

  useEffect(() => {
    dim.value = withTiming(disabled ? 0.45 : 1, { duration: 120 });
  }, [disabled, dim]);

  // Pulse ring: a calm ping (scale 1→1.45, opacity 0.45→0) on a 1100ms loop while
  // live — the continuous "working" cue once the thinking dots give way to text.
  // Cancelled + reset the instant the turn settles and on unmount.
  useEffect(() => {
    if (live && !reduced) {
      ring.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    } else {
      cancelAnimation(ring);
      ring.value = 0;
    }
    return () => cancelAnimation(ring);
  }, [live, reduced, ring]);

  const circleStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const arrowStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: interpolate(p.value, [0, 1], [1, 0]) }
      : {
          opacity: interpolate(p.value, [0, 1], [1, 0]),
          transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.6]) }],
        },
  );
  const squareStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: interpolate(p.value, [0, 1], [0, 1]) }
      : {
          opacity: interpolate(p.value, [0, 1], [0, 1]),
          transform: [{ scale: interpolate(p.value, [0, 1], [0.6, 1]) }],
        },
  );
  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(ring.value, [0, 1], [0.45, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [1, 1.45]) }],
  }));

  const onPress = () => {
    if (live) {
      haptics.tap(); // utility/secondary action
      onStop();
      return;
    }
    if (canSend) onSend(); // send() fires its own MEDIUM impact — no double-fire here
    // disabled → no-op, no haptic
  };

  return (
    <View style={styles.actionWrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.send, styles.actionRing, ringStyle, { backgroundColor: accent }]}
      />
      <AnimatedPressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={i18n.t(live ? 'mobile.labChat.stop' : 'mobile.labChat.send')}
        accessibilityState={{ disabled, busy: live }}
        style={[styles.send, circleStyle, { backgroundColor: accent }]}
      >
        <Animated.View pointerEvents="none" style={[styles.actionGlyph, arrowStyle]}>
          <ArrowUp size={20} color="#fff" strokeWidth={2.4} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.actionGlyph, squareStyle]}>
          <Square size={16} color="#fff" strokeWidth={2.4} fill="#fff" />
        </Animated.View>
      </AnimatedPressable>
    </View>
  );
}

const useChromeStyles = createThemedStyles((t) => ({
  root: { flex: 1, backgroundColor: t.color['bg.canvas'] },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.color['input.border'],
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: t.color['input.text'] },
  threadContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  pillWrap: { position: 'absolute', right: 18 },
  pill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: t.color['surface.raised'],
    borderWidth: 1,
    borderColor: t.color['input.border'],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: t.color['surface.raised'],
    // Re-attach the composer to the thread: drop the hairline top border (it
    // boxed the input off as a detached bar) for a soft upward lift instead, so
    // the tray reads as the bottom of one continuous surface. FALLBACK if the
    // negative-offset shadow renders inconsistently on Android: revert to a
    // single hairline top border (border.subtle) — never ship a broken shadow.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  chips: { marginBottom: spacing.sm },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  utilBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: t.color['border.util'],
    backgroundColor: t.color['surface.util'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: t.color['input.border'],
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: t.color['input.text'],
    backgroundColor: t.color['surface.raised'],
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed 44×44 host so the morphing circle + its pulse ring share one footprint.
  actionWrap: { width: 44, height: 44, position: 'relative' },
  // Pulse ring sits BEHIND the circle (first child), same footprint, non-interactive.
  actionRing: { position: 'absolute', top: 0, left: 0 },
  // Both glyphs are absolutely stacked + centered so they cross-fade in place.
  actionGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
