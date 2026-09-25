/**
 * The scan route group's layout.
 *
 * ── WHY `V2ThemeProvider` IS HERE ──────────────────────────────────────────
 *
 * The screens in this folder are being ported to the v2 kit, and every v2
 * primitive — `Screen`, `Text`, `Timeline`, `Chip` — calls `useV2Theme()` for
 * its palette. That hook throws without a provider above it:
 *
 *   "useV2Theme must be used inside <V2ThemeProvider>.
 *    Wrap the v2 route group in app/v2/_layout.tsx."
 *
 * The message names `app/v2/_layout.tsx` because that was the only group using
 * the kit when it was written. `app/scan` is a SEPARATE route group with its
 * own layout, so the provider mounted there does not reach these routes — the
 * ported screen typechecked, passed the adherence and contrast gates, and then
 * threw an uncaught error the moment it rendered on the device.
 *
 * `initialPreference="light"`, not `"system"` as v2 uses. These routes are
 * still entered from the OLD UI, which is light-only (`app.config.ts` pins
 * `userInterfaceStyle: 'light'`), and a scan that opened dark from a light home
 * would read as a bug rather than a preference. It becomes `"system"` when the
 * old UI goes.
 */
import { Stack } from 'expo-router';

import { V2ThemeProvider } from '@/theme/v2';

export default function ScanLayout() {
  return (
    <V2ThemeProvider initialPreference="light">
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </V2ThemeProvider>
  );
}
