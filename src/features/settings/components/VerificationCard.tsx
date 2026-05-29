import { View } from 'react-native';
import { Mail, Phone, ShieldCheck, BadgeCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { brand, colors } from '@/constants/theme';
import type { UserProfile } from '@/services/auth/userProfile';

interface Props {
  profile: UserProfile;
}

// Mercari-style trust checklist. Backend wiring is out of scope for v1 —
// email is derived from `profile.email` (login flow guarantees a verified
// address); phone + identity are static "Coming soon" pills. All rows are
// plain <View>s because none are currently tappable; switch the right row to
// <Pressable> + accessibilityRole="button" once the backend supplies a
// verification flow URL.
export function VerificationCard({ profile }: Props) {
  const { t } = useTranslation();
  const emailVerified = Boolean(profile.email);

  return (
    <Card>
      <Card.Header
        icon={<ShieldCheck color={brand.primary} size={18} />}
        iconBg={brand.primarySurface}
        title={t('mobile.settings.verificationTitle', { defaultValue: 'Trust & Verification' })}
        description={t('mobile.settings.verificationDesc', {
          defaultValue: 'Complete each step to earn the Verified Seller badge.',
        })}
      />
      <Card.Body>
        <Row
          icon={<Mail color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.verifyEmail', { defaultValue: 'Email address' })}
          sub={profile.email || t('mobile.settings.verifyEmailMissing', { defaultValue: 'No email on file' })}
          right={
            emailVerified ? (
              <Badge variant="success" label={t('mobile.settings.verified', { defaultValue: 'Verified' })} />
            ) : (
              <Badge variant="neutral" label={t('mobile.settings.comingSoon', { defaultValue: 'Coming soon' })} />
            )
          }
        />

        <Row
          icon={<Phone color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.verifyPhone', { defaultValue: 'Phone number' })}
          sub={
            profile.personalInfo.phone ||
            t('mobile.settings.verifyPhoneMissing', { defaultValue: 'Add a phone to enable verification' })
          }
          right={<Badge variant="neutral" label={t('mobile.settings.comingSoon', { defaultValue: 'Coming soon' })} />}
        />

        <Row
          icon={<BadgeCheck color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.verifyIdentity', { defaultValue: 'Identity' })}
          sub={t('mobile.settings.verifyIdentityHint', {
            defaultValue: 'Upload a government ID for the trusted-seller badge',
          })}
          right={<Badge variant="neutral" label={t('mobile.settings.comingSoon', { defaultValue: 'Coming soon' })} />}
        />
      </Card.Body>
    </Card>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  right: React.ReactNode;
}

function Row({ icon, label, sub, right }: RowProps) {
  return (
    <View className="flex-row items-center gap-lg">
      <View className="w-9 h-9 rounded-lg bg-neutral-100 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1 min-w-0">
        <Text variant="bodyMd" tone="primary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="bodySm" tone="tertiary" numberOfLines={1} className="mt-[1px]">
          {sub}
        </Text>
      </View>
      <View className="flex-shrink-0">{right}</View>
    </View>
  );
}
