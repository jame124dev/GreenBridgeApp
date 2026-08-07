import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';

import { Sheet, Text } from '@/components/ui';
import { brand } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type Props = {
  visible: boolean;
  accepting: boolean;
  /** Proceed to the OS permission prompt. The ONLY way out of this sheet. */
  onAccept: () => void;
};

/**
 * Context shown immediately before the OS location prompt, explaining why the
 * app wants location (auto-filling the pickup address).
 *
 * ⚠️ APP REVIEW — Guideline 5.1.1(iv). Build 1.0.0 (10) was rejected over this
 * sheet. Apple's wording:
 *
 *   "A custom message appears before the permission request, and to proceed
 *    users press a 'Use Location' and 'Allow Camera' button. Use words like
 *    'Continue' or 'Next' on the button instead."
 *
 *   "A custom message appears before the permission request, and the user can
 *    close the message and delay the permission request with the 'Not Now'
 *    button. The user should always proceed to the permission request after
 *    the message."
 *
 * So two rules bind here, and both are easy to regress:
 *   1. The button says **Continue** — never "Use location" / "Allow".
 *   2. There is **no way to dismiss without reaching the OS prompt**. The
 *      previous "Not now" button, and swipe-to-close, both hid the sheet and
 *      skipped the system dialog outright — that is precisely what Apple
 *      rejected. `onDecline` is therefore gone from this component's API, and
 *      the Sheet's close handler routes to `onAccept`.
 *
 * If a "let me skip this" affordance is ever wanted again, it has to come
 * AFTER the OS prompt, not instead of it.
 */
export function LocationPrimerSheet({ visible, accepting, onAccept }: Props) {
  const { t } = useTranslation();

  const handleContinue = () => {
    haptics.tap();
    onAccept();
  };

  return (
    // onClose → onAccept, never a silent dismiss: closing the sheet must still
    // lead to the permission request (5.1.1(iv)).
    <Sheet visible={visible} onClose={handleContinue} snapTo={320}>
      <View className="px-2xl pt-md gap-lg items-center">
        <View
          className="rounded-full items-center justify-center"
          style={{ width: 56, height: 56, backgroundColor: brand.primarySurface }}
        >
          <MapPin color={brand.primary} size={28} />
        </View>
        <Text variant="title" tone="primary" className="font-bold text-center">
          {t('mobile.scan.locationPrimerTitle', {
            defaultValue: 'Auto-fill pickup address?',
          })}
        </Text>
        <Text
          variant="bodyMd"
          tone="tertiary"
          className="text-center"
          style={{ lineHeight: 22 }}
        >
          {t('mobile.scan.locationPrimerBody', {
            defaultValue:
              'GreenBidz can use your current location to auto-fill the pickup address on the next screen. You can edit it before submitting. You choose whether to allow access on the next prompt.',
          })}
        </Text>
      </View>
      <View className="px-2xl pt-xl gap-md">
        <Pressable
          onPress={handleContinue}
          disabled={accepting}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.scan.locationPrimerContinue', {
            defaultValue: 'Continue',
          })}
          className="rounded-xl items-center justify-center"
          style={{
            backgroundColor: brand.primary,
            paddingVertical: 14,
            opacity: accepting ? 0.7 : 1,
          }}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text variant="bodyMd" className="font-semibold" style={{ color: '#fff' }}>
              {t('mobile.scan.locationPrimerContinue', { defaultValue: 'Continue' })}
            </Text>
          )}
        </Pressable>
      </View>
    </Sheet>
  );
}
