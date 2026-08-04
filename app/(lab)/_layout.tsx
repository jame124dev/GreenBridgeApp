// (lab) customer-app route group (NewVersion/00-foundation.md, 08-bottom-nav.md).
//
// Navigation architecture:
//   - A Stack hosts the whole fork.
//   - The `(tabs)` child group renders the persistent FrostedTabBar and holds
//     the SHOW-nav screens: home, browse, matches, deals, account, plus
//     published (href:null → bar shows, no tab button).
//   - The FLOW screens that HIDE the bar (processing, draft, match, deal) live
//     here at the stack level, OUTSIDE `(tabs)`, so the bar is structurally
//     absent when they're pushed. This is the show/hide mechanism from spec 08
//     §4.2 — no per-screen bar toggling.
import { Fragment } from 'react';
import { Stack } from 'expo-router';

import { MarketplacePrewarm } from '@/features/lab/marketplace/MarketplacePrewarm';
import { UpdateReadyBanner } from '@/features/lab/updates';

export default function LabLayout() {
  return (
    <Fragment>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Tab-bearing shell — renders the FrostedTabBar */}
        <Stack.Screen name="(tabs)" />
        {/* Flow screens — pushed, no tab bar */}
        <Stack.Screen name="processing" />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom', animationDuration: 300 }} />
        <Stack.Screen name="draft" />
        {/* All matches for one want — pushed from a WantCard's "View all N" */}
        <Stack.Screen name="want/[id]" />
        {/* match presents bottom-up (modal) per the transition matrix */}
        <Stack.Screen name="match/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="deal/[id]" />
        {/* Product detail — buyer-marketplace listing in a WebView, pushed from a
            chat product card (or any product surface). */}
        <Stack.Screen name="product/[id]" />
        {/* Account deletion, pushed from Account ▸ Security. No tab bar: it is a
            focused confirm flow with a single primary action. */}
        <Stack.Screen name="account/delete" />
      </Stack>
      {/* Off-screen warmer — primes the marketplace WebView engine + HTTP cache so
          Browse / product-detail open faster. Renders null unless it should warm. */}
      <MarketplacePrewarm />
      {/* Floats above every (lab) screen when a downloaded OTA update is waiting.
          Renders null the rest of the time. Mounted here rather than per-screen so
          a pending update is never invisible on whichever screen the user is on. */}
      <UpdateReadyBanner />
    </Fragment>
  );
}
