import * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

// Centralized haptic feedback. Call screens via the semantic verbs below —
// `tap()`, `impact()`, `success()`, `warning()`, `error()`, `heavy()` — never
// `ExpoHaptics.*` directly. This gives us a single dial for:
//
//   - platform gating (web is silent, never crashes)
//   - future user preference ("Reduce motion / Reduce haptics" toggle)
//   - accessibility hooks (e.g. mute haptics when VoiceOver is on)
//   - consistent intensity choices across the app
//
// Guidelines for picking the right verb:
//   tap()      — selection feel: chip toggle, sheet option, language pick
//   impact()   — confirmation feel: primary CTA press (Submit, Sign in)
//   heavy()    — significant action: camera shutter, irreversible confirm
//   success()  — system-level positive: save OK, submit OK
//   warning()  — destructive intent: opening a "Sign out" / "Delete" sheet
//   error()    — system-level failure: submit failed, network error
//
// Calls are fire-and-forget; failures are swallowed silently.

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

let userDisabled = false;

/** Programmatically silence all haptics (e.g. honoring a future Settings toggle). */
export function setHapticsEnabled(value: boolean) {
  userDisabled = !value;
}

function safe(action: () => Promise<unknown>) {
  if (!enabled || userDisabled) return;
  try {
    const result = action();
    // expo-haptics returns a Promise — when the native module isn't linked
    // (e.g. a stale dev build), the call resolves synchronously but the
    // returned promise rejects async with "Haptic.x is not available on
    // android". `void` doesn't catch that — we need an explicit .catch.
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      (result as Promise<unknown>).catch(() => {
        // Swallow — haptics are non-critical.
      });
    }
  } catch {
    // Swallow synchronous throws too (module reference undefined, etc.).
  }
}

export const haptics = {
  /** Light selection feel — chip toggles, sheet options, list picks. */
  tap: () => safe(() => ExpoHaptics.selectionAsync()),

  /** Medium thump — primary CTA pressed (Submit, Sign in, Save). */
  impact: () =>
    safe(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)),

  /** Heavy thump — shutter, destructive confirm, irreversible action. */
  heavy: () =>
    safe(() => ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy)),

  /** Positive system notification — submit / save succeeded. */
  success: () =>
    safe(() =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success),
    ),

  /** Caution notification — destructive intent surface (sign-out, delete). */
  warning: () =>
    safe(() =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning),
    ),

  /** Failure notification — submit / network error. */
  error: () =>
    safe(() =>
      ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Error),
    ),
} as const;
