/**
 * My drafts — the "See all" behind 6a Home's DRAFTS section.
 *
 * Displays active drafts in the modern card design adapted from
 * `seller-bid-card.tsx` (left thumbnail with multi-item badge, flow label,
 * age chip, two-line title, and stats caption with tactile press feedback).
 *
 * DATA — `useListDrafts` is the same query Home uses, on the same key.
 *
 * RESUME — Tapping a card triggers `useResumeDraft` to jump into the editor.
 */
import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { Search } from 'lucide-react-native';

import {
  BrandBar,
  ConfirmSheet,
  EmptyState,
  Field,
  Screen,
  SectionNote,
  Tabs,
  Text,
  useTabBarReserve,
  type ConfirmSheetRef,
} from '@/features/v2/ui';
import { GUTTER, icon, space, useV2Colors } from '@/theme/v2';

/**
 * Rows before the search field appears. Below this the whole list is on screen
 * already, so a search box would be a control that saves nobody anything —
 * progressive disclosure, per `UX_DESIGN_RULES.md`. Once a query is typed the
 * field stays regardless, or clearing a search would remove the box mid-use.
 */
const SEARCH_FROM = 6;
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useDeleteDraft, useListDrafts } from '@/services/drafts/draftHooks';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { openMultiItemDraft } from '@/features/v2/scan/openMultiItemDraft';
import { v2ResumeRoute } from '@/features/v2/scan/v2ResumeRoute';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import type { DraftStatus, DraftSummary } from '@/services/drafts/draftApi';
import { startV2Scan, startV2TypeDetails } from '@/features/v2/scan/startV2Scan';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';
import { DraftCard } from '@/features/v2/drafts/draft-card';
import { toast } from 'sonner-native';
import { draftTitle } from '@/features/v2/listings/presentation';

