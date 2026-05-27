import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SelectButton } from '@/components/ui/SelectButton';
import { Sheet } from '@/components/ui/Sheet';
import { useUpdateUserSettings } from '@/features/auth/useUserProfile';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';
import type { UserProfile } from '@/services/auth/userProfile';

import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '../constants';
import { languageRegionSchema, type LanguageRegionValues } from '../schemas';

type SheetKey = 'language' | 'timezone' | 'currency' | null;

interface Props {
  profile: UserProfile;
}

export function LanguageRegionCard({ profile }: Props) {
  const { t } = useTranslation();
  const update = useUpdateUserSettings();
  const [activeSheet, setActiveSheet] = useState<SheetKey>(null);

  const { control, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<LanguageRegionValues>({
    resolver: zodResolver(languageRegionSchema),
    defaultValues: {
      language: profile.languageRegion.language || 'en',
      timezone: profile.languageRegion.timezone || 'Asia/Taipei',
      currency: profile.languageRegion.currency || 'USD',
    },
  });

  const language = watch('language');
  const timezone = watch('timezone');
  const currency = watch('currency');

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
    <>
      <Card>
        <Card.Header
          icon={<Globe color={colors.infoText} size={18} />}
          iconBg={colors.infoBg}
          title={t('mobile.settings.languageRegion')}
          description={t('mobile.settings.languageRegionDesc')}
        />
        <Card.Body>
          <Controller
            control={control}
            name="language"
            render={() => (
              <Field label={t('mobile.settings.language')}>
                <SelectButton
                  value={LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language}
                  onPress={() => setActiveSheet('language')}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="timezone"
            render={() => (
              <Field label={t('mobile.settings.timezone')}>
                <SelectButton
                  value={TIMEZONE_OPTIONS.find((o) => o.value === timezone)?.label ?? timezone}
                  onPress={() => setActiveSheet('timezone')}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="currency"
            render={() => (
              <Field label={t('mobile.settings.currency')}>
                <SelectButton
                  value={CURRENCY_OPTIONS.find((o) => o.value === currency)?.label ?? currency}
                  onPress={() => setActiveSheet('currency')}
                />
              </Field>
            )}
          />

          <Button
            label={update.isPending ? t('mobile.settings.saving') : t('mobile.settings.save')}
            onPress={handleSubmit(onSubmit)}
            loading={update.isPending || isSubmitting}
            leftIcon={<Save color={colors.white} size={16} />}
            fullWidth
          />
        </Card.Body>
      </Card>

      <Sheet visible={activeSheet === 'language'} onClose={() => setActiveSheet(null)} title={t('mobile.settings.language')}>
        {LANGUAGE_OPTIONS.map((opt) => (
          <Sheet.Option key={opt.value} label={opt.label} active={opt.value === language}
            onPress={() => { setValue('language', opt.value); setActiveSheet(null); }} />
        ))}
      </Sheet>

      <Sheet visible={activeSheet === 'timezone'} onClose={() => setActiveSheet(null)} title={t('mobile.settings.timezone')}>
        {TIMEZONE_OPTIONS.map((opt) => (
          <Sheet.Option key={opt.value} label={opt.label} active={opt.value === timezone}
            onPress={() => { setValue('timezone', opt.value); setActiveSheet(null); }} />
        ))}
      </Sheet>

      <Sheet visible={activeSheet === 'currency'} onClose={() => setActiveSheet(null)} title={t('mobile.settings.currency')}>
        {CURRENCY_OPTIONS.map((opt) => (
          <Sheet.Option key={opt.value} label={opt.label} active={opt.value === currency}
            onPress={() => { setValue('currency', opt.value); setActiveSheet(null); }} />
        ))}
      </Sheet>
    </>
  );
}
