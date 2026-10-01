/**
 * `RootTabsPager` — the five root tabs as ONE swiping pager, WhatsApp/
 * Instagram-style, instead of five independent stack screens joined only by
 * the bottom bar.
 *
 * Owner: "from the middle when swipe left goes in right menu... our app
 * didn't support that... use best team make this done like standard app have
 * common gesture" (2026-09-25).
 *
 * ── Why `reanimated-tab-view` again ──
 *
 * The exact library `HomePager` already uses for Home's Selling/Buying pair —
 * see that file's header for why (`react-native-tab-view` pulls in the
 * NATIVE `react-native-pager-view`, forcing a Gradle rebuild; this one is pure
 * Reanimated 4 + worklets + gesture-handler, already installed, no rebuild).
 * This is the same pattern one level up: Home's OWN two-pane pager is now
 * nested inside a five-pane one.
 *
 * ── `renderMode="lazy"`, not `"all"` ──
 *
 * `HomePager` uses `"all"` because it only ever holds two panes, both cheap
 * to keep mounted. Five full screens — three of them firing live queries
 * (Matches' per-want match queries, Messages' socket-backed inbox, Account's
 * profile/listings/drafts/notification-prefs queries) plus Browse's WebView —
 * is a different cost: mounting all five on the FIRST frame means every one
 * of those queries and that WebView load fires before a person has asked for
 * anything but Home. `"lazy"` mounts only Home up front and adds each other
 * pane to `TabView`'s own `lazyLoadedRouteIndices` the first time it is
 * swiped or tapped to — and once mounted, it STAYS mounted (mount-once,
 * keep-alive, never remounted), so a query fetched once is not re-fetched on
 * every visit and the WebView is not reloaded on every visit either.
 *
 * ── Browse's WebView: the risk landed, and how it is handled ──
 *
 * Every other pane is a native ScrollView/RTVFlatList, which `TabView`'s
 * outer pan gesture already knows how to negotiate with (10px activation
 * offset — a tap or a vertical drag is never stolen). A WebView owns its OWN
 * native gesture recognizer, underneath RNGH's, and the two had never been
 * combined in this app before. That was flagged here as the one pane needing
 * a real on-device gesture test before this was called done.
 *
 * It was not tested, and it was broken: reported 2026-10-01 — scrolling the
 * marketplace flung the user sideways into the next tab. The fix is
 * `swipeEnabled` turned OFF for this pane only; see the prop below for why
 * tuning the activation offset cannot work. Browse is now left by tapping a
 * tab, which is the trade this pane pays for keeping its own gestures.
 *
 * ── Each pane keeps its OWN header/scroll/chrome ──
 *
 * Unlike `HomePager`'s two panes (bare content under ONE shared `Screen`),
 * Browse/Matches/Messages/Account each have their own distinct header (a
 * flush brand bar, a display title, a centred identity sheet) — there is no
 * one header to hoist out the way Home's is. So every pane still renders its
 * OWN `Screen`, with `hideOwnTabBar` added so only ONE shared `TabBar` renders
 * (below the pager, fixed, not swiping with the content) instead of five.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  TabView,
  type NavigationState,
  type SceneRendererProps,
  type TabViewMethods,
} from 'reanimated-tab-view';

import { TabBar } from '@/features/v2/ui';
import { HomeScreen } from '@/features/v2/home/HomeScreen';
import { BrowseScreen } from '../../../../app/v2/browse';
import { MatchesScreen } from '../../../../app/v2/matches';
import { MessagesScreen } from '../../../../app/v2/messages';
import { AccountScreen } from '../../../../app/v2/account';

const ROUTES = [
  { key: 'home', accessibilityLabel: 'Home' },
  { key: 'browse', accessibilityLabel: 'Browse' },
  { key: 'matches', accessibilityLabel: 'Matches' },
  { key: 'messages', accessibilityLabel: 'Messages' },
  { key: 'account', accessibilityLabel: 'Account' },
] as const;

type TabKey = (typeof ROUTES)[number]['key'];

function indexOfTab(tab: string | undefined): number {
  const i = ROUTES.findIndex((r) => r.key === tab);
  return i === -1 ? 0 : i;
}

/**
 * One element per pane, built once — same reasoning as `HomeScreen`'s hoisted
 * `PANES`: an inline array literal recreated on every render would defeat
 * `TabView`'s own memoisation of each scene.
 */
