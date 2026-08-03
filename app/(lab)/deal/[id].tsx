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
// the server conversation, loads history, appends live inbound messages, sends.
//
// Layout: Header (fixed) → pinned ListingContextCard → Thread (flex:1, scrolls) →
// QuickReplies → Composer, inside a bottom-safe KeyboardAvoidingView. Tab bar
// HIDDEN (stack-level route). The socket/data logic is untouched — this screen
// only elevates the chrome to the redesign mockup.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Info } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Text } from '@/components/ui';
import { brand, fonts, greenDarkest, greenLight, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useChatThread } from '@/features/lab/messages/useChatThread';
import { fetchBatchSeller } from '@/features/lab/messages/chatApi';
import { useSocketConnected } from '@/features/lab/messages/socket';
import { ProductThumb } from '@/features/lab/components';
import { MessageBubble } from '@/features/lab/messages/components/MessageBubble';
import { ChatComposer } from '@/features/lab/messages/components/ChatComposer';
import { DateDivider } from '@/features/lab/messages/components/DateDivider';

// Counterparty avatar tints — same palette as the inbox ConversationRow so the
// same seller reads with the same colour across the Messages surface.
const AVATAR_BG = ['#1f6b4a', '#2a7d59', '#36916a', '#0E3B2E', '#16794A'] as const;
// Quick-reply i18n keys — the displayed AND sent text is the localized string.
const QUICK_REPLY_KEYS = ['stillAvailable', 'shipToBangkok', 'bestPrice'] as const;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** ISO → "Today" / "Yesterday" / "Jun 30". Null-safe → "Today". */
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

  const connected = useSocketConnected();
  const { messages, isLoading, isError, hasMore, isLoadingOlder, loadOlder, send, canSend, reload } =
    useChatThread({ batchId, otherPartyId });

  // There is no counterparty to open a room with, so the thread can never work.
  // Kept separate from `isError` (which means the API call itself failed).
  const sellerUnresolved = sellerFailed && !Number.isFinite(otherPartyId);

  const avatarColor = AVATAR_BG[Math.abs((otherPartyId || 0) + (batchId || 0)) % AVATAR_BG.length];
  const dividerLabel = useMemo(() => dayLabel(t, messages[0]?.createdAt), [messages, t]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }, []);

  // Follow only when a NEW message lands at the TAIL (send/receive) — NOT when
  // "Load earlier" PREPENDS older messages (which also grows the count but must
  // preserve the reader's position). Track the last tail key, not the count.
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

  // No customer-facing listing detail route in the (lab) flow yet — mirror the
  // match screen's "not-yet-built destination" pattern with a toast fallback.
  const openListing = useCallback(() => {
    toast(t('mobile.labDeal.listingSoon'));
  }, [t]);

  // Guarded send: the thread has NO optimistic bubble (it waits for the server
  // echo), so sending while the socket is down would vanish silently. Block it
  // with clear feedback and return `false` so the composer keeps the text.
  const handleSend = useCallback(
    (text: string): boolean | void => {
      if (!connected) {
        haptics.tap();
        toast(t('mobile.labDeal.offlineSend'));
        return false;
      }
      send(text);
    },
    [connected, send, t],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header — back · avatar (online dot) · name + verified + status · info */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('mobile.labDeal.back')} style={styles.iconBtn}>
          <ChevronLeft size={24} color={lab.ink} />
        </Pressable>

        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initialsOf(counterparty)}</Text>
          {connected ? <View style={styles.onlineDot} /> : null}
        </View>

        <View style={styles.headerCenter}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {counterparty}
            </Text>
            <BadgeCheck size={15} color={greenMedium} strokeWidth={2.2} />
          </View>
          <Text numberOfLines={1} style={[styles.status, connected ? styles.statusOnline : styles.statusOffline]}>
            {connected ? t('mobile.labDeal.activeNow') : t('mobile.labDeal.connecting')}
          </Text>
        </View>

        <Pressable onPress={openListing} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('mobile.labDeal.listingInfo')} style={styles.iconBtn}>
          <Info size={20} color={lab.inkMeta} />
        </Pressable>
      </View>

      {/* Pinned listing context — inlined here (using this screen's working
          StyleSheet) rather than the extracted component, whose styles failed to
          bind on the dev client. Fixed under the header, above the thread. */}
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

      <KeyboardAvoidingView behavior="padding" style={styles.flex} keyboardVerticalOffset={insets.top}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
        >
          {sellerUnresolved ? (
            // Distinct from isError: we never reached the conversation API at all
            // because there is no counterparty to open a room with.
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>{t('mobile.labDeal.sellerUnresolvedTitle')}</Text>
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
          ) : isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={brand.primary} />
              <Text style={styles.centeredText}>{t('mobile.labDeal.loadingConversation')}</Text>
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <Text style={styles.centeredText}>{t('mobile.labDeal.errorOpen')}</Text>
              <View style={styles.recoveryRow}>
                <Pressable onPress={reload} style={styles.recoveryBtn} accessibilityRole="button">
                  <Text style={styles.recoveryBtnText}>{t('mobile.labCommon.retry')}</Text>
                </Pressable>
              </View>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>{t('mobile.labDeal.startTitle')}</Text>
              <Text style={styles.centeredText}>{t('mobile.labDeal.startBody', { name: counterparty })}</Text>
            </View>
          ) : (
            <>
              {hasMore ? (
                <Pressable onPress={loadOlder} disabled={isLoadingOlder} style={styles.loadOlder} accessibilityRole="button">
                  <Text style={styles.loadOlderText}>
                    {isLoadingOlder ? t('mobile.labDeal.loadingShort') : t('mobile.labDeal.loadEarlier')}
                  </Text>
                </Pressable>
              ) : null}
              <DateDivider label={dividerLabel} />
              {/* System note — honest privacy notice, not fabricated provenance. */}
              <View style={styles.sysChip}>
                <CheckCircle2 size={13} color={greenMedium} strokeWidth={2.2} />
                <Text style={styles.sysText}>{t('mobile.labDeal.privateNote', { name: firstName })}</Text>
              </View>
              {messages.map((m) => (
                <MessageBubble key={m.key} msg={m} />
              ))}
            </>
          )}
        </ScrollView>

        {/* Quick replies — inlined (same reason as the listing card). */}
        {canSend ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.qrScroll}
            contentContainerStyle={styles.qrRow}
          >
            {QUICK_REPLY_KEYS.map((k) => {
              const r = t(`mobile.labDeal.quickReplies.${k}`);
              return (
                <Pressable
                  key={k}
                  onPress={() => {
                    haptics.impact();
                    handleSend(r);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('mobile.labDeal.sendQuick', { text: r })}
                  style={styles.qrChip}
                >
                  <Text style={styles.qrText}>{r}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        {/* Hidden, not merely disabled, when there is no seller to send to —
            the recovery block above owns the screen in that case and an inert
            input next to it just re-invites the tap that does nothing. */}
        {sellerUnresolved ? null : (
          <ChatComposer
            placeholder={t('mobile.labDeal.composerPlaceholder', { name: firstName })}
            disabled={!canSend}
            offline={!connected}
            onSend={handleSend}
          />
        )}
        <View style={{ height: Math.max(insets.bottom, 8), backgroundColor: brand.surface }} />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lab.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: lab.hairline,
    backgroundColor: brand.surface,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 14, color: '#EAF3EC' },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: radius.full,
    backgroundColor: greenLight,
    borderWidth: 2,
    borderColor: brand.surface,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerTitle: { fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 20, color: lab.ink, flexShrink: 1 },
  status: { fontFamily: fonts.labelMedium, fontSize: 11, lineHeight: 14, marginTop: 1 },
  statusOnline: { color: greenMedium },
  statusOffline: { color: lab.inkMeta },
  ctx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: 14,
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
  qrScroll: { flexGrow: 0, flexShrink: 0 },
  qrRow: { gap: spacing.sm, paddingHorizontal: 14, paddingTop: spacing.sm, paddingBottom: spacing.xs, alignItems: 'center' },
  qrChip: {
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: 1,
    borderColor: greenLight,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  qrText: { fontFamily: fonts.semibold, fontSize: 11.5, lineHeight: 15, color: greenDarkest },
  threadContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
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
  },
  sysText: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 15, color: greenDarkest, flexShrink: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 80 },
  centeredText: { fontFamily: fonts.regular, fontSize: 13, color: lab.inkSub, textAlign: 'center', maxWidth: 260 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: lab.ink },
  loadOlder: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14 },
  loadOlderText: { fontFamily: fonts.semibold, fontSize: 12.5, color: brand.primary },
  // Recovery actions for the two dead-end states (no seller / open failed).
  recoveryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  recoveryBtn: {
    backgroundColor: brand.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  recoveryBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' },
  recoveryBtnGhost: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: lab.utilBorder,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  recoveryBtnGhostText: { fontFamily: fonts.semibold, fontSize: 13, color: lab.inkSub },
});
