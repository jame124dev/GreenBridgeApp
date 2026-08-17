// (lab) Conversation thread — a DIRECT buyer↔seller chat (the mobile port of the
// web `101lab-2` messages thread). Replaces the old concierge "Deal Room": no
// managed-deal framing, just a real-time 1:1 conversation over the shared socket.
//
// Params: `id` = batch id (the listing), `sellerId` = the counterparty user id,
// `name` = counterparty display name (header). `listingTitle` / `listingImage`
// are OPTIONAL context for the pinned listing card — read null-safely (callers
// may omit them; we fall back to "Listing #{batchId}"). Both entry points supply
// id/sellerId/name — the Messages inbox row (seller.batch_id + seller.ID) and the
// Match Detail "Contact seller" CTA. `useChatThread` joinChats to resolve/join
// the server conversation, loads history, appends live messages, sends.
//
// Layout: Header (fixed) → pinned listing card → Thread (flex:1, scrolls) →
// Composer. Tab bar HIDDEN (stack-level route).
//
// ── Redesign notes (UX_DESIGN_RULES) ──────────────────────────────────────
// • HEADER: back + avatar + name + overflow, and nothing else. The old header
//   also carried an Info button that called openListing() — the exact action the
//   pinned card below it already performs — plus an unconditional "verified"
//   badge with no data behind it. Both are gone: the duplicate control (rules:
//   "Remove duplication") and a trust mark we cannot substantiate. Report/block
//   stays on the overflow (App Store Guideline 1.2 requires both). The name now
//   gets ~50dp more width, so real seller names stop truncating at two words.
// • NO PRESENCE CLAIM. The old "● Active now" line claimed the COUNTERPARTY was
//   present when all we know is that OUR socket is up. Its replacement — a green
//   dot on the seller's avatar, driven by our own socket state — was the SAME
//   claim in the universal "this person is online" idiom, only harder to notice
//   and harder to argue with. The backend reports no presence for a thread (the
//   inbox row's optional `online`/`is_online` is the only presence field that
//   exists anywhere, and this route doesn't carry it), so there is no dot. The
//   text status line is the only connection signal, and it describes OUR
//   transport in OUR words: "Connecting…" before the first connect, "Reconnecting…"
//   once a connection has actually been lost.
// • DAY DIVIDERS: one per calendar-day change (see buildThreadRows), not one
//   stale label computed from messages[0].
// • GROUPING: consecutive messages from one sender inside GROUP_WINDOW_MS render
//   as a group — tight spacing, one timestamp, tail radius on the last bubble.
// • STARTERS: the canned openers PREFILL the composer (focused, editable) rather
//   than sending on tap, and live inside the empty state only — they are
//   conversation starters, not permanent chrome.
// • KEYBOARD: one animated container padded by max(keyboardHeight, safeArea) —
//   the same primitive the AI chat uses. The old stack (KeyboardAvoidingView
//   behavior="padding" + keyboardVerticalOffset={insets.top} + a static bottom
//   spacer) double-counted the inset: a dead gap above the raised keyboard on
//   Android edge-to-edge.
// • SEND IS NEVER REFUSED. This screen used to hard-gate `handleSend` on the
//   socket being connected and toast "You're offline — reconnecting", which fired
//   during the normal handshake window and on every resume/flap — telling a user
//   on a healthy network that their network was the problem, and swallowing the
//   tap. The outbox in useChatThread exists precisely for this: the bubble paints,
//   says "Waiting for connection…" while the socket is down, and is emitted on
//   reconnect. The composer keeps a muted send button while we KNOW we are offline
//   (status === 'offline'), but it never blocks and never accuses.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { CheckCircle2, ChevronLeft, ChevronRight, MessageCircle, MoreVertical } from 'lucide-react-native';
import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, greenLight, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useKeyboardInset } from '@/features/lab/chat/hooks/useKeyboardInset';
import { useChatThread, type ThreadMessage } from '@/features/lab/messages/useChatThread';
import { fetchBatchSeller } from '@/features/lab/messages/chatApi';
import { useSocketStatus } from '@/features/lab/messages/socket';
import { ProductThumb } from '@/features/lab/components';
import { MessageBubble } from '@/features/lab/messages/components/MessageBubble';
import { ChatComposer, type ChatComposerRef } from '@/features/lab/messages/components/ChatComposer';
import { DateDivider } from '@/features/lab/messages/components/DateDivider';
import { ReportBlockSheet } from '@/features/lab/messages/ReportBlockSheet';
import { isBlocked, subscribeBlocked } from '@/features/lab/messages/blockList';

