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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useKeyboardInset } from '@/features/lab/chat/hooks/useKeyboardInset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';
import i18n from '@/i18n';
import { ArrowUp, Camera, ChevronDown, ChevronLeft, Paperclip, Square, SquarePen } from 'lucide-react-native';

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
import { buildLabChatDraftReq } from '@/features/lab/chat/draftReq';
import { useSession } from '@/features/lab/stores/sessionStore';
import {
  ChatThemeProvider,
  chatDarkTheme,
  chatLightTheme,
  createThemedStyles,
  useColor,
} from '@/features/lab/chat/theme';
import { useChatController } from '@/features/lab/chat/controllers/useChatController';
import { StreamingChatList } from '@/features/lab/chat/StreamingChatList';
import { CHAT_UI_V2, STREAMING_CHAT_LIST, draftsEnabled } from '@/lib/flags';
import { useCreateDraft } from '@/services/drafts/draftHooks';
import { getSiteType } from '@/services/scanner/buildFormData';

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
  // Pin-to-top (ChatGPT/Claude style): on send, the user's latest message is
  // scrolled to the TOP of the viewport and the answer streams in BELOW it,
  // instead of the whole view yanking to the bottom (which scrolled the user's
  // message — and any image they attached — off-screen; user-reported). A
  // viewport-tall trailing spacer lets that message actually reach the top even
  // when the answer is short, and `pinActiveRef` suppresses the stream's
  // auto-follow so the pinned message never gets dragged away.
  const [viewportH, setViewportH] = useState(0);
  const pinScrolledRef = useRef<string | null>(null); // last user id we've pinned
  const pinActiveRef = useRef(false);
  const pinSpacerRef = useRef(0); // current trailing-spacer height (for distance math)
  const contentHeightRef = useRef(0);
  // Live composer height so the scroll-to-bottom pill sits just above it rather
  // than over a fixed 92pt guess (the composer grows with multiline text +
  // staged attachments).
  const [composerHeight, setComposerHeight] = useState(0);

  // Keyboard visibility → collapse the composer's home-indicator inset while the
  // keyboard is up (the keyboard already clears the indicator), so the input sits
  // flush on the keyboard instead of floating above it with a gap. (bugfix)
  // Keyboard avoidance — ONE reconciled animated value for BOTH the avoid
  // padding and the safe-area inset (glitch-audit G1/G2). The previous design
  // tracked the keyboard through two independent primitives (an animated height
  // + a `keyboardVisible` boolean fed by didShow/didHide), and each was observed
  // missing the "closed" signal independently on hardware-key IME transitions —
  // stranding either a keyboard-height dead gap (G1) or the composer under the
  // 3-button nav bar (G2). useKeyboardInset cross-clamps three native channels
  // so the value always converges; `max(inset, safeArea)` means the safe-area
  // padding can never be toggled off by a missed event.
  const keyboardInset = useKeyboardInset();
  const keyboardAvoidStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardInset.value, insets.bottom),
  }));

  // On send we no longer yank to the bottom — the pin effect scrolls the user's
  // new message to the TOP instead. Just hide the scroll-to-bottom pill (the
  // user is, by definition, looking at their fresh message).
  const onDidSend = useCallback(() => {
    setShowScrollDown(false);
  }, []);

  // Present the edit sheet on the next tick so the freshly-set seed is read.
  const onPresentEditSheet = useCallback(() => {
    requestAnimationFrame(() => editSheetRef.current?.present());
  }, []);

  // PR-4: all send / commit / abort / retry orchestration + card handlers + the
  // batch wiring + draft/gap derivations live in the controller now.
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const chat = useChatController({ initialQuery, onDidSend, onPresentEditSheet });
  const { mode, apiMode } = chat;

  // ── Save as draft (Task 17) ────────────────────────────────────────────
  // Task 12's Save button lives on draft.tsx, which this live chat flow never
  // navigates to (the draft streams in as an inline card here instead) — so
  // without this a lab customer using the flow they actually reach from Home
  // "List it" has no way to save. Reuses the same shared drafts API + payload
  // contract as draft.tsx (buildLabChatDraftReq wraps buildLabDraftPayload):
  // the top-level `mode` createDraft accepts is always 'single' (never the lab
  // sell/buy mode) — that distinction rides in `payload.mode` instead.
  const createDraft = useCreateDraft();
  const [savingDraft, setSavingDraft] = useState(false);
  const onSaveDraft = useCallback(async () => {
    if (!chat.latestDraft) return;
    haptics.tap();
    try {
      setSavingDraft(true);
      await createDraft.mutateAsync(
        buildLabChatDraftReq(
          chat.latestDraft,
          mode,
          getSiteType(),
          useSession.getState().getConversationId(),
        ),
      );
      toast.success(t('mobile.drafts.saved', { defaultValue: 'Draft saved' }));
    } catch {
      toast.error(t('mobile.drafts.saveFailed', { defaultValue: 'Could not save draft' }));
    } finally {
      setSavingDraft(false);
    }
  }, [chat.latestDraft, mode, createDraft, t]);

  // The id of the most-recent USER message — the one to pin to the top. Changes
  // on every send (and covers the initial `?q=` seed), which re-arms the pin.
  const latestUserId = useMemo(() => {
    const ms = chat.viewMessages;
    for (let i = ms.length - 1; i >= 0; i--) if (ms[i].role === 'user') return ms[i].id;
    return null;
  }, [chat.viewMessages]);
  useEffect(() => {
    pinActiveRef.current = latestUserId != null;
    pinSpacerRef.current = latestUserId != null ? viewportH : 0;
  }, [latestUserId, viewportH]);

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
      // Measure distance to the end of REAL content, not the pin spacer's empty
      // tail — otherwise the scroll-to-bottom pill would show (and jump) into
      // blank space below the answer.
      const distanceFromBottom =
        contentSize.height - pinSpacerRef.current - (contentOffset.y + layoutMeasurement.height);
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
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
    // Pin model: once there's a user message on screen we never auto-follow the
    // stream to the bottom — the pinned message stays at the top and the answer
    // grows below it. (The scroll-to-bottom pill still lets the user jump down.)
    if (pinActiveRef.current) return;
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
        {/* New chat — mint a fresh conversation_id and remount. Without this the
            MMKV-persisted id lives FOREVER and the assistant's Redis memory drags
            old context into every new question (device-observed: a days-old draft
            flow biased "I want a cnc machine" away from search-first). replace()
            without params so a stale ?q= can't re-send its query. */}
        <Pressable
          onPress={() => {
            haptics.tap();
            chat.stop();
            useSession.getState().reset();
            router.replace('/(lab)/chat');
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labChat.newChat')}
          style={styles.backBtn}
        >
          <SquarePen size={20} color={inkColor} />
        </Pressable>
      </View>

      {/* Keyboard avoidance = flex column + a bottom padding equal to the live
          keyboard height (0 when closed). Deterministic: the composer sits flush
          above the keyboard when open and drops to the bottom when closed, with
          no risk of stale padding stranding it mid-screen. */}
      <Animated.View style={[styles.flex, keyboardAvoidStyle]}>
        {STREAMING_CHAT_LIST ? (
          <StreamingChatList chat={chat} />
        ) : (
          <>
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
            {
              flexGrow: 1,
              // Empty/idle thread hugs the composer (flex-end kills the dead white
              // area). Once a turn exists we TOP-align so the pinned message's
              // measured y is stable — flex-end would bottom-shift content on the
              // send frame and the pin would scroll into the spacer (blank screen).
              justifyContent: latestUserId ? 'flex-start' : 'flex-end',
              paddingBottom: spacing.md,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScroll}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
        >
          {chat.viewMessages.map((m) => (
            <View
              key={m.id}
              // Pin the latest user message to the top exactly once (guarded by
              // pinScrolledRef so a later relayout — e.g. keyboard, image load —
              // can't re-yank it). `y` is the row's offset in content coords.
              onLayout={
                m.id === latestUserId
                  ? (e) => {
                      if (pinScrolledRef.current === m.id) return;
                      pinScrolledRef.current = m.id;
                      const y = e.nativeEvent.layout.y;
                      requestAnimationFrame(() =>
                        scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true }),
                      );
                    }
                  : undefined
              }
            >
              <ChatMessage
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
            </View>
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

          {/* Pin spacer: a viewport-tall tail so the latest user message can sit
              at the TOP with the answer below it, even for a short answer. Only
              present once a turn exists (keeps the empty state hugging the
              composer via the container's flex-end). */}
          <View style={{ height: latestUserId ? viewportH : 0 }} />
        </ScrollView>

        {/* Scroll-to-bottom pill — anchored just above the measured composer. */}
        {showScrollDown ? (
          <ScrollDownPill
            bottom={(composerHeight || 92) + spacing.sm}
            onPress={() => {
              haptics.tap();
              atBottomRef.current = true;
              setShowScrollDown(false);
              // Jump to the end of REAL content (the answer), stopping just above
              // the pin spacer's empty tail rather than scrolling into blank space.
              const target = Math.max(
                0,
                contentHeightRef.current - pinSpacerRef.current - viewportH + spacing.md,
              );
              requestAnimationFrame(() =>
                scrollRef.current?.scrollTo({ y: target, animated: true }),
              );
            }}
          />
        ) : null}
          </>
        )}

        {/* Composer */}
        <View
          style={[
            styles.composerWrap,
            // Constant internal padding — the OUTER animated container already
            // carries max(keyboardHeight, safe-area), so this must never depend
            // on keyboard state (the old boolean toggle was glitch G2).
            { paddingBottom: 10 },
          ]}
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
        >
          {/* Save as draft (Task 17) — independent of showGapFiller so it stays
              available once every gap is filled (the gap filler unmounts, but
              the draft is still there to save). Flag-gated same as draft.tsx's
              button; only needs a draft to exist. */}
          {draftsEnabled() && chat.latestDraft ? (
            <SaveDraftBar
              label={t('mobile.drafts.saveDraft', { defaultValue: 'Save as draft' })}
              saving={savingDraft}
              onPress={onSaveDraft}
            />
          ) : null}
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
                // Dismiss the keyboard on send (ChatGPT/Claude style) so the
                // answer isn't hidden behind it and the pinned message is fully
                // visible. Tapping the input again re-opens it (default focus).
                inputRef.current?.blur();
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

/** Screen-level "Save as draft" affordance for the live chat flow (Task 17) —
 *  a slim outlined bar above the gap filler/composer row, matching the
 *  gap-filler's own bordered-pill styling. Shows a spinner in place of the
 *  label while the mutation is in flight; disabled for the same duration so a
 *  second tap can't fire a duplicate create. */
function SaveDraftBar({
  label,
  saving,
  onPress,
}: {
  label: string;
  saving: boolean;
  onPress: () => void;
}) {
  const styles = useChromeStyles();
  const accentPressedColor = useColor('accent.pressed');
  return (
    <Pressable
      onPress={onPress}
      disabled={saving}
      accessibilityRole="button"
      accessibilityState={{ disabled: saving, busy: saving }}
      accessibilityLabel={label}
      style={[styles.saveDraftBtn, saving && styles.saveDraftBtnDisabled]}
    >
      {saving ? (
        <ActivityIndicator size="small" color={accentPressedColor} />
      ) : (
        <Text style={styles.saveDraftText}>{label}</Text>
      )}
    </Pressable>
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
  saveDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: 1,
    borderColor: t.color['border.subtle'],
    borderRadius: radius.md,
    backgroundColor: t.color['surface.raised'],
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: spacing.sm,
  },
  saveDraftBtnDisabled: { opacity: 0.6 },
  saveDraftText: { fontFamily: fonts.semibold, fontSize: 13, color: t.color['accent.pressed'] },
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
