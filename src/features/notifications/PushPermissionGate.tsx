/**
 * Headless: asks for push permission at the one moment it means something —
 * the user is signed in and has landed in the app.
 *
 * Previously `initOneSignal()` prompted on mount, which put the OS dialog on
 * the LOGIN screen before the user knew what the app was, and (because it asked
 * with `fallbackToSettings`) re-showed OneSignal's "Notifications Not Available"
 * modal on every subsequent launch once declined.
 *
 * The rules here:
 *   • never on the `(auth)` screens, never without a profile;
 *   • at most ONE automatic ask per install, remembered in MMKV;
 *   • a decline is final and silent — re-enabling lives on Account → Settings;
 *   • if push is unavailable on this build (no app id / no native module / no
 *     FCM sender id) nothing happens at all, and the single ask is preserved
 *     for a later build that can actually deliver.
 *
 * The MMKV flag is only ever a *shortcut*: the real permission state is read
 * first on every launch, so the flag can never be the reason a user who was
 * never actually asked stops being asked (see `markPushAsked` ordering below).
 */
import { useEffect } from 'react';
import { useSegments } from 'expo-router';

import { getPushPermission, requestPushPermission } from '@/lib/onesignal';
import { useAuth } from '@/stores/authStore';

import { hasAskedForPush, markPushAsked } from './pushPromptState';

// Let the post-login screen paint and settle first — a system dialog that
// arrives on top of a still-mounting Home reads as a crash, not a request.
const PROMPT_DELAY_MS = 1500;

export function PushPermissionGate() {
  const segments = useSegments();
  const profile = useAuth((s) => s.profile);
  const hydrated = useAuth((s) => s.hydrated);
  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (!hydrated || !profile || inAuthGroup) return;
    if (hasAskedForPush()) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const current = await getPushPermission();
        if (cancelled || current === 'unavailable') return;
        // Already answered at OS level — granted, or declined on an earlier
        // build/install of this device. There is nothing left to ask (the OS
        // prompt won't show again), so retire the ask and leave the
        // subscription alone. Re-enabling lives on Account → Settings.
        if (current !== 'not-determined') {
          markPushAsked();
          return;
        }
        // `false` = no fallback-to-settings dialog. A decline must be silent.
        const outcome = await requestPushPermission(false);
        // Record the ask ONLY now that the dialog has resolved. Marking first
        // meant an app kill mid-prompt spent the single ask while permission
        // stayed not-determined forever; if that kill happens now the flag is
        // simply unset and the permission re-read above reconciles it — the
        // user is asked once, for real, whenever they next open the app.
        //
        // `unavailable` means the SDK call itself failed, so no dialog ever
        // reached the user — same rule as the read above: don't spend an ask
        // that was never actually made.
        if (outcome !== 'unavailable') markPushAsked();
      })();
    }, PROMPT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hydrated, profile, inAuthGroup]);

  return null;
}
