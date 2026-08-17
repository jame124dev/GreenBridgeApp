import { useRef, useState } from 'react';
import { Switch, View } from 'react-native';
import { Bell, BellOff, DollarSign, Gavel, Info } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { brand, colors } from '@/constants/theme';
import { usePushPermission, type PushPermissionUiState } from '@/features/notifications';
import { haptics } from '@/lib/haptics';
import { requestPushPermission } from '@/lib/onesignal';
import {
  useNotificationPreferences,
  type NotificationKey,
} from '../useNotificationPreferences';

// Notification preferences card — UI scaffold only. State lives in MMKV via
// `useNotificationPreferences()`; no backend sync today because the push-
// notifications backend isn't wired. When it ships, this card will keep its
// shape and `setPreference` will start sending an async update too.

const TOAST_DEBOUNCE_MS = 500;

// Ceiling on the "turning on" spinner. The fallback-to-settings path can hand
// the user to the system Settings app, and that promise is not guaranteed to
// settle — without a bound the button would spin until the screen unmounts.
const ENABLE_TIMEOUT_MS = 10_000;

/** Resolve `p`, or `'timeout'` after `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.then((v) => {
      if (timer) clearTimeout(timer);
      return v;
    }),
    new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), ms);
    }),
  ]);
}

export function NotificationPreferencesCard() {
  const { t } = useTranslation();
  const { prefs, setPreference } = useNotificationPreferences();
  const { state: pushState, refresh: refreshPush } = usePushPermission();
  const [enabling, setEnabling] = useState(false);
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

  // The one place a user can turn push on: a first-time ask when they were
  // never prompted, or the route back for someone who declined.
  const handleEnablePush = async () => {
    // No haptics.tap() here — <Button> already fires its own impact.
    // Fallback-to-settings ONLY for an existing decline: the OS prompt is spent
    // for that user, so OneSignal's "Open Settings" dialog is the only thing
    // that can help. A never-asked user gets the plain native prompt.
    const toSettings = pushState === 'denied';
    setEnabling(true);
    try {
      const outcome = await withTimeout(
        (async () => {
          const asked = await requestPushPermission(toSettings);
          // The live re-read is the truth for granted/denied; `asked` is the
          // only thing that knows the SDK call itself failed (push isn't
          // available on this build at all).
          const live = await refreshPush();
          if (live === 'granted') return 'granted';
          return asked === 'unavailable' ? 'unavailable' : live;
        })(),
        ENABLE_TIMEOUT_MS,
      );

      if (outcome === 'granted') {
        toast(t('mobile.settings.pushOnToast', { defaultValue: 'Push notifications are on' }));
      } else if (outcome === 'unavailable') {
        // Never tell this user to change a device setting — no setting helps.
        toast(
          t('mobile.settings.pushUnavailableTitle', {
            defaultValue: "Push notifications aren't available in this app version",
          }),
        );
      }
      // 'denied' / 'not-determined' / 'timeout' stay silent on purpose: on the
      // settings path OneSignal has already shown its own dialog (a toast would
      // repeat the same instruction), a timeout means the user is still in
      // system Settings, and in every case the strip below re-renders with the
      // real state — that is the feedback.
    } finally {
      setEnabling(false);
    }
  };

  const banner = pushBanner(pushState, t);

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
        {/* One strip, four truths: off (declined), not set up yet (never
            asked), or unavailable on this build. 'unknown' (still reading)
            and 'granted' render nothing. */}
        {banner ? (
          <View
            className="rounded-xl p-lg gap-md"
            style={
              banner.tone === 'warning'
                ? { backgroundColor: brand.warningBg, borderWidth: 1, borderColor: brand.warningBorder }
                : { backgroundColor: brand.infoBg, borderWidth: 1, borderColor: brand.border }
            }
          >
            <View className="flex-row items-start gap-lg">
              {banner.icon}
              <View className="flex-1 min-w-0">
                <Text variant="bodyMd" tone="primary">
                  {banner.title}
                </Text>
                <Text variant="bodySm" tone="tertiary" className="mt-[2px]">
                  {banner.body}
                </Text>
              </View>
            </View>
            {banner.action ? (
              <>
                <Button
                  label={banner.action}
                  variant="secondary"
                  size="sm"
                  loading={enabling}
                  onPress={() => void handleEnablePush()}
                />
                {/* Explanatory, not generic: the spinner hides the label, so say
                    what we are waiting for. */}
                {enabling ? (
                  <Text variant="bodySm" tone="tertiary" className="text-center">
                    {banner.busyHint}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}
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

interface PushBanner {
  tone: 'warning' | 'info';
  icon: React.ReactNode;
  title: string;
  body: string;
  /** `null` when no action the user can take would help. */
  action: string | null;
  busyHint: string | null;
}

/**
 * What the card says for each permission state.
 *
 * Kept beside each other on purpose: the previous version had a single
 * "Push notifications are off" strip for everything that wasn't `granted`, so a
 * user who had never been asked was told they had refused, and someone on a
 * build that cannot deliver push at all was sent to a device setting that
 * changes nothing. `granted` and `unknown` (still reading) show no strip.
 */
function pushBanner(
  state: PushPermissionUiState,
  t: ReturnType<typeof useTranslation>['t'],
): PushBanner | null {
  const action = t('mobile.settings.pushOffAction', { defaultValue: 'Turn on notifications' });
  // Same reason to switch them on whether the user declined or was never asked.
  const body = t('mobile.settings.pushOffBody', {
    defaultValue: 'Turn them on to hear about bids, offers and payment updates as they happen.',
  });

  switch (state) {
    case 'denied':
      return {
        tone: 'warning',
        icon: <BellOff color={brand.warningText} size={18} />,
        title: t('mobile.settings.pushOffTitle', { defaultValue: 'Push notifications are off' }),
        body,
        action,
        busyHint: t('mobile.settings.pushOpeningSettings', {
          defaultValue: 'Opening your device notification settings…',
        }),
      };
    case 'not-determined':
      return {
        tone: 'info',
        icon: <Bell color={brand.infoText} size={18} />,
        title: t('mobile.settings.pushSetupTitle', {
          defaultValue: "Push notifications aren't set up yet",
        }),
        body,
        action,
        busyHint: t('mobile.settings.pushWaitingAnswer', {
          defaultValue: 'Waiting for your answer to the permission prompt…',
        }),
      };
    case 'unavailable':
      return {
        tone: 'info',
        icon: <Info color={brand.infoText} size={18} />,
        title: t('mobile.settings.pushUnavailableTitle', {
          defaultValue: "Push notifications aren't available in this app version",
        }),
        body: t('mobile.settings.pushUnavailableBody', {
          defaultValue:
            "There's nothing to change in your settings — we'll switch them on in a future update. Alerts still appear while you're using the app.",
        }),
        action: null,
        busyHint: null,
      };
    default:
      return null;
  }
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
