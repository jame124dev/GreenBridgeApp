// (lab) Messages — the buyer↔seller conversation inbox (mobile port of the web
// `101lab-2/src/pages/chat/BuyerAllChatList.tsx`). Lists every seller the buyer
// has a conversation with (via `useConversations` → Node
// `GET /chat/buyer/:id/sellers`, kept live over the shared socket); tapping a row
// opens the direct thread (`/(lab)/deal/[id]`). The same thread screen is the
// target of the Match Detail "Contact seller" CTA — one messaging surface for
// both entry points. Tab bar SHOWS here (the thread hides it).
//
// WHY THE REWRITE (inbox redesign, UX_DESIGN_RULES):
//   • It was a ScrollView + `.map()`. A messaging inbox with no pull-to-refresh
//     feels broken, so it is now a FlatList with a RefreshControl on the
//     existing `refetch` (+ keyExtractor, ListHeaderComponent, ListEmptyComponent).
//   • The empty state used `flex: 1` inside a scroll content container, which
//     collapsed it directly under the header instead of centring. `flexGrow: 1`
//     on `contentContainerStyle` + a growing ListEmptyComponent centres it for
//     real, on both a short and a tall screen.
//   • The subtitle restated the title. It now reports something TRUE and LIVE.
//     "True" is load-bearing: it may only say "All caught up" when the unread
//     source has actually answered (`unreadResolved`) — the first cut printed it
//     whenever the sum was 0, and the sum was structurally always 0, so the header
//     told a buyer they were caught up seconds after a seller replied. It also
//     reports a FAILED refresh, because react-query keeps the previous rows on
//     error: a buyer with five conversations who pulled to refresh with no network
//     saw the spinner return and nothing else, over stale data.
//   • Search only appears once the list is long enough to need it, and finally
//     has a clear button + a result count.
// Layout language (gutter 22, paddingTop 16, 40px gradient medallion + 22px
// title, card rows with a 12px gap) is deliberately identical to
// (tabs)/matches.tsx and (tabs)/home.tsx — this is the same app, not a new one.
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, MessageSquareText, Search, X } from 'lucide-react-native';

import { EmptyState, Screen, Text } from '@/components/ui';
import { LabScreenBg, useTabBarHeight } from '@/features/lab/components';
import { brand, fonts, greenDarkest, greenLight, greenMedium, lab, radius, spacing } from '@/constants/theme';
import { usePop, usePressScale, usePulse } from '@/animations/recipes';
import { haptics } from '@/lib/haptics';
import { useConversations } from '@/features/lab/messages/useConversations';
import { useSocketConnected } from '@/features/lab/messages/socket';
import { ConversationRow } from '@/features/lab/messages/components/ConversationRow';
import type { ConversationRow as ConversationRowData } from '@/features/lab/messages/chatApi';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Prototype screen gutter (NOT on the 4px scale) — mirrors matches/home. */
const LAB_GUTTER = 22;
/** The header medallion's existing gradient pair — kept for screen identity. */
const MEDALLION = ['#2A7D59', greenDarkest] as const;

/**
 * Search appears only from this many conversations up.
 *
 * A card row is ~80px, so ~7 rows fill one phone screen: below that the buyer
 * can SEE every conversation without scrolling and a search field is pure
 * chrome (UX rules — "Can anything be removed?"). At 8+ rows scanning starts to
 * cost more than typing, so the field earns its place.
 */
const SEARCH_MIN_ROWS = 8;

/** 12px between cards — the same rhythm as HomeRecentWants' rows. */
function Separator() {
  return <View style={styles.separator} />;
}

