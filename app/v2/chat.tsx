/**
 * 6e — Chat (the assistant).
 *
 *   ┌ green wash sheet, bleeding under the notch ─────────────┐
 *   │  [G] GREENBIDZ                            EN   bell•    │
 *   │  Assistant                                  (new chat)  │
 *   │  Describe what you are selling and it drafts…           │
 *   └─────────────────────────────────────────────────────────┘
 *      Selling   Buying                                          tabs + rule
 *      ────────────────────────────────────────────────────────
 *      TRY ASKING                                                empty state
 *      I have a used CNC machine to sell
 *      ────────────────────────────────────────────────────────
 *      Help me price my lab equipment
 *
 *                              …conversation…
 *
 *      ────────────────────────────────────────────────────────
 *      [ 📷 📎  Describe what you are selling        ]   ( ↑ )   composer
 *
 * ⚠️ WHAT THE DRAWING ACTUALLY SHOWS
 *
 * `docs/v2-design/screens/6e.html` is labelled "Chat" but it draws the
 * buyer↔seller MESSAGES INBOX — "Messages / Two threads are waiting on you",
 * All 12 / Unread 2 / Buying / Selling tabs, thread rows with a last-message
 * line and a 7pt unread dot, "5 empty threads hidden · show all". That is the
 * shipped Deals/Messages surface (`src/features/lab/messages/`), not the AI
 * assistant. This screen is the ASSISTANT, as briefed. Everything structural
 * has therefore been taken from the drawing (header sheet, display title +
 * supporting line, a ruled tab strip below the sheet, rows under a tracked
 * eyebrow) and everything content-shaped had to be designed here. The inbox
 * still needs a home; see the build report.
 *
 * DATA — read real, write later.
 *
 * The stream, the turn reducer and the committed history are NOT reimplemented:
 * `useChatController` is mounted exactly as `app/(lab)/chat.tsx` mounts it, and
 * the live turn is read straight off `threadStore` by the one leaf that needs
 * token-level updates (`LiveAnswer`), mirroring `StreamingMessage`. Only the
 * presentation is new.
 *
 * Nothing here writes:
 *  • `initialQuery` is hardcoded `''`. Passing a `?q=` through would make the
 *    controller OPEN A TURN on mount — a real POST to the assistant.
 *  • Send, and Retry after a failed turn, are rendered and inert
 *    (`TODO(v2-writes)`); both go through `chat.send`, which streams.
 *  • Stop, attachment staging and "New chat" are local only, so they are live.
 *
 * Two artifacts of sharing state with the shipped surfaces, both by design and
 * neither worth forking a store over:
 *  • `composerStore.attachments` is app-wide (Home stages, chat consumes), so a
 *    photo staged here is still staged if the person walks into the old chat and
 *    sends. The chips make it visible and each one can be removed.
 *  • The controller's mount-time seed reads `lastSentAttachments` — the crumb
 *    that carries a Home → chat handoff. If the person sent a photo in the OLD
 *    chat earlier in the same app session, this screen opens with that user
 *    bubble and no answer under it. "New chat" clears it. Fixing it properly
 *    means the controller consuming its own crumb, which is a change to the
 *    shipped flow, not to this screen.
 *
 * ── Five things worth knowing before editing ─────────────────────────────
 *
 * 1. THE CHAT THEME PROVIDER IS NEVER MOUNTED. `ChatMessage`, `StreamingMessage`,
 *    `cards.tsx` and `WorkingIndicator` all read `src/features/lab/chat/theme`,
 *    so rendering any of them here would put old-UI tokens inside a v2 screen.
 *    This file imports only the HEADLESS pieces — the controller, the two hooks,
 *    the pure `streamSanitizer`, the message types — none of which touch that
 *    theme. So there is no provider to fight and no `darkTheme.ts` decision to
 *    take here.
 *
 * 2. `Screen` is given `scroll={false}` + `contentStyle={styles.fill}`: the
 *    thread owns its own ScrollView. The bottom reserve is `useTabBarReserve()`,
 *    applied to the KEYBOARD-AVOIDING wrapper rather than to the list, because
 *    the composer — not the last message — is what has to clear the tab bar.
 *
 * 3. Keyboard: ONE animated `paddingBottom = max(keyboardInset, tabBarReserve)`
 *    on a flex column holding the list and the composer. `useKeyboardInset`
 *    cross-clamps three native channels so a missed IME callback cannot strand
 *    the composer (glitch-audit G1/G2). The composer is a flex SIBLING of the
 *    list, never an overlay, so the last message can never sit under it.
 *
 * 4. Prose is rendered with `body`/`bodyMedium` rather than `lead`/`action`.
 *    Both of the first pair resolve to a 20pt line box, so a **bold** run inside
 *    a wrapped line keeps the same baseline; `lead` (23) and `action` (21) do
 *    not, and RN applies a nested span's `lineHeight` per fragment on Android.
 *
 * 5. Guest mode: the assistant is open to everyone, INCLUDING SENDING.
 *
 *    ⛔ DO NOT PUT `requireAuth` ON SEND. `signInPromptStore.ts` states the rule
 *    verbatim from the 2026-08-24 rejection: "Registration can only be required
 *    for account-based features." Talking to the assistant is not account-based,
 *    and the shipped `app/(lab)/chat.tsx` does not gate it either. Build
 *    1.0.3(21) was rejected under 5.1.1(v) for exactly this shape of gate.
 *
 *    An earlier revision of this screen gated Send. It was wrong and was removed.
 *    `requireAuth` belongs on account-based actions only — messaging a seller,
 *    saving a want, publishing a listing.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ArrowUp, Camera, Paperclip, Square, SquarePen, X } from 'lucide-react-native';

import {
  GUTTER,
  SECTION_GAP,
  control,
  icon,
  radius,
  space,
  type as typeScale,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import {
  BrandBar,
  Hairline,
  IconAction,
  Row,
  RowThumb,
  Screen,
  SectionHeader,
  SectionNote,
  StagedChip,
  Tabs,
  Text,
  useTabBarReserve,
  type TabItem,
} from '@/features/v2/ui';
import { LanguageSheet } from '@/components/ui';
import { languageBadge } from '@/i18n';
import { router } from 'expo-router';

import { haptics } from '@/lib/haptics';
import { routes } from '@/lib/routes';
import { requireAuth } from '@/features/auth/requireAuth';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { useChatController } from '@/features/lab/chat/controllers/useChatController';
import { useKeyboardInset } from '@/features/lab/chat/hooks/useKeyboardInset';
import { useStreamReveal } from '@/features/lab/chat/hooks/useStreamReveal';
import { resolveBotText, streamSafeText } from '@/features/lab/chat/streamSanitizer';
import {
  isErrorMessage,
  messageText,
  type Attachment,
  type Message,
} from '@/features/lab/chat/types/message';
import { useAttachmentPicker } from '@/features/lab/hooks/useAttachmentPicker';
import {
  useComposer,
  type ComposerAttachment,
  type ComposerMode,
} from '@/features/lab/stores/composerStore';
import { useSession } from '@/features/lab/stores/sessionStore';
import { useThread } from '@/features/lab/stores/threadStore';
import { ChatCards } from '@/features/v2/chat/ChatCards';
// `types/card`, not `types` — see the note in `ChatCards.tsx`.
import type { Card } from '@/features/lab/chat/types/card';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ── Constants ───────────────────────────────────────────────────────────── */

