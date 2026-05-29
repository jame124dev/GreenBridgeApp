import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { PickerSelect } from '@/components/ui/PickerSelect';
import { useUpdateUserSettings } from '@/features/auth/useUserProfile';
import { haptics } from '@/lib/haptics';
import { brand, colors } from '@/constants/theme';
import type { UserProfile } from '@/services/auth/userProfile';

import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '../constants';
import { languageRegionSchema, type LanguageRegionValues } from '../schemas';

interface Props {
  profile: UserProfile;
}

export function LanguageRegionCard({ profile }: Props) {
  const { t } = useTranslation();
  const update = useUpdateUserSettings();

  const { control, handleSubmit, setValue, formState: { isSubmitting } } = useForm<LanguageRegionValues>({
    resolver: zodResolver(languageRegionSchema),
    defaultValues: {
      language: profile.languageRegion.language || 'en',
      timezone: profile.languageRegion.timezone || 'Asia/Taipei',
      currency: profile.languageRegion.currency || 'USD',
    },
  });

  const onSubmit = (values: LanguageRegionValues) => {
    haptics.impact();
    update.mutate(values, {
      onSuccess: () => {
        haptics.success();
        toast.success(t('mobile.settings.savedToast'));
      },
      onError: (err) => {
        haptics.error();
        toast.error((err as Error).message ?? t('mobile.settings.saveFailedTitle'));
      },
    });
  };

  return (
    <Card>
      <Card.Header
        icon={<Globe color={brand.infoText} size={18} />}
        iconBg={brand.infoBg}
        title={t('mobile.settings.languageRegion')}
        description={t('mobile.settings.languageRegionDesc')}
      />
      <Card.Body>
        <Controller
          control={control}
          name="language"
          render={({ field: { value } }) => (
            <Field label={t('mobile.settings.language')}>
              <PickerSelect
                value={value}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => setValue('language', v)}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="timezone"
          render={({ field: { value } }) => (
            <Field label={t('mobile.settings.timezone')}>
              <PickerSelect
                value={value}
                options={TIMEZONE_OPTIONS}
                onChange={(v) => setValue('timezone', v)}
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="currency"
          render={({ field: { value } }) => (
            <Field label={t('mobile.settings.currency')}>
              <PickerSelect
                value={value}
                options={CURRENCY_OPTIONS}
                onChange={(v) => setValue('currency', v)}
              />
            </Field>
          )}
        />

        <Button
          label={update.isPending ? t('mobile.settings.saving') : t('mobile.settings.save')}
          onPress={handleSubmit(onSubmit)}
          loading={update.isPending || isSubmitting}
          leftIcon={<Save color={colors.neutral[0]} size={16} />}
          fullWidth
        />
      </Card.Body>
    </Card>
  );
}
