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
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { ArrowUp, Camera, ChevronDown, ChevronLeft, Paperclip } from 'lucide-react-native';

import { brand, buyBlue, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { usePop } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useThread, LATEST_WINS_CARD_TYPES, type Turn } from '@/features/lab/stores/threadStore';
import { useLabTurn } from '@/features/lab/hooks/useLabTurn';
import { useBatchProducts } from '@/features/lab/hooks/useBatchProducts';
import { useAttachmentPicker } from '@/features/lab/hooks/useAttachmentPicker';
import { DETECT_STREAM_ENABLED } from '@/lib/flags';
import { AttachmentChips } from '@/features/lab/components';
import { launchSellerScan } from '@/features/lab/scan/launchSellerScan';
import { ChatMessage, MarkdownLite } from '@/features/lab/chat/ChatMessage';
import { ThinkingDots } from '@/features/lab/chat/ThinkingDots';
import { renderCard } from '@/features/lab/chat/cards';
import {
  LabListingEditSheet,
  type LabListingEditSheetRef,
} from '@/features/lab/chat/LabListingEditSheet';
import { LabListingGapFiller } from '@/features/lab/chat/LabListingGapFiller';
import type { DraftPayload } from '@/features/lab/data/listingDraftApi';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useTypewriter } from '@/features/lab/chat/useTypewriter';
import { newMsgId, type AiMsg } from '@/features/lab/chat/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Fold a settled `turn` into a committed bot/err message (or null if empty).
 *  `retryText` is the user message that produced this turn — carried on an error
 *  message so the Retry affordance can re-send it verbatim (05-mobile-ux §8). */
function turnToMessage(turn: Turn, retryText: string): AiMsg | null {
  if (turn.status === 'error') {
    return {
      id: newMsgId('err'),
      role: 'err',
      text: turn.error?.detail ?? i18n.t('mobile.labChat.genericError'),
      errorDetail: turn.error?.detail,
      retry: retryText || undefined,
    };
  }
  const hasContent = turn.text.length > 0 || turn.cards.length > 0;
  if (!hasContent) return null;
  return {
    id: newMsgId('bot'),
    role: 'bot',
    text: turn.text,
    cards: turn.cards.length ? turn.cards : undefined,
  };
}

/** Hide superseded "latest-wins" singleton cards (listing/WTB draft, entry
 *  options) across the committed history. A draft streams a card per update and
 *  re-emits every turn, so without this the thread stacks 5–6 near-identical
 *  cards. Rule: a singleton card renders only if it's the LAST of its type in the
 *  committed history AND the live turn doesn't currently carry that type (the
 *  live turn is always newer, so it supersedes all committed copies). Non-empty
 *  results reuse the original message reference so `ChatMessage`'s memo holds. */
function collapseSupersededCards(messages: AiMsg[], liveTypes: Set<string>): AiMsg[] {
  const lastIdx = new Map<string, number>(); // type → last "mi*1e4+ci" seen
  messages.forEach((m, mi) =>
    m.cards?.forEach((c, ci) => {
      if (LATEST_WINS_CARD_TYPES.has(c.type)) lastIdx.set(c.type, mi * 1e4 + ci);
    }),
  );
  return messages.map((m, mi) => {
    if (!m.cards) return m;
    const cards = m.cards.filter((c, ci) => {
      if (!LATEST_WINS_CARD_TYPES.has(c.type)) return true;
      if (liveTypes.has(c.type)) return false; // superseded by the live turn
      return lastIdx.get(c.type) === mi * 1e4 + ci; // keep only the last committed
    });
    if (cards.length === m.cards.length) return m;
    return { ...m, cards: cards.length ? cards : undefined };
  });
}

/** The most-recent listing_draft card payload (live turn first, else the last
 *  committed one in history), or null when no draft exists yet. Same live-first-
 *  then-last-committed scan the old location strip used — now general-purpose so
 *  the gap filler can derive its full gap list from it. */