const MODE_TABS: readonly TabItem<ComposerMode>[] = [
  { value: 'sell', label: 'Selling' },
  { value: 'buy', label: 'Buying' },
];

/** The one line under the display title. Says what the assistant does, per mode. */
const HEADER_SUB: Record<ComposerMode, string> = {
  sell: 'Describe what you are selling, or add a photo of the nameplate, and it drafts the listing.',
  buy: 'Say what you need and it searches the marketplace for you.',
};

const PLACEHOLDER: Record<ComposerMode, string> = {
  sell: 'Describe what you are selling',
  buy: 'Describe what you are looking for',
};

/** Openers, straight from the shipped chat's starter prompts. */
const STARTERS: Record<ComposerMode, readonly string[]> = {
  sell: [
    'I have a used CNC machine to sell',
    'Help me price my lab equipment',
    'List several items from photos',
  ],
  buy: ['Find an HPLC system', 'I need a used centrifuge', "Show me what's available"],
};

/**
 * The wait, explained. `stage` frames carry `phase` (NOT `stage`) — the detect
 * pipeline's taxonomy — and the buyer text-search path emits none at all, so the
 * per-mode default below is what is normally on screen. Never a bare spinner.
 */
const PHASE_LINE: Record<string, string> = {
  validating: 'Checking what you sent…',
  preparing_documents: 'Reading your documents…',
  preparing_pdfs: 'Reading your documents…',
  ai_running: 'Thinking it through…',
  extracting_products: 'Pulling out the details…',
};
const WORKING_DEFAULT: Record<'buyer' | 'seller', string> = {
  buyer: 'Searching the marketplace…',
  seller: 'Working on it…',
};