export default function LabMessages() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const { conversations, totalUnread, unreadResolved, isLoading, isError, refetch } =
    useConversations();
  // Pull-to-refresh must reflect the USER's gesture only. Bound to react-query's
  // `isRefetching` it fired itself: the hook invalidates the inbox on every
  // inbound `chat_message`, so in a messaging app the screen dropped into the
  // "user is refreshing" state whenever any message arrived in any conversation
  // (and the tab-bar badge mounts the same hook, so it triggered it too).
  const [pulling, setPulling] = useState(false);
  const onPullToRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch]);
  // Real transport state — never invented. Only `connected` is claimed here; we
  // do NOT dress it up as seller presence, which the backend doesn't report.
  const connected = useSocketConnected();

  // Hooks resolved once at the top: they must not be called inside conditional
  // JSX branches further down (Rules of Hooks).
  const headerEnter = usePop();
  const syncPulse = usePulse();
  const cta = usePressScale();

  const showSearch = conversations.length >= SEARCH_MIN_ROWS;
  // If the list shrinks below the threshold while a query is active the field
  // unmounts — so the term must stop filtering too, or the buyer is left
  // staring at a filtered list with no visible way to unfilter it.
  const term = showSearch ? q.trim() : '';
  const searching = term.length > 0;

  const filtered = useMemo(() => {
    if (!term) return conversations;
    const needle = term.toLowerCase();
    return conversations.filter((c) => {
      const name = (c.display_name || c.user_email || '').toString().toLowerCase();
      const listing = (c.batch_title || c.product_name || '').toString().toLowerCase();
      return name.includes(needle) || listing.includes(needle);
    });
  }, [conversations, term]);

  const openThread = useCallback(
    (c: ConversationRowData) => {
      const name = (c.display_name || c.user_email || t('mobile.labMessages.sellerFallback')).toString();
      const listingTitle = (c.batch_title || c.product_name || '').toString();
      router.push({
        pathname: '/(lab)/deal/[id]',
        params: { id: String(c.batch_id), sellerId: String(c.ID), name, listingTitle },
      });
    },
    [router, t],
  );

  const goToMatches = () => {
    haptics.tap();
    router.push('/(lab)/(tabs)/matches');
  };

  const clearSearch = () => {
    haptics.tap(); // feedback on every action
    setQ('');
  };

  const renderItem = useCallback(
    ({ item, index }: { item: ConversationRowData; index: number }) => (
      <ConversationRow data={item} index={index} onPress={openThread} />
    ),
    [openThread],
  );

  // The subtitle EARNS its place: it is the one live status line on the screen.
  // Priority is what the buyer needs to know FIRST, and every branch has to be
  // something we can actually substantiate:
  //   1. socket down          → the inbox may be stale
  //   2. a refresh failed     → these rows are stale AND react-query kept them,
  //                             so without this the failure is invisible
  //   3. unread work          → the number, from the real unread source
  //   4. caught up            → ONLY when the unread source answered
  //   5. otherwise            → the plain screen description
  const reconnecting = !connected && !isLoading;
  const staleRows = isError && conversations.length > 0;
  const subtitle = reconnecting
    ? t('mobile.labMessages.reconnecting', { defaultValue: 'Reconnecting…' })
    : staleRows
      ? t('mobile.labMessages.refreshFailed', {
          defaultValue: "Couldn't refresh — pull down to try again",
        })
      : totalUnread > 0
        ? totalUnread === 1
          ? t('mobile.labMessages.unreadOne', {
              count: totalUnread,
              defaultValue: '{{count}} unread message',
            })
          : t('mobile.labMessages.unreadOther', {
              count: totalUnread,
              defaultValue: '{{count}} unread messages',
            })
        : unreadResolved && conversations.length > 0
          ? t('mobile.labMessages.allCaughtUp', { defaultValue: 'All caught up' })
          : t('mobile.labMessages.subtitle');
  // Emphasis belongs to the unread COUNT only — "Reconnecting…" set in green
  // semibold would read as a count and stop being the quiet note it must be.
  const emphasiseSubtitle = !reconnecting && !staleRows && totalUnread > 0;

  const resultCount =
    filtered.length === 1
      ? t('mobile.labMessages.resultCountOne', {
          count: filtered.length,
          defaultValue: '{{count}} result',
        })
      : t('mobile.labMessages.resultCountOther', {
          count: filtered.length,
          defaultValue: '{{count}} results',
        });

  const clearLabel = t('mobile.labMessages.clearSearch', { defaultValue: 'Clear search' });

  // ListHeaderComponent is passed as an ELEMENT, not a function component: an
  // inline `() => <View/>` is a NEW component type on every keystroke, which
  // remounts the TextInput and drops the keyboard mid-word.
  const listHeader = (
    <View>
      {/* Header — gradient medallion + title + ONE live status line. No second
          CTA competes with the list itself (UX rules: one focal point). */}
      <Animated.View entering={headerEnter} style={styles.header}>
        <LinearGradient colors={MEDALLION} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
          <MessageSquareText size={18} color={greenLight} strokeWidth={2} />
        </LinearGradient>
        <View style={styles.headerText}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('mobile.labMessages.title')}
          </Text>
          <View style={styles.statusRow}>
            {reconnecting ? <Animated.View style={[styles.syncDot, syncPulse]} /> : null}
            <Text numberOfLines={1} style={[styles.subtitle, emphasiseSubtitle && styles.subtitleStrong]}>
              {subtitle}
            </Text>
          </View>
        </View>
      </Animated.View>

      {showSearch ? (
        <>
          <View style={styles.searchBar}>
            <Search size={16} color={lab.inkMeta} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder={t('mobile.labMessages.searchPlaceholder')}
              placeholderTextColor={lab.inkFaint}
              accessibilityLabel={t('mobile.labMessages.searchPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              // Our own clear button instead of iOS's, so both platforms get the
              // same 44px target in the same place.
              clearButtonMode="never"
              testID="messages-search-input"
            />
            {q.length > 0 ? (
              <Pressable
                onPress={clearSearch}
                hitSlop={12}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel={clearLabel}
                testID="messages-search-clear"
              >
                <X size={13} color={lab.inkSub} strokeWidth={2.6} />
              </Pressable>
            ) : null}
          </View>
          {/* Result count only when it says something: a "0 results" line here
              would just repeat the empty state below it. */}
          {searching && filtered.length > 0 ? (
            <Text style={styles.resultCount} testID="messages-result-count">
              {resultCount}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

  // One element covering every zero-row case, in the order the buyer meets them.
  // It grows (`emptyFill`) inside a `flexGrow: 1` content container, so it
  // centres in the space left under the header instead of collapsing.
  const listEmpty = (
    <View style={styles.emptyFill}>
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={brand.primary} />
          <Text style={styles.centeredText}>{t('mobile.labMessages.loading')}</Text>
        </View>
      ) : isError ? (
        <EmptyState
          title={t('mobile.labMessages.errorTitle')}
          description={t('mobile.labMessages.errorBody')}
          actionLabel={t('mobile.labMessages.retry')}
          onAction={refetch}
        />
      ) : searching ? (
        // A search miss is an error state too — it gets a way out, not a dead end.
        <View style={styles.centered}>
          <Text style={styles.centeredText}>{t('mobile.labMessages.noMatch', { query: term })}</Text>
          <Pressable
            onPress={clearSearch}
            style={styles.ghostBtn}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            testID="messages-empty-clear"
          >
            <X size={13} color={greenDarkest} strokeWidth={2.6} />
            <Text style={styles.ghostBtnText}>{clearLabel}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.empty} testID="messages-empty">
          <View style={styles.emptyMedallion}>
            <MessageSquareText size={38} color={greenMedium} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>{t('mobile.labMessages.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('mobile.labMessages.emptyBody')}</Text>
          <AnimatedPressable
            onPress={goToMatches}
            onPressIn={cta.onPressIn}
            onPressOut={cta.onPressOut}
            style={[styles.emptyCta, cta.style]}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.labMessages.seeMatches')}
          >
            <Text style={styles.emptyCtaText}>{t('mobile.labMessages.seeMatches')}</Text>
            <ChevronRight size={15} color="#fff" strokeWidth={2.4} />
          </AnimatedPressable>
        </View>
      )}
    </View>
  );

  return (
    <LabScreenBg>
      <Screen scroll={false} padded={false} edges={['top']} keyboardAware={false} style={styles.screen}>
        <FlatList
          data={filtered}
          // `ID` is normally the seller id, but an orphaned row (deleted seller)
          // arrives without one — `undefined-<batch>` keys collide across rows.
          // `useConversations` now drops those rows; the index fallback is the
          // belt to that braces, so a bad row can never break list identity.
          keyExtractor={(c, i) => (c.ID != null ? `${c.ID}-${c.batch_id}` : `row-${i}`)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ItemSeparatorComponent={Separator}
          style={styles.list}
          contentContainerStyle={[
            styles.content,
            // Clear the floating tab bar by its LIVE height (never a magic 96).
            { paddingBottom: tabBarHeight + spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={onPullToRefresh}
              tintColor={greenDarkest}
              colors={[greenDarkest]}
            />
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          testID="messages-list"
        />
      </Screen>
    </LabScreenBg>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' },
  list: { flex: 1 },
  // flexGrow so the empty state can centre in the leftover space; the header's
  // own height is unaffected.
  content: { flexGrow: 1, paddingTop: 16, paddingHorizontal: LAB_GUTTER },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 26, color: lab.ink },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  // Neutral, not red and not green: a grey breathing dot reads "syncing", while
  // green would imply a live connection we don't have.
  syncDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: lab.inkMeta, flexShrink: 0 },
  subtitle: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: lab.inkSub },
  subtitleStrong: { fontFamily: fonts.semibold, color: greenDarkest },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    backgroundColor: brand.surface,
  },
  searchInput: { flex: 1, minHeight: 44, fontFamily: fonts.regular, fontSize: 14, color: lab.ink },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultCount: {
    fontFamily: fonts.label,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: lab.inkSub,
    marginTop: spacing.sm,
    marginLeft: 2,
  },

  separator: { height: spacing.md },

  emptyFill: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing['3xl'] },
  centeredText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: lab.inkSub,
    textAlign: 'center',
    maxWidth: 280,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: lab.sellBorder,
    backgroundColor: brand.surface,
  },
  ghostBtnText: { fontFamily: fonts.bold, fontSize: 13, color: greenDarkest },

  empty: { alignItems: 'center', paddingHorizontal: spacing['2xl'] },
  emptyMedallion: {
    width: 90,
    height: 90,
    borderRadius: radius.full,
    backgroundColor: lab.pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontFamily: fonts.headingBold, fontSize: 18, lineHeight: 22, color: lab.ink, textAlign: 'center' },
  emptyBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: lab.inkSub,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 260,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    backgroundColor: greenDarkest,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  emptyCtaText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
});