function computeLatestDraft(liveCards: Turn['cards'], messages: AiMsg[]): DraftPayload | null {
  const liveDraft = [...liveCards].reverse().find((c) => c.type === 'listing_draft');
  if (liveDraft) return (liveDraft.data as DraftPayload | undefined) ?? null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cards = messages[i].cards;
    if (!cards) continue;
    for (let j = cards.length - 1; j >= 0; j--) {
      if (cards[j].type === 'listing_draft') {
        return (cards[j].data as DraftPayload | undefined) ?? null;
      }
    }
  }
  return null;
}

/** Count the draft's gaps (missing_required ∪ low_confidence), dropping `country`
 *  when `location` is present (the location picker fills both) — mirrors the gap
 *  filler's own list. >0 → mount the filler. Defensive against a malformed
 *  payload (no draft/fields → 0 gaps → nothing to mount). */
function draftGapCount(data: DraftPayload | null): number {
  if (!data) return 0;
  const seen = new Set<string>();
  for (const k of [...(data.missing_required || []), ...(data.low_confidence || [])]) {
    if (k) seen.add(k);
  }
  if (seen.has('location')) seen.delete('country');
  return seen.size;
}

export default function LabChat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const { t } = useTranslation();

  const mode = useComposer((s) => s.mode);
  const apiMode = mode === 'sell' ? 'seller' : 'buyer';
  const accent = mode === 'sell' ? greenDarkest : buyBlue;

  const labTurn = useLabTurn();
  const picker = useAttachmentPicker();
  const hasAttachments = useComposer((s) => s.attachments.length > 0);
  const turn = useThread((s) => s.turn);

  // Committed history (the live turn is rendered separately below).
  const [messages, setMessages] = useState<AiMsg[]>(() => {
    // Home seeds the first user turn via the `q` param (the composer input at
    // Send time) so the user's own message shows immediately on entry.
    const first = typeof params.q === 'string' ? params.q : '';
    return first ? [{ id: newMsgId('user'), role: 'user', text: first }] : [];
  });

  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Shared ref so the in-chat location strip's "Enter manually" can focus the
  // composer instead of forcing the user to reach for it.
  const inputRef = useRef<TextInput>(null);
  const atBottomRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  // Live composer height so the scroll-to-bottom pill sits just above it rather
  // than over a fixed 92pt guess (the composer grows with multiline text +
  // staged attachments).
  const [composerHeight, setComposerHeight] = useState(0);

  // Retry re-runs the errored turn's original text. Retry set to the last user
  // message text (turn errors don't carry the outgoing message).
  const lastUserTextRef = useRef<string>(typeof params.q === 'string' ? params.q : '');

  const scrollToEnd = useCallback((animated = false) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  // Autoscroll while pinned to bottom (stream growth + new cards).
  const settled = turn.status === 'done' || turn.status === 'error';

  // Commit a settled turn into the history, then reset the thread shell so the
  // next turn starts clean. Runs once per settle (guarded by a ref on turn id).
  const committedRef = useRef(false);
  useEffect(() => {
    if (!settled) {
      committedRef.current = false;
      return;
    }
    if (committedRef.current) return;
    committedRef.current = true;
    const msg = turnToMessage(turn, lastUserTextRef.current);
    // Attach the done-frame tools to a bot message (error carries none).
    setMessages((prev) => (msg ? [...prev, msg] : prev));
    useThread.getState().reset();
    if (turn.status === 'error') haptics.error();
  }, [settled, turn]);

  // Send a follow-up turn. Commits any in-flight (rare — normally settled first),
  // appends the user bubble, opens a new turn against the same conversation_id.
  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      // A follow-up is sendable with text OR staged attachments. With attachments
      // and no text, `useLabTurn.start('')` still routes to /detect/stream via the
      // staged image_urls/document_urls.
      const staged = useComposer.getState().attachments;
      if (!message && staged.length === 0) return;
      haptics.impact(); // MEDIUM — primary CTA
      lastUserTextRef.current = message;
      // Snapshot the staged attachments onto the user bubble so the sender sees
      // what they sent (image thumbnails / doc chips) on the right side —
      // instead of a "Sent an attachment" stand-in. Local picker URIs stay valid
      // for display; `start()` reads + clears the store copy for the upload.
      const sentAttachments = staged.map((a) => ({ uri: a.uri, isImage: a.isImage, name: a.name }));
      // `useLabTurn.start(message)` sends this exact text (explicit arg wins over
      // the shared composer input), so no need to touch the Home composer store.
      setMessages((prev) => [
        ...prev,
        {
          id: newMsgId('user'),
          role: 'user',
          text: message,
          attachments: sentAttachments.length ? sentAttachments : undefined,
        },
      ]);
      setInput('');
      useThread.getState().startTurn();
      void labTurn.start(message);
      atBottomRef.current = true;
      setShowScrollDown(false);
      scrollToEnd(true);
    },
    [labTurn, scrollToEnd],
  );

  // Retry: re-send the last user message that errored.
  const onRetry = useCallback(
    (text: string) => {
      haptics.tap();
      send(text);
    },
    [send],
  );

  // Card actions (Save want, Confirm, View matches, product tap) all funnel here.
  const onCardSend = useCallback((text: string) => send(text), [send]);

  // "Edit details" → open the native edit sheet, seeded from the tapped card's
  // draft. The sheet GETs the freshest draft, edits fields + photos, and on save
  // calls onSaved(payload) below. Mounted once; `editSeed` re-seeds per open.
  const editSheetRef = useRef<LabListingEditSheetRef>(null);
  const [editSeed, setEditSeed] = useState<unknown>(null);
  const onEditDraft = useCallback((data: unknown) => {
    setEditSeed(data);
    // Present on the next tick so the freshly-set seed is read on `present()`.
    requestAnimationFrame(() => editSheetRef.current?.present());
  }, []);

  // Entry-card "Upload photos / documents" → hand off to the native seller scan
  // flow (camera → AI detect → review → submit), REPLACING the old inline
  // detect-in-chat path (NewVersion/12 §4 — reuse seller scan). The entry card
  // is a sell-listing affordance, so this is always a sell intent.
  const handleUploadPress = useCallback(() => {
    haptics.tap();
    launchSellerScan();
  }, []);

  // On a successful save: append a fresh committed listing_draft bot message from
  // the PUT response. Because listing_draft is in LATEST_WINS_CARD_TYPES,
  // collapseSupersededCards keeps only this newest copy and hides the prior card
  // in place — no manual removal, no live-turn conflict (we append while idle).
  const onSaved = useCallback((payload: DraftPayload) => {
    setMessages((prev) => [
      ...prev,
      {
        id: newMsgId('bot'),
        role: 'bot',
        text: '',
        cards: [{ type: 'listing_draft', data: payload }],
      },
    ]);
  }, []);

  // Multi-product batch controller. Fires the imperative REST calls and appends
  // fresh committed bot messages the SAME way onSaved does (while the thread is
  // idle — no live-turn conflict). Only wired behind DETECT_STREAM_ENABLED.
  const appendBatchMessages = useCallback((msgs: AiMsg[]) => {
    setMessages((prev) => [...prev, ...msgs]);
  }, []);
  const batch = useBatchProducts(
    useSession.getState().getConversationId(),
    appendBatchMessages,
  );
  // Guarded callbacks: undefined when the flag is off → the queue/group_choice/
  // batch_result cards render read-only (no pager, no CTAs). Stable refs so
  // ChatMessage's React.memo holds.
  const onJumpProduct = useCallback(
    (index: number) => batch.jumpTo(index),
    [batch],
  );
  const onAdvanceProduct = useCallback(
    (dir: 'prev' | 'next', currentIndex: number, total: number) =>
      batch.advance(dir, currentIndex, total),
    [batch],
  );
  const onCombineProducts = useCallback(() => batch.combine(), [batch]);
  const onSplitProducts = useCallback(() => batch.split(), [batch]);
  const onPublishBatch = useCallback(() => batch.publishAll(), [batch]);
  const batchCtx = DETECT_STREAM_ENABLED
    ? {
        onJumpProduct,
        onAdvanceProduct,
        onCombineProducts,
        onSplitProducts,
        onPublishBatch,
        batchBusy: batch.busy,
      }
    : {};

  // Kick the first turn on mount if Home didn't already open it. Home DOES open
  // it (startTurn + labTurn.start) before navigating, so normally the turn is
  // already streaming; this only covers a direct/deep entry with a `q` param.
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const q = typeof params.q === 'string' ? params.q : '';
    const t = useThread.getState().turn;
    if (q && t.status === 'idle') {
      useThread.getState().startTurn();
      void labTurn.start(q);
    }
  }, [params.q, labTurn]);

  // Android back → cancel the in-flight turn + leave.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      labTurn.abort();
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [labTurn, router]);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const atBottom = distanceFromBottom < 80;
      atBottomRef.current = atBottom;
      setShowScrollDown(!atBottom);
    },
    [],
  );

  const onContentSizeChange = useCallback(() => {
    if (atBottomRef.current) scrollToEnd(false);
  }, [scrollToEnd]);

  const liveActive = turn.status === 'streaming';

  // Singleton card types the live turn currently carries — they supersede every
  // committed copy. Keyed as a stable string so the collapse memo only recomputes
  // when the set actually changes, not on every token.
  const liveSingletonKey = liveActive
    ? turn.cards
        .filter((c) => LATEST_WINS_CARD_TYPES.has(c.type))
        .map((c) => c.type)
        .sort()
        .join(',')
    : '';
  const viewMessages = useMemo(
    () => collapseSupersededCards(messages, new Set(liveSingletonKey ? liveSingletonKey.split(',') : [])),
    [messages, liveSingletonKey],
  );

  // In-chat gap-filler gate: sell mode AND the most-recent listing_draft has ≥1
  // gap (missing_required ∪ low_confidence). Recomputed from the live turn's
  // cards + committed history, so it tracks the AI's latest draft frame; the
  // filler itself recomputes its live gap list from `latestDraft` and drives a
  // per-mount satisfied Set, so it collapses to its "all set" state (then the
  // component returns null once nothing's left) as the draft fills in. Only ever
  // calls onSaved()/onManual — chat streaming/dedup behavior is untouched.
  const latestDraft = useMemo(
    () => computeLatestDraft(turn.cards, messages),
    [turn.cards, messages],
  );
  const showGapFiller =
    DETECT_STREAM_ENABLED && apiMode === 'seller' && draftGapCount(latestDraft) >= 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            haptics.tap();
            labTurn.abort();
            router.back();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labChat.back')}
          style={styles.backBtn}
        >
          <ChevronLeft size={24} color={lab.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'sell' ? t('mobile.labChat.headerTitle.sell') : t('mobile.labChat.headerTitle.buy')}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex} keyboardVerticalOffset={insets.top}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.threadContent, { paddingBottom: spacing['2xl'] }]}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
        >
          {viewMessages.map((m) => (
            <ChatMessage
              key={m.id}
              msg={m}
              mode={apiMode}
              onSend={onCardSend}
              onRetry={onRetry}
              onUploadPress={handleUploadPress}
              onEditDraft={onEditDraft}
              {...batchCtx}
            />
          ))}

          {/* Live streaming bubble (not yet committed). */}
          {liveActive ? (
            <LiveBotBubble
              turn={turn}
              mode={apiMode}
              onSend={onCardSend}
              onUploadPress={handleUploadPress}
              onEditDraft={onEditDraft}
              batchCtx={batchCtx}
            />
          ) : null}
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
          style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
        >
          {/* In-chat listing gap filler (sell mode, draft still has gaps). A
              slide-through stepper anchored to draft state — asks only for the
              missing/low-confidence fields, PUTs each single field, and calls
              onSaved so the draft card above updates live. Collapses to "all set"
              (then unmounts) as the draft fills. */}
          {showGapFiller && latestDraft ? (
            <LabListingGapFiller
              data={latestDraft}
              conversationId={useSession.getState().getConversationId()}
              onSaved={onSaved}
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
              <Camera size={19} strokeWidth={1.8} color={lab.utilIcon} />
            </ComposerUtilButton>
            <ComposerUtilButton
              label={t('mobile.labChat.attachFile')}
              onPress={() => (mode === 'sell' ? launchSellerScan() : picker.pickDocument())}
            >
              <Paperclip size={18} strokeWidth={1.8} color={lab.utilIcon} />
            </ComposerUtilButton>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={mode === 'sell' ? t('mobile.labChat.placeholder.sell') : t('mobile.labChat.placeholder.buy')}
              placeholderTextColor={lab.inkFaint}
              multiline
              onFocus={() => scrollToEnd(true)}
            />
            <SendButton
              accent={accent}
              disabled={input.trim().length === 0 && !hasAttachments}
              onPress={() => send(input)}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Native "Edit listing" editor sheet — mounted once, seeded per open via
          `editSeed`. On save it appends a fresh listing_draft card (onSaved). */}
      <LabListingEditSheet
        ref={editSheetRef}
        conversationId={useSession.getState().getConversationId()}
        seed={editSeed}
        onSaved={onSaved}
      />
    </View>
  );
}

