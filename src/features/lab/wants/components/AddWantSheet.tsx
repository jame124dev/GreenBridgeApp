// AddWantSheet — "New want" surface for the My Wants dashboard (mobile port of
// the web `AddWantModal`). Creates a WTB want via `useWantMutations.createWant`
// (POST /wtb → the want + its instant matches); on success the list invalidates
// and the new want appears. NOTE: the web also fires an admin "Product Requests"
// bridge (Node) after create — the mobile lab app has no such client, so that
// non-blocking mirror is intentionally omitted here (a documented v1 deferral);
// the WTB want itself is fully created and matched.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Sheet, Text } from '@/components/ui';
import { fonts, greenDarkest, lab, radius, spacing } from '@/constants/theme';
import { useWantMutations } from '@/features/lab/hooks/useWantMutations';

export function AddWantSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { createWant, isCreating } = useWantMutations();
  const [looking, setLooking] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (visible) {
      setLooking('');
      setCategory('');
    }
  }, [visible]);

  const onSubmit = async () => {
    const title = looking.trim() || category.trim();
    if (!title) {
      toast.error(t('mobile.labWants.needTitle'));
      return;
    }
    try {
      const { matches } = await createWant({ title, category_name: category.trim() || undefined });
      const n = Array.isArray(matches) ? matches.length : 0;
      toast.success(
        n > 0
          ? t(n === 1 ? 'mobile.labWants.savedFoundOne' : 'mobile.labWants.savedFoundOther', { count: n })
          : t('mobile.labWants.savedNoMatch'),
      );
      onClose();
    } catch {
      toast.error(t('mobile.labWants.saveError'));
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.labWants.addWant')}
      subtitle={t('mobile.labWants.addSubtitle')}
      maxHeight={360}
    >
      <View style={styles.field}>
        <Text style={styles.label}>{t('mobile.labWants.lookingLabel')}</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={looking}
          onChangeText={setLooking}
          placeholder={t('mobile.labWants.lookingPlaceholder')}
          placeholderTextColor={lab.inkFaint}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          {t('mobile.labWants.categoryLabel')} <Text style={styles.optional}>{t('mobile.labWants.optional')}</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder={t('mobile.labWants.categoryPlaceholderAdd')}
          placeholderTextColor={lab.inkFaint}
          maxLength={255}
        />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={isCreating}
        style={[styles.submitBtn, isCreating && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.labWants.saveWantA11y')}
      >
        <Text style={styles.submitText}>{isCreating ? t('mobile.labWants.saving') : t('mobile.labWants.saveWant')}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.md, gap: 5 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: lab.inkSub },
  optional: { fontFamily: fonts.regular, color: lab.inkFaint },
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
  multiline: { minHeight: 76 },
  submitBtn: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: greenDarkest,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.55 },
  submitText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
});
