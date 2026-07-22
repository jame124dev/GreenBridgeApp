import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Screen } from '@/components/ui';
import { useListDrafts, useDeleteDraft } from '@/services/drafts/draftHooks';
import { getDraft, type FormBlobPayload } from '@/services/drafts/draftApi';
import { hydrateScanDraftFromPayload } from '@/services/drafts/draftPayload';
import { mapPendingAiDraft } from '@/services/drafts/pendingAiResume';
import { getSiteType } from '@/services/scanner/buildFormData';
import { shouldSkipDetectionChoice } from '@/features/scanner/smartDetectionRouting';
import { useScanDraft } from '@/stores/scanDraftStore';
import { getScanResumeRoute } from '@/lib/scanResume';
import { routes } from '@/lib/routes';
import { safeBack } from '@/lib/safeBack';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';
import { isLabDraft, labResumeRoute } from '@/features/lab/labResumeRoute';
import { useComposer } from '@/features/lab/stores/composerStore';
import { useThread } from '@/features/lab/stores/threadStore';

/**
 * Task 9 — the drafts list surface (`/scan/drafts`), reached from the
 * "Your drafts" entry point on Home (`app/(tabs)/index.tsx`) when
 * `draftsEnabled()` is on. Auto-registered by expo-router's file-based
 * routing (`app/scan/_layout.tsx` is a bare `<Stack>` with no explicit
 * `Stack.Screen` children — no registration needed here).
 *
 * Resume: `getDraft(id)` returns the full payload (list rows are metadata
 * only). For a `form-blob` draft (the common case — Task 8's "Save as
 * draft"), the payload hydrates straight into the scan store via
 * `hydrateScanDraftFromPayload` + `hydrateFromServer`, then
 * `getScanResumeRoute` picks the right screen off the now-live store state.
 * A `pending-ai` draft (background recognition) carries the raw AI `result`
 * + canonical GCS image URLs instead of a `PersistedScan` blob;
 * `mapPendingAiDraft` (Follow-up #1) maps it through the live-scan transform
 * and we take the same apply/route path as `processing-v2.tsx`.
 *
 * Task 13 (scope-changed): this list ALSO serves the (lab) customer-app AI
 * drafts saved from `app/(lab)/draft.tsx` (Task 12's "Save as draft"). Every
 * draft row — seller and lab alike — carries a top-level `mode:
 * 'single'|'multi'` (Task 2); the real sell/buy distinction only lives in the
 * FETCHED `payload.mode`, stamped by `buildLabDraftPayload`
 * (`src/services/drafts/draftPayload.ts`). `isLabDraft(detail)`
 * (`src/features/lab/labResumeRoute.ts`) inspects that payload — never the
 * summary's top-level `mode` — which is why it can only run here, after
 * `getDraft(id)`, not against the list's `DraftSummary` rows.
 */
