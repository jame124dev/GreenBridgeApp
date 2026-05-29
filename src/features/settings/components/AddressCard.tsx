import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Save } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useUpdateUserSettings } from '@/features/auth/useUserProfile';
import { haptics } from '@/lib/haptics';
import { brand, colors } from '@/constants/theme';
import type { UserProfile } from '@/services/auth/userProfile';

import { addressSchema, type AddressValues } from '../schemas';

interface Props {
  profile: UserProfile;
}

export function AddressCard({ profile }: Props) {
  const { t } = useTranslation();
  const update = useUpdateUserSettings();

  const { control, handleSubmit, formState: { isSubmitting } } = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      street:     profile.personalInfo.address?.street     ?? '',
      city:       profile.personalInfo.address?.city       ?? '',
      district:   profile.personalInfo.address?.district   ?? '',
      postalCode: profile.personalInfo.address?.postalCode ?? '',
      country:    profile.personalInfo.address?.country    ?? '',
    },
  });

  const onSubmit = (values: AddressValues) => {
    haptics.impact();
    update.mutate(
      { address: values },
      {
        onSuccess: () => {
          haptics.success();
          toast.success(t('mobile.settings.savedToast'));
        },
        onError: (err) => {
          haptics.error();
          toast.error((err as Error).message ?? t('mobile.settings.saveFailedTitle'));
        },
      },
    );
  };

  return (
    <Card>
      <Card.Header
        icon={<MapPin color={brand.primary} size={18} />}
        iconBg={brand.primarySurface}
        title={t('mobile.settings.addressInformation')}
        description={t('mobile.settings.addressDesc')}
      />
      <Card.Body>
        <Controller
          control={control}
          name="street"
          render={({ field, fieldState }) => (
            <Field label={t('mobile.settings.street')} error={fieldState.error?.message}>
              <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                placeholder={t('mobile.settings.streetPlaceholder')} />
            </Field>
          )}
        />

        <View className="flex-row gap-xl">
          <Controller
            control={control}
            name="city"
            render={({ field, fieldState }) => (
              <Field label={t('mobile.settings.city')} error={fieldState.error?.message} flex>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.cityPlaceholder')} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="district"
            render={({ field, fieldState }) => (
              <Field label={t('mobile.settings.district')} error={fieldState.error?.message} flex>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.districtPlaceholder')} />
              </Field>
            )}
          />
        </View>

        <View className="flex-row gap-xl">
          <Controller
            control={control}
            name="postalCode"
            render={({ field, fieldState }) => (
              <Field label={t('mobile.settings.postalCode')} error={fieldState.error?.message} flex>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.postalCodePlaceholder')} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="country"
            render={({ field, fieldState }) => (
              <Field label={t('mobile.settings.country')} error={fieldState.error?.message} flex>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.countryPlaceholder')} />
              </Field>
            )}
          />
        </View>

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
