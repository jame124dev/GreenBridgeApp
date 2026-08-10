import { useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Package, HelpCircle, Info, LogOut, X } from 'lucide-react-native';
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
  const [aboutOpen, setAboutOpen] = useState(false);

  const goListings = () => {
    haptics.tap();
    // Fork-aware: the customer (lab) build has no seller (tabs) shell — routing
    // there drops the user into the seller Home/History/Me nav. Send lab users
    // to the in-shell "My listings" page (keeps the lab tab bar, Account active).
    router.push(IS_CUSTOMER ? routes.labListings : '/(tabs)/history');
  };

  /**
   * ⚠️ These two tiles have now been rejected for BOTH possible extremes, so
   * read this before changing either one.
   *
   * 1. They originally showed a "coming soon" toast and did nothing. That is a
   *    Guideline 2.1 (App Completeness) risk — Apple treats placeholder
   *    features as an incomplete app.
   * 2. So they were pointed at real pages: Help → `greenbidz.com/contact-us/`,
   *    About → `greenbidz.com`. App Review then rejected build 14 under
   *    **Guideline 3.1.1**, because that contact page carries a Company field
   *    and offers "auction services" / "list my equipment" / "free valuation" —
   *    i.e. the app was handing businesses an external sign-up funnel.
   *
   * The resolution that satisfies both: keep the tiles genuinely functional,
   * but keep them OFF the commercial website.
   *   Help  → `mailto:` support. An email address is support, not a purchase or
   *           registration mechanism, and it is the same address Apple already
   *           has as the app's support contact.
   *   About → an in-app sheet (app name, version, what GreenBidz is) plus the
   *           legal links. No route to the business site at all.
   *
   * DO NOT "improve" these by linking to greenbidz.com again.
   */
  const SUPPORT_EMAIL = 'support@greenbidz.com';

  const showHelp = async () => {
    haptics.tap();
    const subject = t('mobile.profile.helpMailSubject', {
      defaultValue: 'GreenBidz app support',
    });
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    try {
      const opened = await Linking.canOpenURL(url);
      if (!opened) throw new Error('no mail client');
      await Linking.openURL(url);
    } catch {
      // A simulator or a device with no mail account configured lands here.
      // Show the address rather than failing silently — the user can still
      // write it down and reach support.
      toast.info(
        t('mobile.profile.helpEmailFallback', {
          defaultValue: `Email us at ${SUPPORT_EMAIL}`,
          email: SUPPORT_EMAIL,
        }),
      );
    }
  };

  const showAbout = () => {
    haptics.tap();
    setAboutOpen(true);
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
      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </View>
  );
}

/**
 * In-app About. Replaces what used to be a hand-off to `greenbidz.com` — see
 * the Guideline 3.1.1 note above. Everything here is local: no network call, no
 * external navigation, nothing that could read as a business sign-up route.
 */
function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? '');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50 items-center justify-center px-lg"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.common.close', { defaultValue: 'Close' })}
      >
        {/* Stop taps inside the card from closing the sheet. */}
        <Pressable onPress={() => {}} className="w-full bg-white rounded-2xl p-lg" style={{ maxWidth: 420 }}>
          <View className="flex-row items-start justify-between mb-sm">
            <Text variant="title" className="font-semi flex-1">
              {t('mobile.profile.aboutTitle', { defaultValue: 'About GreenBidz' })}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.common.close', { defaultValue: 'Close' })}
            >
              <X size={20} color="#43474F" />
            </Pressable>
          </View>

          <Text variant="body" tone="secondary" className="mb-md">
            {t('mobile.profile.aboutBody', {
              defaultValue:
                'GreenBidz is an international marketplace for used laboratory and industrial equipment — buy, sell and find surplus machinery.',
            })}
          </Text>

          <Text variant="caption" tone="secondary">
            {t('mobile.profile.aboutVersion', {
              defaultValue: `Version ${version}${build ? ` (${build})` : ''}`,
              version,
              build,
            })}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
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