// Counterparty avatar tints — same palette as the inbox ConversationRow so the
// same seller reads with the same colour across the Messages surface.
const AVATAR_BG = ['#1f6b4a', '#2a7d59', '#36916a', '#0E3B2E', '#16794A'] as const;
// Conversation-starter i18n keys. This constant IS the contract — the three keys
// are only ever referenced through the template literal below, so renaming or
// trimming it orphans gated locale entries silently.
const QUICK_REPLY_KEYS = ['stillAvailable', 'shipToBangkok', 'bestPrice'] as const;
// Messages from one sender closer together than this belong to the same group.
const GROUP_WINDOW_MS = 5 * 60_000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** ISO → "Today" / "Yesterday" / "Jun 30". Null-safe → "Today". Uses the gated
 *  `months` ARRAY (12 entries, indices 0-11) — keep that shape. */
function dayLabel(t: TFunction, iso?: string | null): string {
  if (!iso) return t('mobile.labDeal.today');
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return t('mobile.labDeal.today');
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return t('mobile.labDeal.today');
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return t('mobile.labDeal.yesterday');
  return `${t(`mobile.labDeal.months.${d.getMonth()}`)} ${d.getDate()}`;
}

/** Local calendar-day identity (NOT a label) — the divider boundary test.
 *  Null when the timestamp is missing/unparseable. */
function dayKeyOf(iso?: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type ThreadRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: ThreadMessage; firstInGroup: boolean; lastInGroup: boolean };

/** Flatten the message list into render rows: a DateDivider at every calendar-day
 *  change, plus per-bubble group flags.
 *
 *  A message with no parseable timestamp inherits the current day rather than
 *  inventing a boundary — an unknown time is not evidence of a new day. */
function buildThreadRows(messages: ThreadMessage[], t: TFunction): ThreadRow[] {
  const rows: ThreadRow[] = [];
  let prevDay: string | null = null;
  let prevMine: boolean | null = null;
  let prevTs = 0;

  messages.forEach((msg, i) => {
    const parsed = msg.createdAt ? Date.parse(msg.createdAt) : NaN;
    const ts = Number.isNaN(parsed) ? prevTs : parsed;
    const day = dayKeyOf(msg.createdAt) ?? prevDay;
    // `|| i === 0` so the FIRST row always opens a day: without it a leading
    // message whose timestamp is missing produced no divider, and the next
    // message's divider then rendered BELOW it — visually filing that first
    // message under an earlier day.
    const newDay = day !== prevDay || i === 0;
    if (newDay) {
      rows.push({ kind: 'day', key: `day-${day ?? 'x'}-${i}`, label: dayLabel(t, msg.createdAt) });
    }
    // A group opens on the first message, across a day break, when the sender
    // flips, or after a quiet gap.
    const firstInGroup = newDay || prevMine !== msg.mine || ts - prevTs > GROUP_WINDOW_MS;
    rows.push({ kind: 'msg', key: msg.key, msg, firstInGroup, lastInGroup: true });
    prevDay = day;
    prevMine = msg.mine;
    prevTs = ts;
  });

  // A bubble closes its group unless the very next row is a message continuing it.
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind !== 'msg') continue;
    const next = rows[i + 1];
    row.lastInGroup = next == null || next.kind !== 'msg' || next.firstInGroup;
  }
  return rows;
}

