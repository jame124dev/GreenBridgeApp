/**
 * 6c — Browse. The v2 chrome around the marketplace that already works.
 *
 * ⚠️ THIS IS DELIBERATELY NOT THE DRAWING, AND THAT IS THE HONEST OPTION.
 *
 * `docs/v2-design/screens/6c.html` draws a fully native list: a search field
 * ("Equipment, brand, lot #"), four filter chips (Closing soon / Newest /
 * Price / Live) and lot cards carrying lot number, country, time remaining,
 * bid count and a Bid / Make offer action.
 *
 * The app cannot render that today. **There is no marketplace browse endpoint
 * wired in the app** — checked: `useBatchProducts` is the seller's
 * multi-product review, and nothing in `src/api` lists public lots. Browsing
 * has always been a WebView onto 101lab.co for exactly this reason. A native
 * list needs a public listings endpoint with search, sort and live bid state,
 * which is the separate native-browse project.
 *
 * So this screen frames the WORKING marketplace in v2 chrome rather than
 * leaving the Browse tab as a dead destination — a visible tab that goes
 * nowhere is its own App Review problem (Guideline 2.1).
 *
 * ── Why the drawn search and filter chips are NOT built ──
 *
 * They would be inert. The list underneath is a web page with its own search
 * and its own sort; native controls above it could not drive them without the
 * same DOM coupling the guest guard already needs, and a control that looks
 * real and does nothing is worse than no control. So the web view keeps its
 * own header (`hideSiteHeader` off) — that is where the WORKING search lives.
 *
 * NEXT IMPROVEMENT, if this screen is worth more time: the `path` prop takes a
 * query string, so a native v2 search field could drive the real list by
 * loading `/buyer-marketplace?<param>=<query>`. That would let the site header
 * be hidden (killing the navy chrome) without losing search. It needs the
 * marketplace's actual query-param name confirmed first — do not guess it.
 *
 * Replace this whole file with the drawn list once the browse endpoint exists.
 * Nothing else depends on it.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandBar, Screen } from '@/features/v2/ui';
import { MarketplaceWebView } from '@/features/lab/marketplace/MarketplaceWebView';
import { useLabNotifications } from '@/features/lab/notifications/useLabNotifications';
import { requireAuth } from '@/features/auth/requireAuth';
import { haptics } from '@/lib/haptics';
import { router } from 'expo-router';
import { routes } from '@/lib/routes';

export default function V2Browse() {
  const { unreadCount } = useLabNotifications();

  const onBell = () => {
    haptics.tap();
    requireAuth('notifications', () => router.push(routes.labNotifications));
  };

  const header = (
    <>
      {/*
        Brand bar ONLY — no display line, no subline.
        
        The web page below brings its own title ("Available Batches"), its own
        result count and its own search. Adding a v2 "Browse lots" heading on
        top gave the screen two titles and two search-shaped things, and ~470pt
        of chrome before a single lot. One header beats a prettier one.
      */}
      <BrandBar unread={unreadCount} onNotifications={onBell} />
    </>
  );

  return (
    <Screen
      header={header}
      // Flush: no curve, no bottom padding. With only a brand bar in it, the
      // normal header sheet is a ~290pt block of empty green above the page.
      // Flush makes it a thin strip that butts straight onto the web content.
      headerFlush
      scroll={false}
      testID="v2-browse"
    >
      <View style={styles.fill}>
        <MarketplaceWebView
          path="/buyer-marketplace"
          // Browse is the persistent tab, so it owns the auth-clear callback.
          registerAuthClear
          // NOT `hideSiteHeader`. It was tried: it removes the navy 101LAB
          // logo bar, which is what the t6 brief wants — but the page's SEARCH
          // FIELD lives in that same header, and Browse without search over
          // 2,995 open lots is a worse screen than Browse with one extra logo.
          // Revisit if the search can be driven natively (see the note above).
          // v2's `Screen` puts the tab bar BELOW the content as a flex sibling,
          // so this box already ends above the gesture bar. Reserving the inset
          // again would leave a dead strip under the page.
          reserveBottomInset={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
