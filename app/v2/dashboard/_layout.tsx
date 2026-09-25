/**
 * The dashboard section — its own layout, with a side menu.
 *
 * Everything the buyer and seller dashboards contain lives under this route
 * so that they share one menu and one way out. The plan and the per-page
 * specs are in `Docs/Dashboard/`.
 *
 * ── WHY A DRAWER, GIVEN THE APP HAS A TAB BAR ──
 *
 * Nine-plus pages that cannot go in a five-tab bar and should not each be a
 * tab. The web renders all of them inside a `DashboardLayout` with a sidebar,
 * so this is the same shape in the place the team already expects it. The
 * thing that makes it acceptable rather than a trap is the exit: `Home` on
 * every screen's bar AND pinned at the bottom of the menu. See
 * `DrawerContent`'s header for the full argument.
 *
 * ── HEADERS ARE OURS, NOT THE NAVIGATOR'S ──
 *
 * `headerShown: false`. React Navigation's header would be the one piece of
 * chrome in v2 that is not built from our tokens — wrong type, wrong colours,
 * wrong in dark. Each screen renders `DashboardBar` inside `Screen`'s own
 * header sheet instead, which keeps the wash and the curve.
 *
 * ⚠️ `@react-navigation/drawer` and `react-native-drawer-layout` were added
 * for this (2026-09-23). Both are JS-only — they ride on `reanimated` and
 * `gesture-handler`, which were already here — so the dev client does NOT
 * need rebuilding. If a future change pulls in something native, that stops
 * being true.
 */
import React from 'react';
import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/features/v2/dashboard/DrawerContent';
import { MAX_CONTENT_WIDTH, useV2Colors } from '@/theme/v2';

export default function DashboardLayout() {
  const c = useV2Colors();

  return (
    <Drawer
      // The drawer renders outside the screens, so it does not inherit their
      // ground — it is told the scheme's `base` explicitly or it is white in
      // dark mode.
      // Props forwarded, not dropped — `DrawerContentScrollView` needs them.
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: {
          // The drawer's own page ground — the same `base` the screens behind
          // it sit on. `Screen.tsx` is exempt for the same reason.
          // flat: page ground, not a control.
          backgroundColor: c.base,
          // Not the default 80% — a menu of short labels does not need the
          // screen, and leaving the page visible behind it says "you are
          // still in the app" better than a full-width takeover.
          width: Math.min(320, MAX_CONTENT_WIDTH),
        },
        overlayColor: c.scrim,
        swipeEdgeWidth: 0,
      }}
    />
  );
}