/** How close to the end still counts as "following the answer". Pictorial. */
const FOLLOW_BAND = 80;
/** The composer stops growing here and scrolls internally. ~4 lines of body. */
const INPUT_MAX_HEIGHT = control.input * 2;
/** The measure of the header's supporting line, matching 6d's. */
const HEADER_SUB_MEASURE = 250;

/* ── Markdown-lite, in v2 tokens ─────────────────────────────────────────── */

/** Bold / link / inline-code, the only inline syntax the assistant emits. */
const MD_TOKEN_RE = /(\[[^\]]*\]\([^)]*\)|\*\*[^*]+\*\*|`[^`]+`)/g;
const MD_LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;
const FENCE_RE = /^\s*```/;
const BULLET_RE = /^\s*[-*]\s+/;
const HEADING_RE = /^\s*#{1,6}\s+/;

/** One line of prose with its inline spans resolved. */
function InlineProse({ text }: { text: string }) {
  const parts = text.split(MD_TOKEN_RE).filter(Boolean);
  return (
    <Text variant="body" style={styles.proseLine}>
      {parts.map((p, i) => {
        const link = MD_LINK_RE.exec(p);
        // A link renders as its label, never as raw `[text](https://…)`. It is
        // not tappable here: the v2 in-app browser target is not decided, and a
        // link that silently does nothing is worse than plain text.
        if (link) {
          return (
            <Text key={i} variant="bodyMedium" color="accentInk">
              {link[1] || link[2]}
            </Text>
          );
        }
        if (p.startsWith('**') && p.endsWith('**')) {
          return (
            <Text key={i} variant="bodyMedium">
              {p.slice(2, -2)}
            </Text>
          );
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return (
            <Text key={i} variant="bodyMedium" color="inkMuted">
              {p.slice(1, -1)}
            </Text>
          );
        }
        return <Text key={i} variant="body">{p}</Text>;
      })}
    </Text>
  );
}

/**
 * The answer's lines, with any fenced code block removed.
 *
 * A module function rather than a `let` inside the render's `.map`: the React
 * Compiler lint (`react-hooks/immutability`) rejects reassigning a variable
 * captured by a callback that outlives render, and it is right to.
 */
function visibleLines(text: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push(line);
  }
  return out;
}

/**
 * An assistant answer. Line-based: blank lines become a gap, `- ` becomes a
 * bullet, `#` a heading, everything else a paragraph line.
 *
 * Fenced code is DROPPED rather than rendered: v2 has no monospace face loaded
 * (Poppins 400/500/600 is the whole set) and inventing one here would be the
 * fifth trap. The assistant does not emit code in this product; if that ever
 * changes, a `CodeBlock` belongs in the kit, not in this file.
 */
function Prose({ text }: { text: string }) {
  return (
    <View style={styles.prose}>
      {visibleLines(text).map((line, i) => {
        if (line.trim() === '') return <View key={i} style={styles.proseGap} />;
        if (HEADING_RE.test(line)) {
          return (
            <Text key={i} variant="h3" style={styles.proseHeading}>
              {line.replace(HEADING_RE, '')}
            </Text>
          );
        }
        if (BULLET_RE.test(line)) {
          return (
            <View key={i} style={styles.bulletRow}>
              <Text variant="body" color="inkSubtle">
                •
              </Text>
              <View style={styles.bulletText}>
                <InlineProse text={line.replace(BULLET_RE, '')} />
              </View>
            </View>
          );
        }
        return <InlineProse key={i} text={line} />;
      })}
    </View>
  );
}

