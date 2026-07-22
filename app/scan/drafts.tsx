import { useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Screen, Text } from '@/components/ui';
import { useListDrafts, useDeleteDraft } from '@/services/drafts/draftHooks';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';
import { LabScreenBg } from '@/features/lab/components';
import { IS_CUSTOMER } from '@/lib/flags';
import { safeBack } from '@/lib/safeBack';
import { haptics } from '@/lib/haptics';
import { brand, greenDarkest, spacing } from '@/constants/theme';

/**
 * The drafts list surface (`/scan/drafts`), reached from the "Your drafts" /
 * "Your items → See all" entry points when `draftsEnabled()` is on.
 *
 * Design mirrors the seller listings "See all" (`app/(lab)/(tabs)/listings.tsx`
 * + `RecentSubmissionsList`) so the two "See all" pages read as one family:
 * the customer build gets the same `LabScreenBg`, header row, and uppercase
 * section header + count pill, and each `DraftCard` mirrors a listing row
 * (amber-accented for the draft state — see DraftCard).
 *
 * Resume routing (getDraft → lab | pending-ai | form-blob branch + nav) is the
 * shared `useResumeDraft`, identical to the Home "Your items" draft rows.
 */
function SectionHeader({ title, countLabel }: { title: string; countLabel?: string }) {
  return (
    <View className="flex-row items-center justify-between mb-lg">
      <Text variant="caption" tone="secondary" className="font-bold uppercase tracking-wider">
        {title}
      </Text>
      {countLabel ? (
        <View className="bg-success/10 rounded-full px-lg py-[3px]">
          <Text variant="caption" className="font-bold text-success text-[11px] uppercase tracking-widest">
            {countLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DraftsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useListDrafts();
  const deleteDraft = useDeleteDraft();
  // Shared with the Home "Your items" draft rows — one resume path.
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
                  toast.error(t('mobile.drafts.deleteFailed', { defaultValue: 'Could not delete draft' }));
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
  const sectionTitle = t('mobile.drafts.allDrafts', { defaultValue: 'All drafts' });

  const inner = (
    <Screen
      scroll
      padded={false}
      edges={['top']}
      style={{ backgroundColor: IS_CUSTOMER ? 'transparent' : brand.background }}
      contentContainerStyle={{
        paddingTop: spacing.sm,
        paddingHorizontal: 22,
        paddingBottom: insets.bottom + spacing.xl,
      }}
    >
      {/* Page header — matches the listings "See all" header row. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          hitSlop={10}
          onPress={() => safeBack()}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.common.back', { defaultValue: 'Back' })}
        >
          <ChevronLeft size={26} color={greenDarkest} />
        </Pressable>
        <Text variant="title" tone="primary" style={{ fontWeight: '700' }}>
          {t('mobile.drafts.yourDrafts', { defaultValue: 'Your drafts' })}
        </Text>
      </View>

      <View className="mt-3xl">
        {isLoading ? (
          <>
            <SectionHeader title={sectionTitle} />
            <View className="mt-xl">
              <ActivityIndicator color={greenDarkest} />
            </View>
          </>
        ) : isError ? (
          <>
            <SectionHeader title={sectionTitle} />
            <Pressable onPress={() => refetch()} accessibilityRole="button">
              <Text variant="body" tone="brand" className="font-semibold text-center mt-md">
                {t('mobile.drafts.loadError', { defaultValue: 'Could not load drafts' })}
              </Text>
            </Pressable>
          </>
        ) : drafts.length === 0 ? (
          <>
            <SectionHeader title={sectionTitle} />
            <Text variant="body" tone="tertiary" className="text-center mt-xl">
              {t('mobile.drafts.empty', { defaultValue: 'No saved drafts yet' })}
            </Text>
          </>
        ) : (
          <>
            <SectionHeader
              title={sectionTitle}
              countLabel={t('mobile.home.itemsCount', { count: drafts.length })}
            />
            {drafts.map((item) => (
              <DraftCard
                key={item.id}
                draft={item}
                onResume={() => resume(item.id)}
                onDelete={() => onDelete(item.id, item.title)}
                resuming={resumingId === item.id}
                disabled={resumingId != null}
              />
            ))}
          </>
        )}
      </View>
    </Screen>
  );

  // Customer (lab) build gets the lab background so this page matches the
  // listings "See all"; the seller build keeps its plain screen background.
  return IS_CUSTOMER ? <LabScreenBg>{inner}</LabScreenBg> : inner;
}
