import { useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Screen } from '@/components/ui';
import { useListDrafts, useDeleteDraft } from '@/services/drafts/draftHooks';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import { safeBack } from '@/lib/safeBack';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';

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
  // Resume (getDraft → lab | pending-ai | form-blob branch + navigation) is now
  // shared with the Home "Your items" draft rows — see `useResumeDraft`.
  const { resume, resumingId } = useResumeDraft();

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
              onResume={() => resume(item.id)}
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