export default function LabConversation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    id?: string;
    sellerId?: string;
    name?: string;
    listingTitle?: string;
    listingImage?: string;
  }>();

  const batchId = Number(params.id);
  const paramSellerId = Number(params.sellerId);
  // "Contact seller" from the WTB matches/wants flow knows the batch but NOT the
  // seller (the match snapshot omits seller_id), so it navigates here with just
  // the batch. Resolve the seller from the batch on-demand so the thread opens
  // the RIGHT conversation instead of bouncing to the Messages inbox.
  const [resolvedSeller, setResolvedSeller] = useState<{ id: number; name: string | null } | null>(
    null,
  );
  // Resolution has to be tracked explicitly. Leaving `otherPartyId` as NaN does
  // NOT produce an error state: useChatThread's open effect early-returns on a
  // non-finite id without ever setting isError, so the screen fell through to
  // the "Start the conversation" empty state WITH a disabled composer — it
  // invited the one action it could not perform, and tapping send did nothing.
  // Both failure paths below have to be caught: the request rejecting, AND it
  // resolving with a null sellerId.
  const [sellerFailed, setSellerFailed] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  // Guideline 1.2: report / block. `blocked` mirrors the persisted list and is
  // re-read whenever it changes, so blocking from the sheet updates this screen.
  const [reportOpen, setReportOpen] = useState(false);
  const [blockedTick, setBlockedTick] = useState(0);
  useEffect(() => subscribeBlocked(() => setBlockedTick((n) => n + 1)), []);
  const sellerKnown = Number.isFinite(paramSellerId) && paramSellerId > 0;
  useEffect(() => {
    if (sellerKnown) return; // seller already known
    if (!Number.isFinite(batchId)) {
      setSellerFailed(true);
      return;
    }
    let alive = true;
    setSellerFailed(false);
    fetchBatchSeller(batchId)
      .then((s) => {
        if (!alive) return;
        if (s.sellerId != null) setResolvedSeller({ id: s.sellerId, name: s.sellerName });
        else setSellerFailed(true); // resolved, but the batch has no seller
      })
      .catch(() => {
        if (alive) setSellerFailed(true); // never silently leave the composer dead
      });
    return () => {
      alive = false;
    };
  }, [batchId, sellerKnown, resolveAttempt]);

  const retryResolve = useCallback(() => {
    setSellerFailed(false);
    setResolvedSeller(null);
    setResolveAttempt((n) => n + 1);
  }, []);

  const otherPartyId =
    Number.isFinite(paramSellerId) && paramSellerId > 0 ? paramSellerId : resolvedSeller?.id ?? NaN;
  const counterparty =
    typeof params.name === 'string' && params.name.trim()
      ? params.name
      : resolvedSeller?.name ?? t('mobile.labDeal.sellerFallback');
  const listingTitle = typeof params.listingTitle === 'string' && params.listingTitle.trim() ? params.listingTitle : null;
  const listingImage = typeof params.listingImage === 'string' && params.listingImage.trim() ? params.listingImage : null;
  // First name for the composer placeholder / privacy note.
  const firstName = counterparty.trim().split(/\s+/)[0] || counterparty;

  // 'connecting' | 'connected' | 'offline'. Three states, not a boolean: the
  // pre-connect window must never be described as being offline.
  const socketStatus = useSocketStatus();
  const {
    messages,
    isLoading,
    isError,
    hasMore,
    isLoadingOlder,
    loadOlder,
    send,
    retrySend,
    canSend,
    reload,
  } = useChatThread({ batchId, otherPartyId });

  // There is no counterparty to open a room with, so the thread can never work.
  // Kept separate from `isError` (which means the API call itself failed).
  const sellerUnresolved = sellerFailed && !Number.isFinite(otherPartyId);
  // Guideline 1.2: a blocked counterparty must genuinely be unable to reach the
  // user — the composer goes away and a clear notice replaces it. blockedTick is
  // read so this recomputes when the persisted list changes.
  const blocked = useMemo(
    () => (Number.isFinite(otherPartyId) ? isBlocked(otherPartyId) : false),
    // blockedTick is the invalidation signal from the persisted list.
    [otherPartyId, blockedTick],
  );

  const avatarColor = AVATAR_BG[Math.abs((otherPartyId || 0) + (batchId || 0)) % AVATAR_BG.length];
  const rows = useMemo(() => buildThreadRows(messages, t), [messages, t]);
  // The "Contact seller" entry point arrives with no sellerId, so there is a
  // window where fetchBatchSeller is still in flight: otherPartyId is NaN,
  // useChatThread's open effect early-returns WITHOUT setting isError, and
  // `sellerFailed` is still false. Without this flag the screen showed
  // "Start the conversation" for a thread that may already hold 40 messages —
  // spinner → false empty state → spinner → the real thread.
  const resolvingSeller = !sellerKnown && resolvedSeller == null && !sellerFailed;
  // The one state that gets the starter treatment: a live thread with nothing in
  // it yet. Loading / resolving / error / no-seller each own the screen instead.
  const showStarters =
    !sellerUnresolved && !resolvingSeller && !isLoading && !isError && messages.length === 0;

  const composerRef = useRef<ChatComposerRef>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  // Keyboard avoidance — ONE animated padding equal to max(live keyboard height,
  // bottom safe area). Keyboard up → the composer sits flush on it; keyboard
  // closed → it clears the Android 3-button nav bar. Never both.
  const keyboardInset = useKeyboardInset();
  const keyboardAvoidStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboardInset.value, insets.bottom),
  }));

  // The container SHRINKS when the keyboard opens, which leaves the scroll offset
  // where it was and pushes the newest message below the fold. Re-pin the tail so
  // the message being replied to stays visible above the composer.
  useEffect(() => {
    const sub = KeyboardEvents.addListener('keyboardDidShow', () => scrollToEnd());
    return () => sub.remove();
  }, [scrollToEnd]);

  // Follow only when a NEW message lands at the TAIL (send/receive) — NOT when
  // "Load earlier" PREPENDS older messages (which also grows the count but must
  // preserve the reader's position). Track the last tail key, not the count.
  // The optimistic bubble changes this key on send, so the thread follows the
  // user's own message the instant they tap.
  const lastTailKey = useRef<string | null>(null);
  useEffect(() => {
    const tailKey = messages.length ? messages[messages.length - 1].key : null;
    if (tailKey && tailKey !== lastTailKey.current) {
      const first = lastTailKey.current === null;
      lastTailKey.current = tailKey;
      scrollToEnd(!first);
    } else {
      lastTailKey.current = tailKey;
    }
  }, [messages, scrollToEnd]);

  const goBack = useCallback(() => {
    haptics.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/(lab)/(tabs)/deals');
  }, [router]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);

  // The pinned card is the ONLY "open the listing" control on the screen (the
  // header's duplicate Info button was removed), and it resolves for real: the
  // (lab) product detail route exists, is registered in app/(lab)/_layout.tsx and
  // takes exactly the params this screen already holds. It used to toast "Full
  // listing view coming soon" behind a green "View ›" chip — the one surviving
  // affordance on the screen, promising a destination that had shipped.
  const openListing = useCallback(() => {
    haptics.tap();
    router.push({
      pathname: '/(lab)/product/[id]',
      params: { id: String(batchId), name: listingTitle ?? '' },
    });
  }, [router, batchId, listingTitle]);

  // Send is never refused for connection reasons: `send` paints the bubble and
  // the outbox delivers it (now, or on reconnect). It returns `false` only when
  // there is genuinely nothing to send or no open conversation — the one case
  // where the composer must keep the draft.
  const handleSend = useCallback((text: string): boolean => send(text), [send]);

  const handleRetry = useCallback(
    (pendingId: string) => {
      haptics.impact();
      retrySend(pendingId);
    },
    [retrySend],
  );

  /** Starters seed the composer instead of sending: the user can edit, add to it
   *  or think again, and the caret is already where they'd type next. */
  const applyStarter = useCallback((text: string) => {
    haptics.tap();
    composerRef.current?.prefill(text);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — back · avatar · name · report/block. Two icon buttons only; the
          name owns everything in between. No presence dot: see the note at the
          top of this file. */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('mobile.labDeal.back')} style={styles.iconBtn}>
          <ChevronLeft size={24} color={lab.ink} />
        </Pressable>

        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initialsOf(counterparty)}</Text>
        </View>

        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {counterparty}
          </Text>
          {/* Only shown while OUR socket is not live, and it says which of the two
              non-live states we are in. Never a claim about the other person. */}
          {socketStatus === 'connected' ? null : (
            <Text numberOfLines={1} style={styles.status}>
              {socketStatus === 'offline'
                ? t('mobile.labDeal.reconnecting', { defaultValue: 'Reconnecting…' })
                : t('mobile.labDeal.connecting')}
            </Text>
          )}
        </View>

        {/* Report / block — App Store Guideline 1.2 requires a UGC + messaging
            app to offer both. See ReportBlockSheet / blockList. DISABLED while
            there is no counterparty id: the sheet below is gated on the same
            condition, so an enabled button there opened nothing at all. */}
        <Pressable
          onPress={() => setReportOpen(true)}
          disabled={!Number.isFinite(otherPartyId)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.labReport.openMenu')}
          accessibilityState={{ disabled: !Number.isFinite(otherPartyId) }}
          style={[styles.iconBtn, !Number.isFinite(otherPartyId) && styles.iconBtnDisabled]}
          testID="deal-overflow"
        >
          <MoreVertical size={20} color={lab.inkSub} />
        </Pressable>
      </View>

      {/* Pinned listing context — inlined here (using this screen's working
          StyleSheet) rather than the extracted component, whose styles failed to
          bind on the dev client. Fixed under the header, above the thread. This
          is the single "open the listing" affordance on the screen. */}
      {Number.isFinite(batchId) ? (
        <Pressable onPress={openListing} style={styles.ctx} accessibilityRole="button" accessibilityLabel={t('mobile.labDeal.viewListingA11y', { id: params.id })}>
          <ProductThumb uri={listingImage ?? undefined} size={40} radius={radius.md} kind="machine" />
          <View style={styles.ctxInfo}>
            <Text numberOfLines={1} style={styles.ctxTitle}>
              {listingTitle ?? t('mobile.labDeal.listingNumber', { id: params.id })}
            </Text>
            <Text numberOfLines={1} style={styles.ctxMeta}>
              {listingTitle ? t('mobile.labDeal.listingNumber', { id: params.id }) : t('mobile.labDeal.tapToView')}
            </Text>
          </View>
          <View style={styles.ctxView}>
            <Text style={styles.ctxViewText}>{t('mobile.labDeal.view')}</Text>
            <ChevronRight size={13} color={greenDarkest} strokeWidth={2.4} />
          </View>
        </Pressable>
      ) : null}

      <Animated.View style={[styles.flex, keyboardAvoidStyle]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          // flexGrow keeps the container at least a viewport tall so the centred
          // states actually centre; an EMPTY thread bottom-aligns so its starters
          // sit right on top of the composer ("keep the primary action close")
          // instead of floating in the middle with dead space beneath.
          contentContainerStyle={[
            styles.threadContent,
            { flexGrow: 1, justifyContent: showStarters ? 'flex-end' : 'flex-start' },
          ]}
          keyboardShouldPersistTaps="handled"
          testID="deal-thread"
        >
          {sellerUnresolved ? (
            // Distinct from isError: we never reached the conversation API at all
            // because there is no counterparty to open a room with.
            <View style={styles.centered}>
              <Text style={styles.centeredTitle}>{t('mobile.labDeal.sellerUnresolvedTitle')}</Text>
              <Text style={styles.centeredText}>{t('mobile.labDeal.sellerUnresolvedBody')}</Text>
              <View style={styles.recoveryRow}>
                <Pressable onPress={retryResolve} style={styles.recoveryBtn} accessibilityRole="button">
                  <Text style={styles.recoveryBtnText}>{t('mobile.labCommon.retry')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.replace('/(lab)/(tabs)/deals')}
                  style={styles.recoveryBtnGhost}
                  accessibilityRole="button"
                >
                  <Text style={styles.recoveryBtnGhostText}>{t('mobile.labDeal.goToMessages')}</Text>
                </Pressable>
              </View>
            </View>
          ) : isLoading || resolvingSeller ? (
            // Says WHAT is loading, not just "please wait". `resolvingSeller` is
            // in here so the seller-lookup window shows THIS, not a false
            // "Start the conversation" over a thread that already has messages.
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={brand.primary} />
              <Text style={styles.centeredTitle}>{t('mobile.labDeal.loadingConversation')}</Text>
              <Text style={styles.centeredText}>
                {t('mobile.labDeal.loadingBody', {
                  name: firstName,
                  defaultValue: 'Connecting to the chat service and fetching your messages with {{name}}.',
                })}
              </Text>
            </View>
          ) : isError ? (
            // What happened, why, and two ways out — Retry is the primary.
            <View style={styles.centered}>
              <Text style={styles.centeredTitle}>
                {t('mobile.labDeal.errorOpenTitle', { defaultValue: "Couldn't open this conversation" })}
              </Text>
              <Text style={styles.centeredText}>
                {t('mobile.labDeal.errorOpenBody', {
                  defaultValue:
                    "We couldn't reach the chat service. Check your connection and try again, or go back to your messages.",
                })}
              </Text>
              <View style={styles.recoveryRow}>
                <Pressable onPress={reload} style={styles.recoveryBtn} accessibilityRole="button" testID="deal-error-retry">
                  <Text style={styles.recoveryBtnText}>{t('mobile.labCommon.retry')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.replace('/(lab)/(tabs)/deals')}
                  style={styles.recoveryBtnGhost}
                  accessibilityRole="button"
                >
                  <Text style={styles.recoveryBtnGhostText}>{t('mobile.labDeal.goToMessages')}</Text>
                </Pressable>
              </View>
            </View>
          ) : showStarters ? (
            // Empty state = heading → description → reassurance → the next
            // action, stacked directly above the composer.
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={24} color={greenMedium} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>{t('mobile.labDeal.startTitle')}</Text>
              <Text style={styles.emptyBody}>{t('mobile.labDeal.startBody', { name: counterparty })}</Text>
              <View style={styles.sysChip}>
                <CheckCircle2 size={13} color={greenMedium} strokeWidth={2.2} />
                <Text style={styles.sysText}>{t('mobile.labDeal.privateNote', { name: firstName })}</Text>
              </View>
              {canSend ? (
                <View style={styles.starters}>
                  <Text style={styles.startersLabel}>
                    {t('mobile.labDeal.startersLabel', { defaultValue: 'Not sure where to start?' })}
                  </Text>
                  {QUICK_REPLY_KEYS.map((k) => {
                    const r = t(`mobile.labDeal.quickReplies.${k}`);
                    return (
                      <Pressable
                        key={k}
                        onPress={() => applyStarter(r)}
                        accessibilityRole="button"
                        accessibilityLabel={t('mobile.labDeal.starterA11y', {
                          text: r,
                          defaultValue: 'Use this opener: {{text}}',
                        })}
                        style={styles.starterChip}
                        testID={`deal-starter-${k}`}
                      >
                        <Text style={styles.starterText}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : (
            <>
              {hasMore ? (
                <Pressable
                  onPress={loadOlder}
                  disabled={isLoadingOlder}
                  hitSlop={10}
                  style={styles.loadOlder}
                  accessibilityRole="button"
                >
                  <Text style={styles.loadOlderText}>
                    {isLoadingOlder ? t('mobile.labDeal.loadingShort') : t('mobile.labDeal.loadEarlier')}
                  </Text>
                </Pressable>
              ) : null}
              {/* System note — honest privacy notice, not fabricated provenance. */}
              <View style={styles.sysChip}>
                <CheckCircle2 size={13} color={greenMedium} strokeWidth={2.2} />
                <Text style={styles.sysText}>{t('mobile.labDeal.privateNote', { name: firstName })}</Text>
              </View>
              {rows.map((row) =>
                row.kind === 'day' ? (
                  <DateDivider key={row.key} label={row.label} />
                ) : (
                  <MessageBubble
                    key={row.key}
                    msg={row.msg}
                    firstInGroup={row.firstInGroup}
                    lastInGroup={row.lastInGroup}
                    onRetry={handleRetry}
                  />
                ),
              )}
            </>
          )}
        </ScrollView>

        {/* Hidden, not merely disabled, when there is no seller to send to —
            the recovery block above owns the screen in that case and an inert
            input next to it just re-invites the tap that does nothing. */}
        {sellerUnresolved ? null : blocked ? (
          <View style={styles.blockedNotice}>
            <Text style={styles.blockedNoticeText}>
              {t('mobile.labReport.blockedNotice', { name: firstName })}
            </Text>
          </View>
        ) : (
          <ChatComposer
            ref={composerRef}
            placeholder={t('mobile.labDeal.composerPlaceholder', { name: firstName })}
            disabled={!canSend}
            // ONLY the observed-offline state mutes the button. `!connected` also
            // meant "handshake in progress", which greyed the primary action on a
            // perfectly healthy device. Muted ≠ disabled either way: the tap still
            // sends, the outbox holds it, and the bubble says it is waiting.
            offline={socketStatus === 'offline'}
            onSend={handleSend}
          />
        )}
      </Animated.View>

      {Number.isFinite(otherPartyId) ? (
        <ReportBlockSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          otherPartyId={otherPartyId}
          otherPartyName={counterparty}
          listingId={params.id}
          onBlocked={goBack}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lab.bg },
  blockedNotice: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lab.utilBorder,
    backgroundColor: lab.utilBg,
  },
  blockedNoticeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: lab.inkSub,
    textAlign: 'center',
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lab.hairline,
    backgroundColor: brand.surface,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnDisabled: { opacity: 0.4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#EAF3EC' },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.headingBold, fontSize: 16.5, lineHeight: 21, color: lab.ink },
  // A connection status the user must be able to READ: inkSub (≈5:1 on the header
  // surface), not inkMeta (3.0:1).
  status: { fontFamily: fonts.labelMedium, fontSize: 11, lineHeight: 14, marginTop: 1, color: lab.inkSub },
  ctx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Same gutter as the bubbles below (threadContent paddingHorizontal), so the
    // pinned card's edges line up with the conversation instead of sitting 2px
    // outside it.
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: 11,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.lg,
  },
  ctxInfo: { flex: 1, minWidth: 0 },
  ctxTitle: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: lab.ink },
  ctxMeta: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: lab.inkSub, marginTop: 2 },
  ctxView: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctxViewText: { fontFamily: fonts.bold, fontSize: 11.5, color: greenDarkest },
  // No `gap` here: MessageBubble owns its own top margin so a group can stack
  // tighter than the space between groups, and DateDivider can out-space both.
  threadContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  sysChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
    backgroundColor: lab.pillBg,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing.md,
  },
  sysText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15, color: greenDarkest, flexShrink: 1 },
  // Centred states (loading / error / no seller) fill the viewport.
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] },
  centeredTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: lab.ink, textAlign: 'center' },
  centeredText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: lab.inkSub, textAlign: 'center', maxWidth: 280 },
  // Empty thread — bottom-aligned by the container, so this hugs the composer.
  empty: { alignItems: 'center', paddingTop: spacing['3xl'], paddingBottom: spacing.xs },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontFamily: fonts.headingBold, fontSize: 18, lineHeight: 24, color: lab.ink, textAlign: 'center' },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: lab.inkSub,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: spacing.xs,
  },
  // Starters: full-width, tappable, and the last thing above the composer.
  starters: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
  startersLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1,
    color: lab.inkSub,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  starterChip: {
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: greenLight,
    borderRadius: radius.lg,
    backgroundColor: lab.pillBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  starterText: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, color: greenDarkest, textAlign: 'center' },
  // The only route to history — a real control, so a real target (44dp + hitSlop),
  // not a 32dp line of text.
  loadOlder: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  loadOlderText: { fontFamily: fonts.semibold, fontSize: 12.5, color: brand.primary },
  // Recovery actions for the dead-end states (no seller / open failed). These are
  // the PRIMARY controls of their state — the ones a user needs when something has
  // already gone wrong — so they get the full 48dp, not 36.
  recoveryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  recoveryBtn: {
    backgroundColor: brand.primary,
    borderRadius: radius.full,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  recoveryBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  recoveryBtnGhost: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: lab.utilBorder,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  recoveryBtnGhostText: { fontFamily: fonts.semibold, fontSize: 13, color: lab.inkSub },
});
