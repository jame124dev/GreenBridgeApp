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
import { useScanDraft } from '@/stores/scanDraftStore';
import { getScanResumeRoute } from '@/lib/scanResume';
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
 * A `pending-ai` draft (background recognition, Task 11) doesn't carry a
 * `PersistedScan` blob — that mapping is finished in Task 11/12; here we
 * degrade gracefully instead of guessing at a shape.
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
        const kind = (detail.payload as { kind?: string } | undefined)?.kind;
        if (kind === 'pending-ai') {
          // Task 11/12 completes the pending-ai resume mapping — background
          // recognition drafts carry the raw AI result + ordered image refs,
          // not a `PersistedScan` blob, so there's nothing safe to hydrate
          // yet. No-op-with-note rather than risk applying a wrong shape.
          toast.info(
            t('mobile.drafts.pendingAiNotReady', {
              defaultValue: 'This draft is still processing — check back soon.',
            }),
          );
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
