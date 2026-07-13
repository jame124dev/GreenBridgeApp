import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Package, HelpCircle, Info, LogOut } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Text } from '@/components/ui/Text';
import { haptics } from '@/lib/haptics';
import { brand } from '@/constants/theme';
import { IS_CUSTOMER } from '@/lib/flags';
import { routes } from '@/lib/routes';

interface Props {
  /** Trigger the parent's sign-out flow (`useLogout` mutation). */
  onSignOut: () => void;
  /** True while the sign-out mutation is in flight — dims that tile. */
  signingOut?: boolean;
}

// Sits between the hero and the section cards. The negative top margin pulls
// the strip up to overlap the hero's bottom curve so it reads as a single
// connected unit rather than a floating card.
export function QuickActionsStrip({ onSignOut, signingOut }: Props) {
  const { t } = useTranslation();

  const goListings = () => {
    haptics.tap();
    // Fork-aware: the customer (lab) build has no seller (tabs) shell — routing
    // there drops the user into the seller Home/History/Me nav. Send lab users
    // to the in-shell "My listings" page (keeps the lab tab bar, Account active).
    router.push(IS_CUSTOMER ? routes.labListings : '/(tabs)/history');
  };

  const showHelp = () => {
    haptics.tap();
    toast(t('mobile.profile.helpComingSoon', { defaultValue: 'Help & support coming soon' }));
  };

  const showAbout = () => {
    haptics.tap();
    toast(t('mobile.profile.aboutComingSoon', { defaultValue: 'About GreenBridge — coming soon' }));
  };

  const handleSignOut = () => {
    if (signingOut) return;
    haptics.warning();
    onSignOut();
  };

  return (
    <View className="mx-lg -mt-2xl bg-white rounded-2xl border border-neutral-200 shadow-sm flex-row overflow-hidden">
      <ActionTile
        icon={<Package color={brand.primary} size={20} />}
        label={t('mobile.profile.listingsAction', { defaultValue: 'Listings' })}
        onPress={goListings}
      />
      <Divider />
      <ActionTile
        icon={<HelpCircle color={brand.primary} size={20} />}
        label={t('mobile.profile.helpAction', { defaultValue: 'Help' })}
        onPress={showHelp}
      />
      <Divider />
      <ActionTile
        icon={<Info color={brand.primary} size={20} />}
        label={t('mobile.profile.aboutAction', { defaultValue: 'About' })}
        onPress={showAbout}
      />
      <Divider />
      <ActionTile
        icon={<LogOut color={brand.destructiveStrong} size={20} />}
        label={t('mobile.profile.signOutAction', { defaultValue: 'Sign out' })}
        onPress={handleSignOut}
        disabled={signingOut}
        tone="danger"
      />
    </View>
  );
}

function Divider() {
  return <View className="w-px bg-neutral-200" />;
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}

function ActionTile({ icon, label, onPress, disabled, tone = 'default' }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-1 items-center justify-center py-md gap-xs active:opacity-60 ${disabled ? 'opacity-50' : ''}`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
      <Text
        variant="caption"
        tone={tone === 'danger' ? 'danger' : 'secondary'}
        className="font-semi text-center"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
