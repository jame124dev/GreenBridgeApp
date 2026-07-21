/**
 * OneSignal push — mobile foundation.
 *
 * Reuses the SAME OneSignal app as the web (P2 web push): the backend already
 * targets users by `external_id = userId`, so once the device registers and we
 * call `login(userId)`, the backend's existing sends reach mobile with no
 * server changes.
 *
 * This module is the minimal foundation: initialize, (contextually) request
 * permission, and identify the signed-in user. Notification-tap deep-linking
 * comes next.
 *
 * Best-effort throughout — the native module is absent on web and on a
 * dev-client that predates the OneSignal install, so every call is guarded and
 * never throws. Adding/changing the app id needs a dev-client REBUILD.
 */
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { routeForType } from '@/features/lab/notifications/notificationNav';

const APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';

let initialized = false;

/** Lazily require the native SDK so web / missing-module builds don't crash. */
function getSDK(): typeof import('react-native-onesignal') | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-onesignal');
  } catch {
    return null;
  }
}

/** Initialize OneSignal once and prompt for notification permission. Call after
 *  the app mounts. No-op without an app id or the native module. */
export function initOneSignal(): void {
  if (initialized || !APP_ID) return;
  const mod = getSDK();
  if (!mod) return;
  const { OneSignal, LogLevel } = mod;
  try {
    if (__DEV__) OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(APP_ID);
    initialized = true;
    // Foundation: prompt now so we can confirm a subscription from the panel.
    // (A production build should make this contextual, mirroring the web rule.)
    OneSignal.Notifications.requestPermission(true).catch(() => {});

    // Push-tap deep-link: route to the screen for the notification's `type`
    // (e.g. recognition_draft_ready → /scan/drafts). Best-effort — an unknown
    // or missing type just leaves the app on its current screen.
    try {
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        const type = event?.notification?.additionalData?.type;
        const route = typeof type === 'string' ? routeForType(type) : null;
        if (route) router.push(route as never);
      });
    } catch {
      /* listener is best-effort */
    }

    // In-App Messages need NO FCM/APNs — they display inside the running app
    // over OneSignal's session sync, so they're testable from the panel even
    // before push credentials exist. These listeners just log lifecycle so we
    // can confirm delivery during testing.
    try {
      const iam = OneSignal.InAppMessages;
      iam.addEventListener('willDisplay', () => console.log('[OneSignal] IAM willDisplay'));
      iam.addEventListener('didDisplay', () => console.log('[OneSignal] IAM didDisplay'));
      iam.addEventListener('click', (e: unknown) =>
        console.log('[OneSignal] IAM click', JSON.stringify(e)),
      );
      iam.addEventListener('didDismiss', () => console.log('[OneSignal] IAM didDismiss'));
    } catch {
      /* listeners are best-effort */
    }
  } catch {
    /* best-effort */
  }
}

/** Set an In-App Message trigger (e.g. addOneSignalTrigger('screen','home')) so
 *  dashboard messages can target specific app states. Best-effort. */
export function addOneSignalTrigger(key: string, value: string): void {
  if (!APP_ID) return;
  const mod = getSDK();
  if (!mod) return;
  try {
    mod.OneSignal.InAppMessages.addTrigger(key, value);
  } catch {
    /* best-effort */
  }
}

/** Associate the device with the signed-in user so backend external_id sends
 *  reach it. Safe to call repeatedly. */
export function loginOneSignal(userId: string | number | undefined | null): void {
  if (!APP_ID || userId == null) return;
  const mod = getSDK();
  if (!mod) return;
  try {
    mod.OneSignal.login(String(userId));
  } catch {
    /* best-effort */
  }
}

/** Drop the identity association on logout. */
export function logoutOneSignal(): void {
  if (!APP_ID) return;
  const mod = getSDK();
  if (!mod) return;
  try {
    mod.OneSignal.logout();
  } catch {
    /* best-effort */
  }
}
