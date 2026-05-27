import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, User as UserIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { SelectButton } from '@/components/ui/SelectButton';
import { Sheet } from '@/components/ui/Sheet';
import { useUpdateUserSettings } from '@/features/auth/useUserProfile';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme';
import type { UserProfile } from '@/services/auth/userProfile';

import { INDUSTRY_OPTIONS } from '../constants';
import { profileInfoSchema, type ProfileInfoValues } from '../schemas';
import { InterestChips } from './InterestChips';
import { InterestsSheet } from './InterestsSheet';

interface Props {
  profile: UserProfile;
}

export function ProfileInfoCard({ profile }: Props) {
  const { t } = useTranslation();
  const update = useUpdateUserSettings();
  const [industrySheetOpen, setIndustrySheetOpen] = useState(false);
  const [interestsSheetOpen, setInterestsSheetOpen] = useState(false);

  const raw = profile.personalInfo.industry || '';
  const defaultIndustry = raw.startsWith('Other: ') ? 'Other' : raw;
  const defaultIndustryOther = raw.startsWith('Other: ') ? raw.slice('Other: '.length) : '';

  const { control, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ProfileInfoValues>({
    resolver: zodResolver(profileInfoSchema),
    defaultValues: {
      firstName:     profile.personalInfo.firstName || profile.displayName || '',
      phone:         profile.personalInfo.phone || '',
      company:       profile.personalInfo.company || '',
      industry:      defaultIndustry,
      industryOther: defaultIndustryOther,
      interests:     profile.personalInfo.interests || [],
    },
  });

  const industry  = watch('industry');
  const interests = watch('interests');

  const onSubmit = (values: ProfileInfoValues) => {
    haptics.impact();
    const industryToSend =
      values.industry === 'Other' ? `Other: ${values.industryOther.trim()}` : values.industry;

    update.mutate(
      { firstName: values.firstName, phone: values.phone, company: values.company, industry: industryToSend, interests: values.interests },
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
    <>
      <Card>
        <Card.Header
          icon={<UserIcon color={colors.primary} size={18} />}
          iconBg={colors.primarySurface}
          title={t('mobile.settings.profileInformation')}
          description={t('mobile.settings.profileDesc')}
        />
        <Card.Body>
          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <Field label={t('mobile.settings.firstName')} error={fieldState.error?.message}>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.firstNamePlaceholder')} />
              </Field>
            )}
          />

          <Field label={t('mobile.settings.email')} hint={t('mobile.settings.readOnlyHint')}>
            <Input value={profile.email} readOnly />
          </Field>

          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Field label={t('mobile.settings.phone')}>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.phonePlaceholder')} keyboardType="phone-pad" />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="company"
            render={({ field }) => (
              <Field label={t('mobile.settings.company')}>
                <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                  placeholder={t('mobile.settings.companyPlaceholder')} />
              </Field>
            )}
          />

          <Field label={t('mobile.settings.companyTaxId')} hint={t('mobile.settings.readOnlyHint')}>
            <Input value={profile.personalInfo.companyTaxIdNumber ?? ''} readOnly />
          </Field>

          <Field label={t('mobile.settings.industry')}>
            <SelectButton
              value={industry || t('mobile.settings.industryPlaceholder')}
              placeholder={!industry}
              onPress={() => setIndustrySheetOpen(true)}
            />
            {industry === 'Other' ? (
              <Controller
                control={control}
                name="industryOther"
                render={({ field }) => (
                  <View className="mt-md">
                    <Input value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
                      placeholder={t('mobile.settings.industryOtherPlaceholder')} />
                  </View>
                )}
              />
            ) : null}
          </Field>

          <Field
            label={t('mobile.settings.interests')}
            hint={t('mobile.settings.interestsOptional')}
          >
            <SelectButton
              value={
                interests.length === 0
                  ? t('mobile.settings.interestsPlaceholder')
                  : t('mobile.settings.interestsCount', { count: interests.length })
              }
              placeholder={interests.length === 0}
              onPress={() => setInterestsSheetOpen(true)}
            />
            <InterestChips
              selected={interests}
              onRemove={(slug) => setValue('interests', interests.filter((s) => s !== slug))}
            />
          </Field>

          <Button
            label={update.isPending ? t('mobile.settings.saving') : t('mobile.settings.save')}
            onPress={handleSubmit(onSubmit)}
            loading={update.isPending || isSubmitting}
            leftIcon={<Save color={colors.white} size={16} />}
            fullWidth
          />
        </Card.Body>
      </Card>

      <Sheet visible={industrySheetOpen} onClose={() => setIndustrySheetOpen(false)} title={t('mobile.settings.industry')}>
        {INDUSTRY_OPTIONS.map((opt) => (
          <Sheet.Option
            key={opt}
            label={opt}
            active={opt === industry}
            onPress={() => {
              setValue('industry', opt);
              if (opt !== 'Other') setValue('industryOther', '');
              setIndustrySheetOpen(false);
            }}
          />
        ))}
      </Sheet>

      <InterestsSheet
        visible={interestsSheetOpen}
        selected={interests}
        onToggle={(slug) =>
          setValue('interests', interests.includes(slug) ? interests.filter((s) => s !== slug) : [...interests, slug])
        }
        onClose={() => setInterestsSheetOpen(false)}
      />
    </>
  );
}