export default function V2Drafts() {
  const c = useV2Colors();
  const { t } = useTranslation();
  const reserve = useTabBarReserve();
  const isGuest = useIsGuest();
  const { unreadCount } = useLabNotifications();
  const [refreshing, setRefreshing] = useState(false);
  /*
    In my inventory / Listed / Discarded — work order Task 1, the mobile half.
    The backend already filters on `?status=` (`draftController.js:414`); the
    status is in the query key, so switching is a fresh first page.
  */
  const [status, setStatus] = useState<DraftStatus>('active');

  /*
   * ALL THREE STATUSES ARE QUERIED, not just the selected one, so the rail can
   * say whether there is anything under Listed or Discarded before the seller
   * taps it. `draftKeys.list(status)` puts the status in the key, so these are
   * three separate cached lists and the selected one is NOT fetched twice —
   * `byStatus[status]` is the very same query object.
   *
   * It also makes switching tabs instant after the first visit, which the
   * previous single-query version could not do.
   */
  const activeQ = useListDrafts({ enabled: !isGuest, retry: 0, status: 'active' });
  const publishedQ = useListDrafts({ enabled: !isGuest, retry: 0, status: 'published' });
  const discardedQ = useListDrafts({ enabled: !isGuest, retry: 0, status: 'discarded' });
  const byStatus = { active: activeQ, published: publishedQ, discarded: discardedQ } as const;
  const drafts = byStatus[status];

  const { resume, resumingId } = useResumeDraft(v2ResumeRoute, openMultiItemDraft);

  // Kept as a guard rather than trusted to the server: a row of the wrong status
  // here would offer "Tap to resume" on a listed draft.
  const allItems = (drafts.data?.drafts ?? []).filter((d) => d.status === status);

  /*
   * ⚠️ A COUNT IS ONLY SHOWN WHEN IT IS THE WHOLE COUNT.
   *
   * The server pages at 24 (`draftController.js:412`, `limit` defaults to 24)
   * and hands back `next_cursor` when more remain. `useListDrafts` fetches ONE
   * page, so for a seller with 30 drafts `drafts.length` is 24 — a number that
   * looks authoritative and is wrong. While a next page exists the tab shows no
   * number at all, which is honest; the web list solved the same problem the
   * other way, by following every cursor.
   */
  const tabCount = (q: typeof activeQ, s: DraftStatus): number | undefined => {
    if (!q.data || q.data.next_cursor) return undefined;
    return q.data.drafts.filter((d) => d.status === s).length;
  };

  const statusTabs = [
    {
      value: 'active' as const,
      label: t('mobile.scanv2.inventory.filterActive'),
      count: tabCount(activeQ, 'active'),
    },
    {
      value: 'published' as const,
      label: t('mobile.scanv2.inventory.filterPublished'),
      count: tabCount(publishedQ, 'published'),
    },
    {
      value: 'discarded' as const,
      label: t('mobile.scanv2.inventory.filterDiscarded'),
      count: tabCount(discardedQ, 'discarded'),
    },
  ];
  const statusLabel = statusTabs.find((s) => s.value === status)?.label;

  /*
   * SEARCH — client-side over the page already in memory, which is why it only
   * appears once the list is long enough to be worth scanning. It filters what
   * is loaded, not the server's whole set; with a next page present the list is
   * already partial, and the empty state says so rather than implying "no such
   * item exists".
   */
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const items = q
    ? allItems.filter((d) => draftTitle(d).toLowerCase().includes(q))
    : allItems;
  const showSearch = allItems.length >= SEARCH_FROM || q.length > 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await drafts.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [drafts]);

  const onDraft = (d: DraftSummary) => {
    if (resumingId) return;
    requireAuth('draft', () => void resume(d.id));
  };

  /*
   * DISCARD — `DELETE /drafts/:id` is a SOFT delete: the controller sets
   * `status='discarded'` and the row stays (`draftController.js`, "Soft
   * delete (status='discarded')"). That is what lets the Discarded tab exist
   * at all, and why the copy says "Kept, not deleted."
   *
   * ⚠️ IT IS ONE-WAY FROM HERE. `PUT /drafts/:id` explicitly refuses to change
   * `status` ("never allow changing share_token, id, identity, status"), so
   * there is no restore endpoint to put a row back. The confirm step is doing
   * real work — do not reduce it to an undo toast until that route exists.
   *
   * The mutation invalidates `draftKeys.all`, a prefix of every status key, so
   * the row leaves `active` and appears under `discarded` without a refetch
   * written here.
   */
  const discard = useDeleteDraft();
  const sheetRef = useRef<ConfirmSheetRef>(null);
  const [pendingDiscard, setPendingDiscard] = useState<DraftSummary | null>(null);

  const requestDiscard = useCallback((d: DraftSummary) => {
    haptics.warning();
    setPendingDiscard(d);
    // State first, THEN present: `ConfirmSheet` reads its props once per open,
    // so the update has to land before it mounts. Same note as
    // `seller-offers-screen.tsx`.
    requestAnimationFrame(() => sheetRef.current?.present());
  }, []);

  const confirmDiscard = useCallback(() => {
    const d = pendingDiscard;
    if (!d) return;
    setPendingDiscard(null);
    discard.mutate(d.id, {
      onError: () => {
        haptics.error();
        toast.error(t('mobile.scanv2.inventory.discardFailed'));
      },
    });
  }, [discard, pendingDiscard, t]);

  const header = (
    <BrandBar
      unread={unreadCount}
      onNotifications={() => {
        haptics.tap();
        requireAuth('notifications', () => router.push(routes.labNotifications));
      }}
    />
  );

  const note = (() => {
    if (drafts.isLoading) {
      return <SectionNote>{t('mobile.scanv2.drafts.loading')}</SectionNote>;
    }
    /*
     * A SEARCH THAT FINDS NOTHING IS NOT AN EMPTY INVENTORY. It must not offer
     * "Scan an item" — the seller has items, just none matching — and when a
     * next page exists it has to admit it only searched what is loaded.
     */
    if (q && items.length === 0 && !drafts.isError) {
      return (
        <EmptyState
          title={t('mobile.scanv2.inventory.noMatchTitle')}
          body={
            drafts.data?.next_cursor
              ? t('mobile.scanv2.inventory.noMatchPartial')
              : t('mobile.scanv2.inventory.noMatchBody', { query: query.trim() })
          }
          actionLabel={t('mobile.scanv2.inventory.clearSearch')}
          onAction={() => {
            haptics.tap();
            setQuery('');
          }}
        />
      );
    }
    if (drafts.isError) {
      const status = (drafts.error as { response?: { status?: number } } | undefined)?.response
        ?.status;

      if (status === 401 || status === 403) {
        return (
          <EmptyState
            title={t('mobile.scanv2.common.sessionEndedTitle')}
            body={t('mobile.scanv2.drafts.sessionEndedBody')}
            actionLabel={t('mobile.scanv2.common.signIn')}
            onAction={() => {
              haptics.tap();
              requireAuth('draft', () => void drafts.refetch());
            }}
          />
        );
      }

      return (
        <SectionNote>{t('mobile.scanv2.drafts.loadError')}</SectionNote>
      );
    }
    if (items.length === 0 && status !== 'active') {
      // Nothing scans INTO these two, so the action leads back to where items
      // can be submitted or discarded from.
      return (
        <EmptyState
          title={
            status === 'published'
              ? t('mobile.scanv2.inventory.emptyPublishedTitle')
              : t('mobile.scanv2.inventory.emptyDiscardedTitle')
          }
          body={
            status === 'published'
              ? t('mobile.scanv2.inventory.emptyPublishedBody')
              : t('mobile.scanv2.inventory.emptyDiscardedBody')
          }
          actionLabel={t('mobile.scanv2.inventory.openInventory')}
          onAction={() => {
            haptics.tap();
            setStatus('active');
          }}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title={t('mobile.scanv2.drafts.emptyTitle')}
          body={t('mobile.scanv2.drafts.emptyBody')}
          actionLabel={t('mobile.scanv2.common.scanAnItem')}
          onAction={() => {
            haptics.impact();
            startV2Scan();
          }}
          secondaryLabel={t('mobile.scanv2.common.typeDetails')}
          onSecondary={() => {
            haptics.tap();
            startV2TypeDetails();
          }}
        />
      );
    }
    return null;
  })();

  const listHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.titleRow}>
        <Text variant="display">{t('mobile.scanv2.inventory.title')}</Text>
        <Text variant="body" color="inkMuted" style={styles.titleSub}>
          {t('mobile.scanv2.inventory.subtitle')}
        </Text>
      </View>
      {/* Hidden from a guest: there is nothing of theirs to filter. */}
      {isGuest ? null : (
        <Tabs
          items={statusTabs}
          value={status}
          onChange={(next) => {
            haptics.tap();
            // The query belongs to the list you were looking at. Carrying it
            // across would show an empty Discarded tab that is only empty
            // because of a word typed on another tab.
            setQuery('');
            setStatus(next);
          }}
          rule
          style={styles.tabs}
        />
      )}
      {!isGuest && showSearch ? (
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={t('mobile.scanv2.inventory.searchPlaceholder')}
          accessibilityLabel={t('mobile.scanv2.inventory.searchPlaceholder')}
          leading={<Search size={icon.md} color={c.inkSubtle} strokeWidth={2} />}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          // `search` so the keyboard offers a clear affordance, and so iOS
          // does not autocomplete equipment names into something else.
          inputMode="search"
          style={styles.search}
        />
      ) : null}
      {note ? (
        note
      ) : status === 'active' && !q ? (
        <Text variant="micro" color="inkSubtle" style={styles.count}>
          {items.length === 1 ? '1 active draft' : `${items.length} active drafts`}
        </Text>
      ) : q ? (
        <Text variant="micro" color="inkSubtle" style={styles.count}>
          {t('mobile.scanv2.inventory.searchCount', { count: items.length })}
        </Text>
      ) : (
        <View style={styles.count} />
      )}
    </View>
  );

  return (
    <Screen
      header={header}
      headerFlush
      scroll={false}
      contentStyle={styles.fill}
      testID="v2-drafts"
    >
      <FlashList
        data={note ? [] : items}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <DraftCard
            draft={item}
            isResuming={resumingId === item.id}
            // Only an inventory item resumes. A listed one re-opened and
            // submitted again would list the same equipment twice.
            onPress={status === 'active' ? () => onDraft(item) : undefined}
            statusLabel={statusLabel}
            // Active only. Discarding a discarded row is a no-op, and hiding a
            // LISTED one would leave its equipment live with no row for it.
            onDiscard={status === 'active' ? () => requestDiscard(item) : undefined}
            discardLabel={t('mobile.scanv2.inventory.discard')}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingBottom: reserve + space['8xl'],
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
        }
      />

      <ConfirmSheet
        ref={sheetRef}
        title={t('mobile.scanv2.inventory.discardConfirmTitle')}
        body={
          pendingDiscard
            ? t('mobile.scanv2.inventory.discardConfirmBody', {
                title: draftTitle(pendingDiscard),
              })
            : ''
        }
        confirmLabel={t('mobile.scanv2.inventory.discard')}
        onConfirm={confirmDiscard}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerBlock: {
    paddingTop: space['5xl'],
    paddingBottom: space.lg,
  },
  titleRow: {
    marginBottom: space.lg,
  },
  titleSub: {
    marginTop: space.sm,
    maxWidth: 300,
  },
  count: {
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  tabs: {
    marginBottom: space.sm,
  },
  search: {
    marginTop: space.sm,
  },
});
