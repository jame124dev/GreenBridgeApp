// ManageWantSheet — the per-want preferences surface (mobile port of the web
// MyWants `ManageWantPanel`). A bottom Sheet with: pause/resume, notification
// frequency, inline edit of title/category/keywords (re-runs matching), and a
// destructive delete gated behind a native confirm. All mutations go through
// `useWantMutations`, which invalidates the wants list + this want's matches so
// the dashboard refreshes on success — no manual parent callbacks needed.
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Sheet, Text } from '@/components/ui';
import { brand, fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { useWantMutations } from '@/features/lab/hooks/useWantMutations';
import type { WtbListItem } from '@/features/lab/data/wtbApi';
import {
  NOTIFY_FREQUENCIES,
  frequencyLabel,
  keywordsToText,
  textToKeywords,
  type NotifyFrequency,
} from '@/features/lab/wants/data/wantsView';

type StatusValue = 'active' | 'paused';

export function ManageWantSheet({
  want,
  visible,
  onClose,
}: {
  want: WtbListItem;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { updateWant, deleteWant, isUpdating, isDeleting } = useWantMutations();

  const rawStatus = (want.status ?? 'active').toLowerCase();
  const canToggle = rawStatus === 'active' || rawStatus === 'paused';

  // Local buffers, re-seeded each time the sheet opens for this want.
  const [status, setStatus] = useState<StatusValue>(rawStatus === 'paused' ? 'paused' : 'active');
  const [freq, setFreq] = useState<NotifyFrequency>((want.notify_frequency as NotifyFrequency) || 'instant');
  const [title, setTitle] = useState(want.title ?? '');
  const [category, setCategory] = useState(want.category_name ?? '');
  const [keywordsText, setKeywordsText] = useState(keywordsToText(want.keywords));

  useEffect(() => {
    if (!visible) return;
    setStatus(rawStatus === 'paused' ? 'paused' : 'active');
    setFreq((want.notify_frequency as NotifyFrequency) || 'instant');
    setTitle(want.title ?? '');
    setCategory(want.category_name ?? '');
    setKeywordsText(keywordsToText(want.keywords));
  }, [visible, rawStatus, want.notify_frequency, want.title, want.category_name, want.keywords]);

  const onToggleStatus = async (next: StatusValue) => {
    if (next === status || isUpdating) return;
    setStatus(next); // optimistic
    try {
      await updateWant(want.id, { status: next });
      toast.success(next === 'active' ? t('mobile.labWants.wantResumed') : t('mobile.labWants.wantPaused'));
    } catch {
      setStatus(next === 'active' ? 'paused' : 'active'); // revert
      toast.error(t('mobile.labWants.updateError'));
    }
  };

  const onFreqChange = async (next: NotifyFrequency) => {
    if (next === freq || isUpdating) return;
    const prev = freq;
    setFreq(next); // optimistic
    try {
      await updateWant(want.id, { notify_frequency: next });
      toast.success(t('mobile.labWants.notifUpdated'));
    } catch {
      setFreq(prev);
      toast.error(t('mobile.labWants.updateError'));
    }
  };

  const onSaveEdit = async () => {
    const patch: Parameters<typeof updateWant>[1] = {};
    const nextTitle = title.trim();
    if (nextTitle && nextTitle !== (want.title ?? '')) patch.title = nextTitle;
    const nextCategory = category.trim();
    if (nextCategory !== (want.category_name ?? '')) patch.category_name = nextCategory;
    const nextKeywords = textToKeywords(keywordsText);
    if (keywordsToText(want.keywords) !== nextKeywords.join(', ')) patch.keywords = nextKeywords;

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await updateWant(want.id, patch);
      toast.success(t('mobile.labWants.wantUpdated'));
      onClose();
    } catch {
      toast.error(t('mobile.labWants.updateError'));
    }
  };

  const onDelete = () => {
    Alert.alert(
      t('mobile.labWants.deleteConfirmTitle'),
      t('mobile.labWants.deleteConfirmBody'),
      [
        { text: t('mobile.labWants.cancel'), style: 'cancel' },
        {
          text: t('mobile.labWants.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWant(want.id);
              toast.success(t('mobile.labWants.wantDeleted'));
              onClose();
            } catch {
              toast.error(t('mobile.labWants.deleteError'));
            }
          },
        },
      ],
    );
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.labWants.prefsTitle')}
      subtitle={t('mobile.labWants.prefsSubtitle')}
      maxHeight={480}
    >
      {/* Pause / resume */}
      {canToggle ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>{t('mobile.labWants.statusHeading')}</Text>
          <Segmented
            options={[
              { value: 'active', label: t('mobile.labWants.statusActive') },
              { value: 'paused', label: t('mobile.labWants.statusPaused') },
            ]}
            value={status}
            onChange={(v) => onToggleStatus(v as StatusValue)}
          />
          <Text style={styles.hint}>
            {status === 'active' ? t('mobile.labWants.hintActive') : t('mobile.labWants.hintPaused')}
          </Text>
        </View>
      ) : null}

      {/* Notification frequency */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>{t('mobile.labWants.notifyFreqHeading')}</Text>
        <Segmented
          options={NOTIFY_FREQUENCIES.map((f) => ({ value: f, label: frequencyLabel(f, t) }))}
          value={freq}
          onChange={(v) => onFreqChange(v as NotifyFrequency)}
        />
      </View>

      {/* Refine */}
      <View style={styles.editBlock}>
        <Text style={styles.blockLabel}>{t('mobile.labWants.refineHeading')}</Text>
        <Labeled label={t('mobile.labWants.refineTitleLabel')}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={500}
            placeholder={t('mobile.labWants.refineTitlePlaceholder')}
            placeholderTextColor={lab.inkFaint}
          />
        </Labeled>
        <Labeled label={t('mobile.labWants.refineCategoryLabel')}>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            maxLength={255}
            placeholder={t('mobile.labWants.refineCategoryPlaceholder')}
            placeholderTextColor={lab.inkFaint}
          />
        </Labeled>
        <Labeled label={t('mobile.labWants.keywordsLabel')}>
          <TextInput
            style={styles.input}
            value={keywordsText}
            onChangeText={setKeywordsText}
            placeholder={t('mobile.labWants.keywordsPlaceholder')}
            placeholderTextColor={lab.inkFaint}
          />
        </Labeled>
        <Pressable
          onPress={onSaveEdit}
          disabled={isUpdating}
          style={[styles.saveBtn, isUpdating && styles.btnDisabled]}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{isUpdating ? t('mobile.labWants.saving') : t('mobile.labWants.saveChanges')}</Text>
        </Pressable>
      </View>

      {/* Delete */}
      <Pressable
        onPress={onDelete}
        disabled={isDeleting}
        style={styles.deleteBtn}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labWants.deleteWantA11y')}
      >
        <Trash2 size={15} color={brand.destructive} strokeWidth={2} />
        <Text style={styles.deleteText}>{isDeleting ? t('mobile.labWants.deleting') : t('mobile.labWants.deleteWant')}</Text>
      </Pressable>
    </Sheet>
  );
}

/** A compact segmented control (used for status + notify frequency). */
function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.segTrack}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, active && styles.segItemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.labeled}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  editBlock: {
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: lab.hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  blockLabel: { fontFamily: fonts.bold, fontSize: 13, color: lab.ink, marginBottom: spacing.sm },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: lab.inkSub, marginTop: 6 },
  segTrack: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: lab.hairline,
    borderRadius: radius.md,
    padding: 4,
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.sm },
  segItemActive: { backgroundColor: '#fff' },
  segText: { fontFamily: fonts.semibold, fontSize: 12.5, color: lab.inkChipSub },
  segTextActive: { color: greenDarkest, fontFamily: fonts.bold },
  labeled: { gap: 5 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: lab.inkSub },
  input: {
    minHeight: 44,
    borderWidth: 1.4,
    borderColor: lab.hairline,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: lab.ink,
    backgroundColor: '#fff',
  },
  saveBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  saveText: { fontFamily: fonts.bold, fontSize: 13.5, color: '#fff' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: brand.destructiveBg,
    backgroundColor: brand.destructiveBg,
  },
  deleteText: { fontFamily: fonts.bold, fontSize: 13, color: brand.destructive },
});
