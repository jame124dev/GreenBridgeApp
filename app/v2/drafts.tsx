/**
 * My drafts — the "See all" behind 6a Home's DRAFTS section.
 *
 * ⚠️ NOT IN THE CANVAS. `GreenBidz Mobile.dc.html` draws 6a–6f and 7a–7e; a
 * drafts list is not among them. So this invents nothing: it is Home's DRAFTS
 * section with the two-row preview cap removed, composed from the same
 * primitives (`Row` + `RowThumb` + `Chip`) and the same wording helpers
 * (`features/v2/listings/presentation.ts`). If a drawing arrives, replace the
 * body; the row treatment is the part that must not drift from Home.
 *
 *     [G] GREENBIDZ                                   EN   bell•
 *     Your drafts
 *     Anything you stopped part-way is saved here.
 *
 *     [img]  3 items from greenbidz.com                       2d
 *            AI draft · 3 items
 *     ───────────────────────────────────────────────────────────
 *     [img]  Laboratory Spectrophotometer                     3d
 *            AI draft
 *
 * WHY IT REPLACES `/scan/drafts`. That screen is the old UI — old `Screen`,
 * `LabScreenBg`, old theme constants. Reaching it from a v2 Home swapped the
 * chrome mid-flow, which is the complaint already recorded against the promo
 * banner in `SellingPane`: *"it goes into the previous version while using it"*.
 *
 * DATA — read real, write later (skill § Data). `useListDrafts` is the same
 * query Home uses, on the same key, so arriving here costs no extra round-trip.
 *
 * ⚠️ DELETE IS DEFERRED, DELIBERATELY. The old screen has swipe-to-delete
 * (`useDeleteDraft`). v2 defers writes, and a destructive write is the last one
 * to port, not the first — it needs a confirm surface and an undo story that
 * are not drawn. `TODO(v2-writes)`. Until then this screen is strictly read +
 * resume, and the old screen remains reachable for deletion.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ImageIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BrandBar,
  Chip,
  EmptyState,
  Hairline,
  Row,
  RowThumb,
  Screen,
  SectionNote,
  Text,
} from '@/features/v2/ui';
import { GUTTER, control, icon, space, useV2Colors } from '@/theme/v2';
import { requireAuth, useIsGuest } from '@/features/auth/requireAuth';
import { useListDrafts } from '@/services/drafts/draftHooks';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { openMultiItemDraft } from '@/features/v2/scan/openMultiItemDraft';
import { v2ResumeRoute } from '@/features/v2/scan/v2ResumeRoute';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import {
  compactAgo,
  draftSubtitle,
  draftTitle,
  photoUri,
} from '@/features/v2/listings/presentation';
import type { DraftSummary } from '@/services/drafts/draftApi';
import { startV2Scan } from '@/features/v2/scan/startV2Scan';
import { routes } from '@/lib/routes';
import { haptics } from '@/lib/haptics';

export default function V2Drafts() {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const isGuest = useIsGuest();
  const { unreadCount } = useLabNotifications();
  const [refreshing, setRefreshing] = useState(false);

  const drafts = useListDrafts({ enabled: !isGuest, retry: 0 });
  // Same handler Home passes — a draft must open in the same place from both.
  const { resume, resumingId } = useResumeDraft(v2ResumeRoute, openMultiItemDraft);

  const items = (drafts.data?.drafts ?? []).filter((d) => d.status === 'active');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await drafts.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [drafts]);

  const onDraft = (d: DraftSummary) => {
    // One resume at a time: `resume` is a GET followed by a push, so a second
    // tap while the first is in flight navigates twice. See
    // Docs/UIUXRuleSet/responsiveness.md R2 — past ~250ms of silence the user
    // taps again, and that second tap is a real press, not a double-tap.
    if (resumingId) return;
    requireAuth('draft', () => void resume(d.id));
  };

  const header = (
    <BrandBar
      unread={unreadCount}
      onNotifications={() => {
        haptics.tap();
        requireAuth('notifications', () => router.push(routes.labNotifications));
      }}
    />
  );

  const title = (
    <View style={styles.titleRow}>
      <Text variant="display">Your drafts</Text>
      <Text variant="body" color="inkMuted" style={styles.titleSub}>
        Anything you stopped part-way is saved here.
      </Text>
    </View>
  );

  const body = () => {
    if (drafts.isLoading) {
      return <SectionNote>Looking for scans you have not finished…</SectionNote>;
    }
    if (drafts.isError) {
      return (
        <SectionNote>Your drafts did not load. Pull down to try again — nothing has been lost.</SectionNote>
      );
    }
    if (items.length === 0) {
      // An empty screen carries the action that would FILL it, never just a way
      // out (skill § Part 2).
      return (
        <EmptyState
          title="Nothing unfinished"
          body="A scan you stop part-way is saved here, so you can pick it up on another day."
          actionLabel="Scan an item"
          onAction={() => {
            haptics.impact();
            startV2Scan();
          }}
        />
      );
    }
    return null;
  };

  const note = body();

  return (
    <Screen header={header} headerFlush scroll={false} testID="v2-drafts">
      <FlatList
        data={note ? [] : items}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={
          <>
            {title}
            {note}
          </>
        }
        // The list owns its own bottom reserve — never a hardcoded number.
        contentContainerStyle={{ paddingBottom: control.tabBar + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />
        }
        ItemSeparatorComponent={Hairline}
        renderItem={({ item }) => {
          const ago = compactAgo(item.updated_at);
          const t = draftTitle(item);
          const sub = draftSubtitle(item);
          return (
            <Row
              title={t}
              subtitle={sub}
              leading={
                <RowThumb uri={photoUri(item.thumbnail_object)}>
                  <ImageIcon size={icon.md} color={c.inkDisabled} strokeWidth={1.6} />
                </RowThumb>
              }
              trailing={
                resumingId === item.id ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : ago ? (
                  <Chip label={ago} tone="accent" />
                ) : null
              }
              // The age chip is inside the row, so it is never announced on its
              // own — it has to be in the label.
              accessibilityLabel={ago ? `${t}. ${sub}. ${ago}` : undefined}
              onPress={() => onDraft(item)}
              testID={`v2-drafts-${item.id}`}
            />
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: GUTTER, paddingTop: space['5xl'], paddingBottom: space['6xl'] },
  titleSub: { marginTop: space.lg, maxWidth: 280 },
});