/* ── KIT GAP — message bubbles ───────────────────────────────────────────── */

/**
 * KIT GAP. The kit has no conversation primitives; this is the first screen
 * that needs them. Reported with the code in the build report.
 *
 * The user speaks in a filled `accentWash` bubble on the right; the assistant
 * answers as plain prose on the page ground, left, full width. That asymmetry
 * is the design's own "space instead of boxes" rule applied to a thread — one
 * filled block for the short thing you said, no box at all around the long
 * thing you are reading.
 */
function UserBubble({ text, attachments }: { text: string; attachments?: readonly Attachment[] }) {
  const c = useV2Colors();
  const photos = (attachments ?? []).filter((a) => a.isImage);
  const files = (attachments ?? []).filter((a) => !a.isImage);
  return (
    <View style={styles.rowRight}>
      {/* flat: PENDING — same call as the kit's Bubble; decide the two together. */}
      <View style={[styles.userBubble, { backgroundColor: c.accentWash }]}>
        {photos.length > 0 ? (
          <View style={styles.thumbRow}>
            {photos.map((a) => (
              <RowThumb key={a.uri} uri={a.uri} />
            ))}
          </View>
        ) : null}
        {files.map((a) => (
          <Text key={a.uri} variant="caption" color="inkMuted" numberOfLines={1}>
            {a.name}
          </Text>
        ))}
        {text ? <Text variant="body">{text}</Text> : null}
      </View>
    </View>
  );
}

/** The assistant's turn: prose, plus the retry affordance when it failed. */
function AssistantTurn({
  text,
  failed,
  cards,
  onRetry,
}: {
  text: string;
  failed?: boolean;
  cards?: Card[];
  onRetry?: () => void;
}) {
  return (
    <View style={styles.rowLeft}>
      {failed ? (
        // Say what happened, then what to do about it. With Retry deferred the
        // next step is the composer, so the copy points at it rather than
        // leaving a dead end.
        <SectionNote tone="danger" actionLabel={onRetry ? 'Try again' : undefined} onAction={onRetry}>
          {`${text || 'That answer did not come through.'}${
            onRetry ? '' : ' Ask again in the box below — nothing you typed was lost.'
          }`}
        </SectionNote>
      ) : (
        <Prose text={text} />
      )}
      {/*
        A `data` frame carried a card — a result set, a draft, a queue.
        `ChatCards` renders the ones v2 draws and NAMES the ones it does not,
        reusing the shipped `toProductRow` so the two surfaces cannot word a
        result differently. It was a single line of prose saying a card existed,
        which meant a buyer searching the marketplace got told results existed
        and shown none.
      */}
      <ChatCards cards={cards} />
    </View>
  );
}

/** The pre-first-token wait, named. Explanatory copy, never a bare spinner. */
function WorkingLine({ phase, mode }: { phase?: string; mode: 'buyer' | 'seller' }) {
  const label = (phase && PHASE_LINE[phase]) || WORKING_DEFAULT[mode];
  return (
    <View style={styles.rowLeft} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Text variant="body" color="inkSubtle" style={styles.working}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The live turn — the ONLY token-level subscriber, exactly as `StreamingMessage`
 * is in the shipped screen, so a burst of tokens re-renders this node and not
 * the committed list. `useStreamReveal` is reused verbatim; `streamSafeText` is
 * applied to the REVEALED substring (never upstream of the reveal hook, whose
 * shrink-reset would wipe the bubble when a strip shortens the text).
 */
function LiveAnswer({ mode }: { mode: 'buyer' | 'seller' }) {
  const turn = useThread((s) => s.turn);
  const streaming = turn.status === 'streaming';
  const revealed = useStreamReveal(turn.text, !streaming);
  const safe = streamSafeText(revealed, turn.cards, !streaming && revealed === turn.text);

  if (turn.status === 'idle') return null;
  if (!safe) return <WorkingLine phase={turn.phase} mode={mode} />;
  // Cards only once the turn has settled: mid-stream the reducer can still be
  // appending to `cards`, and a half-built result list flickering under a
  // typing answer reads as a glitch.
  return <AssistantTurn text={safe} cards={streaming ? undefined : turn.cards} />;
}

/* ── KIT GAP — the composer ──────────────────────────────────────────────── */

/** A 20pt icon control inside the composer field. The kit's `IconAction` is a
 *  46pt circle — right for Send, far too big to sit inside a 52pt field. */
function GlyphButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  return (
    <AnimatedPressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT}
      style={animatedStyle}
    >
      {children}
    </AnimatedPressable>
  );
}