const PANES: Record<TabKey, React.ReactNode> = {
  home: <HomeScreen key="home" />,
  browse: <BrowseScreen key="browse" />,
  matches: <MatchesScreen key="matches" />,
  messages: <MessagesScreen key="messages" />,
  account: <AccountScreen key="account" />,
};

export function RootTabsPager() {
  // `/v2/browse` etc. redirect to `/v2?tab=browse` — see each route file's
  // `V2*Redirect` default export.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialIndex = useRef(indexOfTab(tab)).current;

  const [index, setIndex] = useState(initialIndex);
  const navigationState = useMemo<NavigationState>(
    () => ({ index, routes: ROUTES as unknown as NavigationState['routes'] }),
    [index],
  );

  const renderScene = ({ route }: SceneRendererProps) => PANES[route.key as TabKey] ?? null;

  // Seeds the carousel's own measured width/height — see `HomePager`'s
  // identical note on `initialLayout`.
  const { width, height } = useWindowDimensions();

  const pager = useRef<TabViewMethods>(null);
  const lastReported = useRef(0);

  /**
   * A deep link landing on `?tab=matches` renders the shared `TabBar` on
   * "Matches" immediately (from `initialIndex`) while `TabView`'s own carousel
   * always starts its very first frame on route 0 regardless of
   * `navigationState.index` — identical to the seed-then-`jumpTo` pattern
   * `HomePager` already uses for `/v2/buying`. Runs once, on mount, from the
   * URL param captured at that instant; a later change to `tab` is not
   * something this effect chases.
   */
  useEffect(() => {
    if (initialIndex === 0) return;
    pager.current?.jumpTo(ROUTES[initialIndex].key);
    lastReported.current = initialIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIndexChange = useCallback((next: number) => {
    lastReported.current = next;
    setIndex(next);
  }, []);

  /** The shared bar's own tap — moves the pager the same way a swipe would. */
  const onTabBarPress = useCallback((next: number) => {
    if (next === lastReported.current) return;
    lastReported.current = next;
    setIndex(next);
    pager.current?.jumpTo(ROUTES[next].key);
  }, []);

  return (
    <View style={styles.fill}>
      <TabView
        ref={pager}
        navigationState={navigationState}
        onIndexChange={handleIndexChange}
        renderScene={renderScene}
        // The kit's own bar renders once, below, not per-scene.
        tabBarConfig={{ renderTabBar: () => null }}
        renderMode="lazy"
        /*
          ⚠️ THE PAGER STOPS SWIPING WHILE BROWSE IS THE OPEN PANE.

          This is the risk the header above flagged as unverified, now
          confirmed on device (2026-10-01): a WebView owns a NATIVE scroll
          recognizer that sits underneath RNGH, so it never negotiates with
          the carousel's pan the way the other four panes' RTVFlatLists do.
          Dragging the marketplace page — including an ordinary vertical
          scroll that starts a few degrees off-axis — was being claimed by the
          carousel and flinging the user into the next tab mid-scroll.

          Raising `activationOffsetX` would not fix it: the conflict is not
          that the pan activates too eagerly, it is that the WebView's own
          recognizer cannot tell RNGH it has already taken the gesture.

          So on this one pane the carousel yields the horizontal axis
          entirely, and the marketplace keeps every gesture it needs — its own
          horizontal carousels, pinch-zoom and scroll. The cost is that Browse
          is left by TAPPING a tab rather than swiping; the shared `TabBar`
          below is always visible and is the obvious way out, and a tab bar is
          how most apps leave an embedded web page anyway.
        */
        swipeEnabled={ROUTES[index].key !== 'browse'}
        style={styles.fill}
        sceneContainerStyle={styles.fill}
        // `tabBar.height: 0` and `tabView.height` — both load-bearing for the
        // exact reasons documented in `HomePager`'s identical props: without
        // them the suppressed tab bar's stale 50dp default and an uncorrected
        // 0 carousel height both leak into every pane's own scroll padding.
        initialLayout={{ tabView: { width, height }, tabBar: { height: 0 } }}
      />
      <TabBar index={index} onChangeIndex={onTabBarPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
