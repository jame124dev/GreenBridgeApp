/**
 * OneSignal push — mobile foundation.
 *
 * Reuses the SAME OneSignal app as the web (P2 web push): the backend already
 * targets users by `external_id = userId`, so once the device registers and we
 * call `login(userId)`, the backend's existing sends reach mobile with no
 * server changes.
 *
 * This module is the transport layer only: initialize, expose the permission
 * primitives, and identify the signed-in user. It deliberately does NOT decide
 * *when* to ask — that policy lives in `@/features/notifications` so the prompt
 * can be tied to an authenticated, in-app moment instead of app start.
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

/** Initialize OneSignal once. Call after the app mounts. No-op without an app
 *  id or the native module.
 *
 *  ⚠️ Init must stay permission-free. Asking here meant the OS prompt fired on
 *  the LOGIN screen (no context, and Apple flags uncontextualised prompts), and
 *  because the old call passed `fallbackToSettings: true` every later cold
 *  start re-showed OneSignal's own "Notifications Not Available / Open Settings"
 *  dialog to anyone who had declined. The ask now belongs to
 *  `PushPermissionGate` (post-auth, once per install). */
export function initOneSignal(): void {
  if (initialized || !APP_ID) return;
  const mod = getSDK();
  if (!mod) return;
  const { OneSignal, LogLevel } = mod;
  try {
    if (__DEV__) OneSignal.Debug.setLogLevel(LogLevel.Verbose);
    OneSignal.initialize(APP_ID);
    initialized = true;

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

/**
 * OS push-permission state.
 *
 * Four states, because collapsing them lies to the user:
 *   • `granted`        — push can be delivered.
 *   • `denied`         — the user was asked and said no. The OS prompt will
 *                        never show again; only system Settings can undo it.
 *   • `not-determined` — never asked. Telling this user notifications are "off"
 *                        accuses them of a refusal they never made, and hides
 *                        the fact that a plain in-app ask still works.
 *   • `unavailable`    — push cannot work on this build at all: web, a
 *                        dev-client without the native module, or no OneSignal
 *                        app id. NOT an error the user can fix, so callers must
 *                        degrade quietly and must never send them to Settings.
 */
export type PushPermissionState = 'granted' | 'denied' | 'not-determined' | 'unavailable';

/** iOS `OSNotificationPermission`. Compared as plain numbers so the enum stays
 *  behind the lazy require (a static import would break web). */
const IOS_PERMISSION_NOT_DETERMINED = 0;
const IOS_PERMISSION_DENIED = 1;

/** Current OS push permission. Never throws. */
export async function getPushPermission(): Promise<PushPermissionState> {
  if (!APP_ID) return 'unavailable';
  const mod = getSDK();
  if (!mod) return 'unavailable';
  try {
    const N = mod.OneSignal.Notifications;
    if (await N.getPermissionAsync()) return 'granted';

    // Not granted — now separate "never asked" from "said no". iOS reports the
    // three states natively, so prefer it there.
    if (Platform.OS === 'ios' && typeof N.permissionNative === 'function') {
      const native = Number(await N.permissionNative());
      if (native === IOS_PERMISSION_NOT_DETERMINED) return 'not-determined';
      if (native === IOS_PERMISSION_DENIED) return 'denied';
    }
    // Android (and any build without the native enum): "would a prompt still
    // show?" is the signal — true only while the device has never been asked.
    if (typeof N.canRequestPermission === 'function' && (await N.canRequestPermission())) {
      return 'not-determined';
    }
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

/**
 * Show the OS permission prompt and resolve with the resulting state.
 *
 * `fallbackToSettings` hands an already-denied user to OneSignal's own
 * "Open Settings" dialog. Pass it ONLY from an explicit user action (the
 * Settings card) — an automatic call with it on is exactly what turned a single
 * decline into a modal on every launch.
 */
export async function requestPushPermission(fallbackToSettings = false): Promise<PushPermissionState> {
  if (!APP_ID) return 'unavailable';
  const mod = getSDK();
  if (!mod) return 'unavailable';
  try {
    if (await mod.OneSignal.Notifications.requestPermission(fallbackToSettings)) return 'granted';
    // A `false` here is not necessarily a refusal — an Android user can swipe
    // the dialog away, leaving permission undetermined. Re-read rather than
    // recording a "no" the user never gave.
    return await getPushPermission();
  } catch {
    return 'unavailable';
  }
}

/** Observe OS permission flips (e.g. the user toggles us back on in system
 *  Settings and returns). Returns an unsubscribe fn; noop when unavailable. */
export function addPushPermissionListener(cb: (granted: boolean) => void): () => void {
  if (!APP_ID) return () => {};
  const mod = getSDK();
  if (!mod) return () => {};
  const { OneSignal } = mod;
  try {
    OneSignal.Notifications.addEventListener('permissionChange', cb);
  } catch {
    return () => {};
  }
  return () => {
    try {
      OneSignal.Notifications.removeEventListener('permissionChange', cb);
    } catch {
      /* best-effort */
    }
  };
}

/**
 * A "recognition draft ready" push arriving while the app is in the FOREGROUND.
 * The backend sends this via `sendPushToUser({ type: 'recognition_draft_ready',
 * job_id, draft_id, … })`; on the wire those ride in the notification's
 * `additionalData`. Delivery still depends on FCM/APNs push credentials being
 * live for the OneSignal app — until then no push arrives and this simply never
 * fires (the socket + polling layers cover the in-app case regardless).
 */
export interface PushDraftReady {
  jobId?: string;
  draftId?: string | number;
}

/**
 * Register a handler for foreground `recognition_draft_ready` pushes. OneSignal
 * still displays the system notification (we don't `preventDefault`); this just
 * lets the app react in-line — refresh the drafts list + raise the same toast
 * as the other layers. Returns an unsubscribe fn. No-op (returns a noop) on web
 * / a dev-client without the native module.
 */
export function registerForegroundPushHandler(cb: (p: PushDraftReady) => void): () => void {
  const mod = getSDK();
  if (!mod) return () => {};
  const { OneSignal } = mod;
  const handler = (event: any) => {
    try {
      const data = event?.notification?.additionalData ?? {};
      if (data.type !== 'recognition_draft_ready') return;
      cb({
        jobId: data.job_id != null ? String(data.job_id) : undefined,
        draftId: data.draft_id,
      });
    } catch {
      /* best-effort */
    }
  };
  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', handler);
  } catch {
    return () => {};
  }
  return () => {
    try {
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handler);
    } catch {
      /* best-effort */
    }
  };
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
