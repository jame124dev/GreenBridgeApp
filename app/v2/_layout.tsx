/**
 * `app/v2/` — the GreenBidz redesign, built alongside the shipped UI.
 *
 * WHY A PARALLEL FOLDER
 *
 * Eleven screens are being rebuilt (turns 6a–6f and 7a–7e of the design
 * canvas). Replacing them in place would leave the app half-migrated and
 * unshippable for the length of the work, on top of a release that went live
 * on 2 September. Instead the new screens grow here, reachable at `/v2/…`,
 * while the old ones keep serving users. The old UI is deleted only after the
 * release carrying v2 is approved and live — dead code costs nothing, losing
 * the rollback path mid-review costs a lot.
 *
 * A plain folder, not a route group `(v2)`: a group does not add a URL
 * segment, so its routes would collide with the existing ones.
 *
 * `V2ThemeProvider` lives here so every v2 route is themed and nothing outside
 * this folder is affected. `initialPreference="system"` will follow the device
 * the moment `app.config.ts` stops pinning `userInterfaceStyle: 'light'` —
 * which should happen in the release that deletes the old UI. Until then,
 * reach dark with the in-app toggle or by passing `initialPreference="dark"`.
 */
import React from 'react';
import { Stack } from 'expo-router';

import { SignInSheet } from '@/features/v2/auth/SignInSheet';
import { SchemeToggleDev } from '@/features/v2/ui';
import { V2ThemeProvider } from '@/theme/v2';

export default function V2Layout() {
  return (
    <V2ThemeProvider initialPreference="system">
      <Stack
        screenOptions={{
          headerShown: false,
          // Each screen paints its own ground; a default white flash between
          // routes is very visible in dark mode.
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'slide_from_right',
        }}
      >
        {/*
          Home selling ↔ buying are two routes rendering ONE conceptual screen:
          same header, same brand bar, same tab row, only the content below
          changes. Sliding them like separate pages breaks that illusion — the
          tab row appears to travel sideways when it should sit still.
        */}
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="buying" options={{ animation: 'none' }} />
      </Stack>
      {/*
        The guest gate. `requireAuth()` only sets a store flag — this is what
        renders the sheet. Without it here every v2 gate would silently do
        nothing: the tap registers, the store updates, no UI appears.

        Mounted once at the layout so no screen has to remember it.

        This is the v2 sheet, not `features/auth/SignInPrompt` — same store and
        same copy, drawn in v2 tokens. The old prompt stays mounted in
        `app/(lab)/_layout.tsx` for the shipped UI. Exactly one of the two is
        ever mounted; both would open two sheets on one tap.
      */}
      <SignInSheet />
      {/*
        Dev-only. `app.config.ts` pins userInterfaceStyle to 'light', so the
        phone's own dark setting cannot reach this app — this is the only way
        to see a v2 screen in dark on a real device. Renders null outside
        __DEV__.
      */}
      <SchemeToggleDev />
    </V2ThemeProvider>
  );
}
