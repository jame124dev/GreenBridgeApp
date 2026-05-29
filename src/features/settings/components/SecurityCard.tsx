import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useUpdateUserSettings } from '@/features/auth/useUserProfile';
import { haptics } from '@/lib/haptics';
import { brand, colors } from '@/constants/theme';

import { securitySchema, type SecurityValues } from '../schemas';

export function SecurityCard() {
  const { t } = useTranslation();
  const update = useUpdateUserSettings();

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<SecurityValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = (values: SecurityValues) => {
    haptics.impact();
    update.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          haptics.success();
          reset();
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
        icon={<Shield color={brand.destructiveStrong} size={18} />}
        iconBg={brand.destructiveBg}
        title={t('mobile.settings.securitySettings')}
        description={t('mobile.settings.securityDesc')}
      />
      <Card.Body>
        <Controller
          control={control}
          name="currentPassword"
          render={({ field, fieldState }) => (
            <Field label={t('mobile.settings.currentPassword')} error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="••••••••"
                secureTextEntry
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="newPassword"
          render={({ field, fieldState }) => (
            <Field label={t('mobile.settings.newPassword')} error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="••••••••"
                secureTextEntry
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <Field label={t('mobile.settings.confirmPassword')} error={fieldState.error?.message}>
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="••••••••"
                secureTextEntry
              />
            </Field>
          )}
        />

        <Button
          label={update.isPending ? t('mobile.settings.saving') : t('mobile.settings.updatePassword')}
          onPress={handleSubmit(onSubmit)}
          loading={update.isPending || isSubmitting}
          leftIcon={<Save color={colors.neutral[0]} size={16} />}
          fullWidth
        />
      </Card.Body>
    </Card>
  );
}
