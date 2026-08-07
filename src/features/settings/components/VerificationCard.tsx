import { View } from 'react-native';
import { Mail, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { brand, colors } from '@/constants/theme';
import type { UserProfile } from '@/services/auth/userProfile';

interface Props {
  profile: UserProfile;
}

// Trust checklist. Email is derived from `profile.email` (the login flow
// guarantees a verified address).
//
// This card used to also list Phone and Identity rows carrying static
// "Coming soon" badges, plus a header promising "Complete each step to earn the
// Verified Seller badge". Neither step existed — and this is the Account tab,
// which every App Review pass opens, so advertising unbuilt features here is an
// App Store Guideline 2.1 (App Completeness) rejection risk. Both rows and the
// promise are gone until the backend supplies a real verification flow; add them
// back together with it (as <Pressable> + accessibilityRole="button", since a
// real flow is tappable — these rows are plain <View>s today).
export function VerificationCard({ profile }: Props) {
  const { t } = useTranslation();
  const emailVerified = Boolean(profile.email);

  return (
    <Card>
      <Card.Header
        icon={<ShieldCheck color={brand.primary} size={18} />}
        iconBg={brand.primarySurface}
        title={t('mobile.settings.verificationTitle', { defaultValue: 'Trust & Verification' })}
      />
      <Card.Body>
        <Row
          icon={<Mail color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.verifyEmail', { defaultValue: 'Email address' })}
          sub={profile.email || t('mobile.settings.verifyEmailMissing', { defaultValue: 'No email on file' })}
          right={
            emailVerified ? (
              <Badge variant="success" label={t('mobile.settings.verified', { defaultValue: 'Verified' })} />
            ) : null
          }
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
