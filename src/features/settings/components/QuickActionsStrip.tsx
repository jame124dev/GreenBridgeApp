import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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

  /**
   * ⚠️ These two used to show a "coming soon" toast and do nothing else.
   *
   * That is a Guideline 2.1 (App Completeness) rejection risk: Apple treats
   * placeholder features as an incomplete app, and these are two of only four
   * tiles on the Account screen — a reviewer exploring that tab taps them.
   * Build 1.0.0 (10) was already rejected under 2.1(a) for a dead link, so
   * shipping visible dead buttons alongside it invites the same finding.
   *
   * Both now open real pages, verified by RENDERING them (not by status code —
   * these are SPAs that serve 200 on a missing route, which is exactly how the
   * two 404s got shipped):
   *   Help  → greenbidz.com/contact-us/  (the App Store Support URL: contact
   *           form, info@greenbidz.com, phone, WhatsApp)
   *   About → greenbidz.com             (GreenBidz Group site)
   */
  const openPage = async (url: string) => {
    haptics.tap();
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: '#14452f',
        controlsColor: '#FFFFFF',
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      toast.error(
        t('mobile.profile.openLinkFailed', {
          defaultValue: 'Open the link from your browser instead.',
        }),
      );
    }
  };

  const showHelp = () => openPage('https://greenbidz.com/contact-us/');
  const showAbout = () => openPage('https://greenbidz.com');

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
