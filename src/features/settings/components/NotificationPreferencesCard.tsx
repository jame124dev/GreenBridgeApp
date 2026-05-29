import { useRef } from 'react';
import { Switch, View } from 'react-native';
import { Bell, DollarSign, Gavel } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { brand, colors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import {
  useNotificationPreferences,
  type NotificationKey,
} from '../useNotificationPreferences';

// Notification preferences card — UI scaffold only. State lives in MMKV via
// `useNotificationPreferences()`; no backend sync today because the push-
// notifications backend isn't wired. When it ships, this card will keep its
// shape and `setPreference` will start sending an async update too.

const TOAST_DEBOUNCE_MS = 500;

export function NotificationPreferencesCard() {
  const { t } = useTranslation();
  const { prefs, setPreference } = useNotificationPreferences();
  // Debounce: rapid toggle taps (or a screen-reader user sweeping through)
  // shouldn't fire a queue of identical toasts. Ref-tracked timestamp so the
  // throttle doesn't trip the React-Compiler ref-in-render rule.
  const lastToastAt = useRef(0);

  const handleToggle = (key: NotificationKey, next: boolean) => {
    haptics.tap();
    setPreference(key, next);
    const now = Date.now();
    if (now - lastToastAt.current >= TOAST_DEBOUNCE_MS) {
      lastToastAt.current = now;
      toast(t('mobile.settings.notificationsUpdated', { defaultValue: 'Notifications updated' }));
    }
  };

  return (
    <Card>
      <Card.Header
        icon={<Bell color={brand.primary} size={18} />}
        iconBg={brand.primarySurface}
        title={t('mobile.settings.notificationsTitle', { defaultValue: 'Notifications' })}
        description={t('mobile.settings.notificationsDesc', {
          defaultValue: 'Choose which alerts you receive about your listings.',
        })}
      />
      <Card.Body>
        <Row
          icon={<Gavel color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.notifyBid', { defaultValue: 'Bid received' })}
          sub={t('mobile.settings.notifyBidHint', { defaultValue: 'Someone places a bid on your listing' })}
          value={prefs.bidReceived}
          onChange={(v) => handleToggle('bidReceived', v)}
        />
        <Row
          icon={<DollarSign color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.notifyOffer', { defaultValue: 'Offer received' })}
          sub={t('mobile.settings.notifyOfferHint', { defaultValue: 'A buyer sends you a direct offer' })}
          value={prefs.offerReceived}
          onChange={(v) => handleToggle('offerReceived', v)}
        />
        <Row
          icon={<Bell color={colors.neutral[500]} size={18} />}
          label={t('mobile.settings.notifyPayment', { defaultValue: 'Payment status' })}
          sub={t('mobile.settings.notifyPaymentHint', { defaultValue: 'Payouts, refunds, and payment failures' })}
          value={prefs.paymentStatus}
          onChange={(v) => handleToggle('paymentStatus', v)}
        />
      </Card.Body>
    </Card>
  );
}

interface RowProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function Row({ icon, label, sub, value, onChange }: RowProps) {
  return (
    <View className="flex-row items-center gap-lg">
      <View className="w-9 h-9 rounded-lg bg-neutral-100 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1 min-w-0">
        <Text variant="bodyMd" tone="primary" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="bodySm" tone="tertiary" numberOfLines={2} className="mt-[1px]">
          {sub}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        // Brand-themed on-state. Off-state uses RN default neutral track so the
        // contrast against `brand.primary` (deep forest) is unambiguous.
        trackColor={{ false: colors.neutral[300], true: brand.primary }}
        thumbColor={colors.neutral[0]}
        ios_backgroundColor={colors.neutral[300]}
        accessibilityLabel={label}
      />
    </View>
  );
}