const HIT = { top: space.xl, bottom: space.xl, left: space.xl, right: space.xl };

/* ── The screen ──────────────────────────────────────────────────────────── */

function ChatScreen({ onNewChat }: { onNewChat: () => void }) {
  const c = useV2Colors();
  const { i18n } = useTranslation();
  const { unreadCount } = useLabNotifications();
  const picker = useAttachmentPicker();
  const staged = useComposer((s) => s.attachments);

  const [langOpen, setLangOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const atBottomRef = useRef(true);

  // `initialQuery: ''` is load-bearing — see the header comment. With it empty
  // the controller mounts inert: it seeds nothing, opens no turn, and fires no
  // request until `send` is called, which this screen never does.
  const chat = useChatController({ initialQuery: '' });
  const mode = chat.mode;

  const keyboardInset = useKeyboardInset();
  const reserve = useTabBarReserve();
  const avoidStyle = useAnimatedStyle(
    () => ({ paddingBottom: Math.max(keyboardInset.value, reserve) }),
    [reserve],
  );

  const hasThread = chat.viewMessages.length > 0 || chat.liveActive;
  const canSend = chat.input.trim().length > 0 || staged.length > 0;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottomRef.current =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < FOLLOW_BAND;
  }, []);

  // Follow the answer while it grows, but only if the reader has not scrolled
  // up to re-read something. Non-animated so streaming glides instead of jumps.
  const onContentSizeChange = useCallback(() => {
    if (!atBottomRef.current) return;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  }, []);

  const onModeChange = useCallback(
    (next: ComposerMode) => {
      if (next === mode) return;
      haptics.tap();
      // Local UI state shared with the shipped Home composer. Picks the copy,
      // the openers, and which endpoint the NEXT turn would use.
      useComposer.getState().setMode(next);
    },
    [mode],
  );

  // `setInput` is the controller's own `useState` setter — stable across
  // renders, unlike the `chat` object itself, which is rebuilt every render.
  const setInput = chat.setInput;
  const onStarter = useCallback(
    (prompt: string) => {
      haptics.tap();
      // Openers FILL the composer rather than sending: sending streams, and
      // writes are deferred. It is also the better behaviour — the person can
      // edit the question before it goes.
      setInput(prompt);
      inputRef.current?.focus();
    },
    [setInput],
  );

  const onSend = useCallback(() => {
    haptics.impact();
    // No auth gate — see note 5 in the file header. The assistant is open to
    // guests under App Review 5.1.1(v), and gating it here is what got a build
    // rejected once already.
    //
    // WIRED 2026-09-17. This was inert behind `TODO(v2-writes)` and fired only
    // a haptic, so the send button buzzed and did nothing — the worst shape a
    // control can have, because the buzz confirms the tap landed. It was also
    // the wrong call: the assistant is not an unbuilt feature, it WORKS in the
    // shipped UI, and this screen already mounts the very same
    // `useChatController` that `app/(lab)/chat.tsx` mounts. Nothing needed
    // building; the call had simply never been connected.
    //
    // `send` owns clearing the input and starting the turn (it calls
    // `setInput('')` then `labTurn.start`), so do not clear it here — doing so
    // would race the controller and drop the text it is about to send.
    chat.send(chat.input);
  }, [chat]);

  const onBell = useCallback(() => {
    haptics.tap();
    // Was an EMPTY callback — signed in, the bell did nothing. `index.tsx`
    // already pointed at the shipped notifications screen; two bells in one app
    // should not disagree about whether notifications open.
    // TODO(v2-nav): repoint at a v2 notifications surface if one is drawn.
    requireAuth('notifications', () => router.push(routes.labNotifications));
  }, []);

  const header = (
    <>
      <BrandBar
        language={languageBadge(i18n.language)}
        unread={unreadCount}
        onNotifications={onBell}
        onLanguage={() => {
          haptics.tap();
          setLangOpen(true);
        }}
      />
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text variant="display">Assistant</Text>
          <Text variant="body" color="inkMuted" style={styles.titleSub}>
            {HEADER_SUB[mode]}
          </Text>
        </View>
        {/* Only offered once there is something to clear — an empty thread has
            no "new" to start. */}
        {hasThread ? (
          <IconAction
            tone="quiet"
            accessibilityLabel="New chat"
            accessibilityHint="Starts a fresh conversation. This one is not kept."
            onPress={onNewChat}
            icon={<SquarePen size={icon.xl} color={c.ink} strokeWidth={1.8} />}
            testID="v2-chat-new"
          />
        ) : null}
      </View>
    </>
  );

  return (
    <Screen header={header} scroll={false} contentStyle={styles.fill} testID="v2-chat">
      <View style={styles.tabsWrap}>
        <Tabs items={MODE_TABS} value={mode} onChange={onModeChange} rule gutter />
      </View>

      <Animated.View style={[styles.fill, avoidStyle]}>
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onContentSizeChange={onContentSizeChange}
          testID="v2-chat-thread"
        >
          {/* A wrapper, not a fragment: the thread container spaces its children
              with `gap`, and the openers space themselves with hairlines. */}
          {!hasThread ? (
            <View>
              <SectionHeader title="Try asking" />
              {STARTERS[mode].map((prompt, i) => (
                <React.Fragment key={prompt}>
                  {i > 0 ? <Hairline /> : null}
                  <Row
                    title={prompt}
                    titleVariant="row"
                    titleLines={2}
                    onPress={() => onStarter(prompt)}
                    // KIT GAP: `Row` takes no `accessibilityHint`, so "puts
                    // this in the message box" has to ride in the label.
                    accessibilityLabel={`${prompt}. Fills the message box.`}
                    testID={`v2-chat-starter-${i}`}
                  />
                </React.Fragment>
              ))}
            </View>
          ) : null}

          {chat.viewMessages.map((m) => (
            <MessageRow key={m.id} message={m} onRetry={chat.onRetry} />
          ))}

          <LiveAnswer mode={chat.apiMode} />
        </ScrollView>

        <Hairline />

        <View style={styles.composer}>
          {staged.length > 0 ? (
            <View style={styles.stagedRow}>
              {staged.map((a) => (
                <StagedChip
                  key={a.uri}
                  label={a.name}
                  onRemove={() => {
                    haptics.tap();
                    useComposer.getState().removeAttachment(a.uri);
                  }}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.composerRow}>
            {/* flat: PENDING — same call as the kit's Field. */}
            <View style={[styles.field, { backgroundColor: c.surface }]}>
              <GlyphButton label="Take a photo" onPress={() => void picker.pickCamera()}>
                <Camera size={icon.xl} color={c.inkMuted} strokeWidth={1.8} />
              </GlyphButton>
              <GlyphButton label="Attach a document" onPress={() => void picker.pickDocument()}>
                <Paperclip size={icon.lg} color={c.inkMuted} strokeWidth={1.8} />
              </GlyphButton>
              <TextInput
                ref={inputRef}
                value={chat.input}
                onChangeText={chat.setInput}
                placeholder={PLACEHOLDER[mode]}
                placeholderTextColor={c.inkDisabled}
                multiline
                accessibilityLabel={PLACEHOLDER[mode]}
                style={[styles.input, typeScale.body, { color: c.ink }]}
                testID="v2-chat-input"
              />
            </View>

            {/* One control, two jobs: Stop while a turn is live, Send otherwise. */}
            {chat.liveActive ? (
              <IconAction
                accessibilityLabel="Stop"
                onPress={() => {
                  haptics.tap();
                  // Not a write — it kills the in-flight stream and settles the
                  // turn locally.
                  chat.stop();
                }}
                icon={<Square size={icon.md} color={c.onAccent} strokeWidth={2.4} />}
                testID="v2-chat-stop"
              />
            ) : (
              <IconAction
                accessibilityLabel="Send"
                disabled={!canSend}
                onPress={onSend}
                icon={<ArrowUp size={icon['2xl']} color={c.onAccent} strokeWidth={2.2} />}
                testID="v2-chat-send"
              />
            )}
          </View>
        </View>
      </Animated.View>

      <LanguageSheet visible={langOpen} onClose={() => setLangOpen(false)} />
    </Screen>
  );
}

/**
 * One committed message.
 *
 * `onRetry` is threaded in from the screen rather than pulled from a store: the
 * controller is mounted once, at the screen, and a second `useChatController`
 * in here would open its own conversation.
 */
function MessageRow({ message, onRetry }: { message: Message; onRetry: (text: string) => void }) {
  if (message.role === 'user') {
    return <UserBubble text={messageText(message)} attachments={message.attachments} />;
  }
  const failed = isErrorMessage(message);
  return (
    <AssistantTurn
      text={resolveBotText(messageText(message), message.cards)}
      failed={failed}
      cards={failed ? undefined : message.cards}
      // WIRED 2026-09-17, alongside send. A failed turn now offers "Try again"
      // and re-sends the original text. It was `undefined` while sending was
      // inert — correct then, because offering a retry that cannot retry is
      // worse than not offering one.
      onRetry={failed ? () => onRetry(message.retry ?? '') : undefined}
    />
  );
}

/**
 * "New chat" mints a fresh `conversation_id` and REMOUNTS the thread.
 *
 * The remount is not cosmetic: `useChatController` reads the conversation id
 * once, on mount, and keys the committed history by it. Resetting the session
 * without remounting would leave the controller pointing at the old id — a new
 * conversation on the server, the old one on screen.
 */
export default function V2Chat() {
  const [threadKey, setThreadKey] = useState(0);

  const onNewChat = useCallback(() => {
    haptics.tap();
    useThread.getState().reset();
    useSession.getState().reset();
    setThreadKey((k) => k + 1);
  }, []);

  return <ChatScreen key={threadKey} onNewChat={onNewChat} />;
}

const styles = StyleSheet.create({
  /** `Screen` measures its body with `width:100%` and no flex; the thread's
   *  ScrollView inside that collapses to zero height without this. */
  fill: { flex: 1 },

  // ── header sheet ──
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space['3xl'],
  },
  titleCol: { flex: 1, minWidth: 0 },
  titleSub: { marginTop: space.md, maxWidth: HEADER_SUB_MEASURE },

  // ── tabs ──
  tabsWrap: { paddingTop: space['5xl'] },

  // ── thread ──
  thread: {
    flexGrow: 1,
    paddingTop: space['6xl'],
    paddingBottom: SECTION_GAP,
    gap: space['5xl'],
  },
  rowLeft: { alignItems: 'flex-start', width: '100%' },
  rowRight: { alignItems: 'flex-end', width: '100%', paddingHorizontal: GUTTER },
  userBubble: {
    maxWidth: '86%',
    borderRadius: radius.lg,
    paddingHorizontal: space['3xl'],
    paddingVertical: space.xl,
    gap: space.md,
  },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },

  // ── prose ──
  prose: { width: '100%', paddingHorizontal: GUTTER },
  proseLine: { width: '100%' },
  proseHeading: { marginTop: space.md, marginBottom: space.xs },
  /** A blank line in the answer. Half a line, not a full one — the design's
   *  paragraphs breathe through leading, not through empty rows. */
  proseGap: { height: space.lg },
  bulletRow: { flexDirection: 'row', gap: space.md },
  bulletText: { flex: 1, minWidth: 0 },
  working: { paddingHorizontal: GUTTER },

  // ── composer ──
  composer: { paddingHorizontal: GUTTER, paddingTop: space.xl, gap: space.lg },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: control.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2xl'],
    paddingHorizontal: space['3xl'],
    borderRadius: radius.xl,
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxHeight: INPUT_MAX_HEIGHT,
    // Android gives a multiline TextInput its own, larger vertical padding.
    // Pin it so the field's 52pt minHeight is what centres a single line, while
    // leaving enough room that descenders are never clipped.
    paddingVertical: space.md,
  },
  stagedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