export default function DraftsScreen() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch, isRefetching } = useListDrafts();
  const deleteDraft = useDeleteDraft();
  const [resumingId, setResumingId] = useState<string | null>(null);

  const onResume = useCallback(
    async (id: string) => {
      haptics.tap();
      setResumingId(id);
      try {
        const detail = await getDraft(id);

        if (isLabDraft(detail)) {
          // (lab) draft — branch to the lab draft screen instead of the
          // seller scan-form hydrate below. `payload.mode` (sell/buy, NOT the
          // draft's top-level 'single'/'multi' mode) drives the composer
          // mode; `payload.labDraft` is the raw frame `buildLabDraftPayload`
          // captured from `turn.draft` at save time (Task 12).
          const p = detail.payload as { mode?: 'sell' | 'buy'; labDraft?: unknown };
          const labMode: 'sell' | 'buy' = p.mode === 'buy' ? 'buy' : 'sell';
          useComposer.getState().setMode(labMode);
          // `reset()`, not `startTurn()`: `startTurn()` sets `turn.state` to
          // 'STREAMING', and nothing here ever opens a real stream to carry it
          // to a terminal frame — that state would be stuck forever, which
          // silently no-ops the NEXT chat send in `app/(lab)/chat.tsx`
          // (`send()` early-returns while `turn.status === 'streaming'`).
          // `reset()` gives a clean IDLE turn; the reducer's `data` case
          // (`turnReducer.ts` ~150-169) never touches `state`, so applying the
          // frame below leaves `turn.status === 'idle'` while still setting
          // `turn.draft` — exactly what `app/(lab)/draft.tsx`'s
          // `liveDraftFrame` (`turn.draft`) renders from.
          useThread.getState().reset();
          useThread.getState().applyFrame({
            type: 'data',
            data: { type: labMode === 'buy' ? 'wtb_draft' : 'listing_draft', data: p.labDraft },
          });
          router.push(labResumeRoute() as never);
          return;
        }

        const kind = (detail.payload as { kind?: string } | undefined)?.kind;
        if (kind === 'pending-ai') {
          // Background-recognition draft (Follow-up #1): the server persisted
          // the raw AI `result` + canonical GCS image URLs, not a form blob.
          // `mapPendingAiDraft` runs the SAME `mapSmartDetection` transform the
          // live v2 stream uses, then we take the IDENTICAL apply/route path as
          // `processing-v2.tsx`'s onSuccess so a resumed background draft lands
          // exactly where a fresh on-screen scan would. `null` means the
          // payload isn't resumable (still processing / no images) — degrade to
          // a note rather than guess.
          const resume = mapPendingAiDraft(detail.payload, getSiteType());
          if (!resume) {
            toast.info(
              t('mobile.drafts.pendingAiNotReady', {
                defaultValue: 'This draft is still processing — check back soon.',
              }),
            );
            return;
          }
          const store = useScanDraft.getState();
          if (shouldSkipDetectionChoice(resume.mapped, resume.sourcePhotos.length)) {
            // High-confidence single / clearly-multiple → straight to the
            // editable result, no detection-choice screen (parity with sync).
            const m = await store.applySmartDetection(resume.mapped, resume.sourcePhotos);
            router.push(m === 'single' ? routes.scanDetail : routes.scanGroupedReview);
          } else {
            // Ambiguous → the 2-step detection wizard, which reads its photos
            // off `current`. Establish that draft FIRST (start() clears any
            // stale pendingDetection), THEN stash the mapped detection.
            await store.start(resume.sourcePhotos);
            store.setPendingDetection(resume.mapped);
            router.push(routes.scanDetection);
          }
          return;
        }
        const blob = hydrateScanDraftFromPayload(detail.payload as FormBlobPayload);
        await useScanDraft.getState().hydrateFromServer(blob);
        const route = getScanResumeRoute(useScanDraft.getState());
        router.push(route);
      } catch {
        haptics.error();
        toast.error(
          t('mobile.drafts.resumeFailed', { defaultValue: 'Could not open this draft' }),
        );
      } finally {
        setResumingId(null);
      }
    },
    [t],
  );

  const onDelete = useCallback(
    (id: string, title: string) => {
      haptics.warning();
      Alert.alert(
        t('mobile.drafts.deleteConfirmTitle', { defaultValue: 'Delete draft?' }),
        t('mobile.drafts.deleteConfirmBody', {
          defaultValue: `"${title}" will be removed. This can't be undone.`,
          title,
        }),
        [
          { text: t('mobile.common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('mobile.drafts.delete', { defaultValue: 'Delete' }),
            style: 'destructive',
            onPress: () => {
              deleteDraft.mutate(id, {
                onError: () => {
                  haptics.error();
                  toast.error(
                    t('mobile.drafts.deleteFailed', { defaultValue: 'Could not delete draft' }),
                  );
                },
              });
            },
          },
        ],
      );
    },
    [deleteDraft, t],
  );

  const drafts = data?.drafts ?? [];

  return (
    <Screen padded={false} scroll={false} edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-md px-lg py-2.5 border-b border-brand-border-strong bg-brand-background">
        <Pressable
          onPress={() => safeBack()}
          hitSlop={10}
          className="p-xs"
          accessibilityRole="button"
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft color={brand.foreground} size={22} />
        </Pressable>
        <Text className="font-heading text-5xl text-brand-foreground">
          {t('mobile.drafts.yourDrafts', { defaultValue: 'Your drafts' })}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={brand.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-2xl gap-md">
          <Text className="text-brand-text-muted text-center">
            {t('mobile.drafts.loadError', { defaultValue: 'Could not load drafts' })}
          </Text>
          <Pressable onPress={() => refetch()} accessibilityRole="button">
            <Text className="text-brand-primary font-semibold">
              {t('mobile.common.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(d) => d.id}
          contentContainerClassName="p-lg gap-md"
          contentContainerStyle={{ flexGrow: 1 }}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center mt-4xl">
              <Text className="text-brand-text-muted text-center">
                {t('mobile.drafts.empty', { defaultValue: 'No saved drafts yet' })}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DraftCard
              draft={item}
              onResume={() => onResume(item.id)}
              onDelete={() => onDelete(item.id, item.title)}
            />
          )}
        />
      )}

      {resumingId ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <ActivityIndicator color={brand.primary} size="large" />
        </View>
      ) : null}
    </Screen>
  );
}
