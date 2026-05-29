import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react-native';

import { Sheet, Text } from '@/components/ui';
import { brand } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

type Props = {
  visible: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

/**
 * Soft pre-prompt before the OS location permission. Explains why the app
 * wants location (auto-fill the pickup address) so the user has context before
 * the system dialog appears — improves grant rate vs. surfacing the OS prompt
 * cold. "Not now" hides the sheet without triggering the OS prompt; the user
 * can still grant from the detail-screen "Use my location" button later.
 */
export function LocationPrimerSheet({
  visible,
  accepting,
  onAccept,
  onDecline,
}: Props) {
  const { t } = useTranslation();

  const handleAccept = () => {
    haptics.tap();
    onAccept();
  };
  const handleDecline = () => {
    haptics.tap();
    onDecline();
  };

  return (
    <Sheet visible={visible} onClose={onDecline} snapTo={360}>
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
              'GreenBridge can use your current location to auto-fill the pickup address on the next screen. You can edit it before submitting.',
          })}
        </Text>
      </View>
      <View className="px-2xl pt-xl gap-md">
        <Pressable
          onPress={handleAccept}
          disabled={accepting}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.scan.locationPrimerAccept', {
            defaultValue: 'Use location',
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
              {t('mobile.scan.locationPrimerAccept', { defaultValue: 'Use location' })}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleDecline}
          disabled={accepting}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.scan.locationPrimerDecline', {
            defaultValue: 'Not now',
          })}
          className="rounded-xl items-center justify-center py-3"
        >
          <Text variant="bodyMd" tone="tertiary" className="font-medium">
            {t('mobile.scan.locationPrimerDecline', { defaultValue: 'Not now' })}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