/** The additive multi-product batch callbacks threaded into the card renderers.
 *  Empty ({}) when DETECT_STREAM_ENABLED is off → cards render read-only. */
type BatchCtx = {
  onJumpProduct?: (index: number) => void;
  onAdvanceProduct?: (dir: 'prev' | 'next', currentIndex: number, total: number) => void;
  onCombineProducts?: () => void;
  onSplitProducts?: () => void;
  onPublishBatch?: () => void;
  batchBusy?: boolean;
};

/** The in-flight bot bubble: typewriter text + thinking dots + live cards. */
function LiveBotBubble({
  turn,
  mode,
  onSend,
  onUploadPress,
  onEditDraft,
  batchCtx,
}: {
  turn: Turn;
  mode: 'buyer' | 'seller';
  onSend: (text: string) => void;
  onUploadPress?: () => void;
  onEditDraft?: (data: unknown) => void;
  batchCtx?: BatchCtx;
}) {
  const revealed = useTypewriter(turn.text, false);
  const hasCards = turn.cards.length > 0;
  const isThinking = !revealed && !hasCards;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.rowLeft}>
      <View style={styles.botWrap}>
        {(revealed || isThinking) && (
          <View style={styles.botBubble}>
            {isThinking ? <ThinkingDots /> : <MarkdownLite text={revealed} />}
          </View>
        )}
        {hasCards ? (
          <View style={styles.liveCards}>
            {turn.cards.map((c, i) => (
              <View key={`${c.type}-${i}`}>
                {renderCard(c.type, c.data, { mode, onSend, onUploadPress, onEditDraft, ...batchCtx })}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

function ScrollDownPill({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const entering = usePop();
  return (
    <Animated.View entering={entering} style={[styles.pillWrap, { bottom }]} pointerEvents="box-none">
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={i18n.t('mobile.labChat.scrollToBottom')} style={styles.pill}>
        <ChevronDown size={20} color={lab.ink} />
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

function SendButton({
  accent,
  disabled,
  onPress,
}: {
  accent: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={() => {
        if (!disabled) onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={i18n.t('mobile.labChat.send')}
      style={[styles.send, { backgroundColor: accent, opacity: disabled ? 0.45 : 1 }]}
    >
      <ArrowUp size={20} color="#fff" strokeWidth={2.4} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lab.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lab.hairline,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: fonts.bold, fontSize: 16, color: lab.ink },
  threadContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  rowLeft: { alignItems: 'flex-start', width: '100%' },
  // Full-width so live cards (width:'100%') get the whole thread column; the
  // text bubble caps itself at 92% and hugs its content via alignSelf. (Was
  // maxWidth:'92%' here, which collapsed the column — and the streaming listing
  // draft card — to ~half width.)
  botWrap: { width: '100%' },
  botBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: brand.divider,
    borderRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liveCards: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },

  pillWrap: { position: 'absolute', right: 18 },
  pill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: brand.surface,
    borderWidth: 1,
    borderColor: lab.hairline,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lab.hairline,
    backgroundColor: brand.surface,
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
    borderColor: lab.utilBorder,
    backgroundColor: lab.utilBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: lab.hairline,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: lab.ink,
    backgroundColor: brand.surface,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
