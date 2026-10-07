import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Screen, Text } from '@/components/ui';
import { useListDrafts, useDeleteDraft } from '@/services/drafts/draftHooks';
import type { DraftStatus } from '@/services/drafts/draftApi';
import { useResumeDraft } from '@/features/scanner/useResumeDraft';
import DraftCard from '@/features/scanner/components/drafts/DraftCard';
import { LabScreenBg } from '@/features/lab/components';
import { IS_CUSTOMER } from '@/lib/flags';
import { safeBack } from '@/lib/safeBack';
import { haptics } from '@/lib/haptics';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';

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

/**
 * A compact segmented control — copied from the file-local `Segmented` in
 * `src/features/lab/wants/components/ManageWantSheet.tsx` (same old-UI tokens),
 * with the item height raised to the 44pt touch minimum.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segTrack} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && styles.segItemActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DraftsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // In my inventory / Listed / Discarded — the backend filters on `?status=`
  // (`draftController.js:414`); the status is in the query key, so a switch is
  // a fresh first page.
  const [status, setStatus] = useState<DraftStatus>('active');
  const { data, isLoading, isError, refetch } = useListDrafts({ status });
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

  // Guarded client-side too: a wrong-status row here would offer resume and
  // delete on a draft that is already listed.
  const drafts = (data?.drafts ?? []).filter((d) => d.status === status);
  const statusOptions: { value: DraftStatus; label: string }[] = [
    { value: 'active', label: t('mobile.scanv2.inventory.filterActive') },
    { value: 'published', label: t('mobile.scanv2.inventory.filterPublished') },
    { value: 'discarded', label: t('mobile.scanv2.inventory.filterDiscarded') },
  ];
  const sectionTitle =
    status === 'active'
      ? t('mobile.drafts.allDrafts', { defaultValue: 'All drafts' })
      : (statusOptions.find((o) => o.value === status)?.label ?? '');
  const emptyText =
    status === 'published'
      ? t('mobile.scanv2.inventory.emptyPublishedBody')
      : status === 'discarded'
        ? t('mobile.scanv2.inventory.emptyDiscardedBody')
        : t('mobile.drafts.empty', { defaultValue: 'No saved drafts yet' });

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

      <View className="mt-xl">
        <Segmented options={statusOptions} value={status} onChange={setStatus} />
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
              {emptyText}
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
                // Listed and Discarded rows are read-only: resuming a listed
                // draft and submitting again would list it twice, and deleting
                // a discarded one is a no-op (it is already a soft delete).
                disabled={resumingId != null || status !== 'active'}
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

// Copied from `ManageWantSheet.tsx`'s seg* styles; `segItem` gains `minHeight: 44`.
const styles = StyleSheet.create({
  segTrack: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: lab.hairline,
    borderRadius: radius.md,
    padding: 4,
  },
  segItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  segItemActive: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.semibold, fontSize: 12.5, color: lab.inkChipSub },
  segTextActive: { color: greenDarkest, fontFamily: fonts.bold },
});
