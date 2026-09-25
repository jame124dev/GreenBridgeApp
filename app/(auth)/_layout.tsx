/**
 * The auth group — and the second place in the app that mounts the v2 theme.
 *
 * ⚠️ WHY THE AUTH SCREENS ARE v2 IN PLACE, AND NOT A COPY UNDER `app/v2/`
 *
 * `SignInSheet` sits beside the shipped `SignInPrompt` rather than replacing
 * it, and the same instinct would say to fork `login`/`register` too. It is
 * wrong here, for a reason that does not apply to a sheet: there is exactly
 * ONE auth group in this app and everything routes to it globally.
 * `AuthGuard` in `app/_layout.tsx` sends any unauthenticated user to
 * `/(auth)/login` whichever UI they came from, and the guard already carries a
 * delicate fix for a redirect RACE against these screens (see
 * `postAuthLanding`). A second login screen would mean a second copy of that
 * race, and a deep link into v2 while signed out would still land on the old
 * one — so the fork buys nothing and doubles the surface.
 *
 * The consequence, stated plainly: this changes how sign-in looks for the
 * app people are using today, not only for v2. That is unavoidable while one
 * auth group serves both, and it is the right direction — the old screens had
 * three private palettes of hardcoded hex between them and no dark mode at
 * all, so on a dark phone they were white sheets.
 *
 * `initialPreference="system"` matches `app/v2/_layout.tsx`. The two providers
 * are siblings, never nested, so there is no context to bridge.
 */
import { Stack } from 'expo-router';

import { V2ThemeProvider } from '@/theme/v2';

export default function AuthLayout() {
  return (
    <V2ThemeProvider initialPreference="system">
      <Stack screenOptions={{ headerShown: false }} />
    </V2ThemeProvider>
  );
}
