/**
 * `HomePager` — two panes, swipe or tap to move between them.
 *
 * Selling and Buying are two views of ONE screen, so they get the top-tab
 * gesture people already know from WhatsApp and X. The tab row above is the
 * same control; tapping it animates the same way.
 *
 * ── This wraps `reanimated-tab-view`, and that is the point ──
 *
 * The first version of this file was hand-rolled: a `Gesture.Pan` driving a
 * `translateX`, snapping with a spring seeded from the release velocity. The
 * decision logic was right — flick, drag and edge cases all behaved — but
 * measured on a real device it still dropped frames:
 *
 *     321 frames · 14 janky (4.36%) · 99th percentile 53ms · 7 missed vsync
 *
 * A 53ms worst frame is three dropped in a row: the hitch you feel and cannot
 * see in a screenshot. Rather than keep tuning physics by guesswork, this
 * delegates to a library that exists to solve exactly this.
 *
 * `reanimated-tab-view` was chosen over `react-native-tab-view` because the
 * latter depends on `react-native-pager-view` — a NATIVE module, so adopting
 * it would force a full Gradle rebuild. This one is pure Reanimated 4 +
 * worklets + gesture-handler, all three already installed, and the app already
 * has the New Architecture that Reanimated 4 requires. No rebuild.
 *
 * ── What Home keeps ──
 *
 * Its own tab bar is suppressed (`renderTabBar: () => null`). Home's tabs live
 * in the FIXED header above this, because the brand bar beside them must not
 * slide — an identical logo sliding out while its twin slides in is the tell of
 * a pager pretending to be tabs. So this renders scenes only.
 *
 * `renderMode="all"` keeps both panes mounted. They are memoised and hold live
 * queries; remounting one per swipe would stall the JS thread at exactly the
 * moment the finger lifts.
 */
import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  TabView,
  type NavigationState,
  type SceneRendererProps,
  type TabViewMethods,
} from 'reanimated-tab-view';

const ROUTES = [
  { key: 'selling', accessibilityLabel: 'Selling' },
  { key: 'buying', accessibilityLabel: 'Buying' },
];

/**
 * ⚠️ EVERY TAPPABLE THING INSIDE THESE PANES MUST USE GESTURE HANDLER'S
 * `Pressable`, NOT REACT NATIVE'S.
 *
 * `TabView` wraps the panes in a `GestureDetector` carrying a `Gesture.Pan`.
 * RN's own `Pressable` goes through the JS responder system, which RNGH
 * intercepts at the native view level — so inside this pager a react-native
 * Pressable NEVER RECEIVES THE TAP. It renders, it looks perfect, its press
 * feedback never fires and its `onPress` never runs.
 *
 * That is not theoretical: it made `Scan it` — the app's primary action — and
 * the whole assistant row inert from the moment this pager replaced the
 * hand-rolled one, and it survived a dozen device screenshots because a
 * screenshot cannot see a dead button. Proven by bypassing `TabView`: with the
 * panes rendered plainly the same button opened the sign-in sheet at once.
 *
 * The pan needs 10px of movement to activate (`activeOffsetX([-10, 10])`), so
 * the swipe and a tap do not actually compete — RNGH simply will not hand a
 * touch to a foreign responder inside its own detector. The whole v2 kit now
 * imports `Pressable` from `react-native-gesture-handler`, which lets RNGH
 * arbitrate: a tap wins, a 10px drag becomes a swipe.
 */
export function HomePager({
  page,
  onPageChange,
  children,
}: {
  /** Index of the visible pane. Controlled — the tab row owns it too. */
  page: number;
  onPageChange: (next: number) => void;
  /** One node per pane, in `ROUTES` order. */
  children: ReactNode[];
}) {
  const navigationState = useMemo<NavigationState>(
    () => ({ index: page, routes: ROUTES }),
    [page],
  );

  const renderScene = ({ route }: SceneRendererProps) =>
    children[ROUTES.findIndex((r) => r.key === route.key)] ?? null;

  /**
   * The carousel positions itself from its measured width, and on the FIRST
   * render that width is 0 — so a mount-time `jumpTo` lands on a pager that
   * does not yet know how far one page is, and silently does nothing. Handing
   * it the window width up front means it is laid out on render one, which is
   * what `initialLayout` exists for.
   */
  const { width, height } = useWindowDimensions();

  /**
   * ⚠️ `TabView` is IMPERATIVE, not controlled. It seeds its own
   * `currentRouteIndex` from `navigationState.index` once and then owns it —
   * later changes to that prop are ignored. Passing `page` down therefore
   * moves the tab row's indicator (the header renders from `page`) while the
   * pane underneath stays put: tapping `Buying` looked half-alive, which is
   * worse than dead, and a screenshot of it shows a correctly selected tab.
   *
   * So the tab row drives the pager through `jumpTo`, and `lastReported`
   * records the index the pager itself last announced. Without that guard the
   * effect would fire on a SWIPE too — the swipe raises `onIndexChange`, the
   * parent re-renders with the new `page`, and we would `jumpTo` the route the
   * finger has already arrived at, re-running the animation under it.
   */
  const pager = useRef<TabViewMethods>(null);
  /**
   * Seeded to 0, NOT to `page` — `TabView` starts its carousel on the first
   * route whatever `navigationState.index` says, so 0 is where the pager
   * actually is on mount, and seeding this to `page` would make the mount case
   * look already-satisfied.
   *
   * That mattered: `/v2/buying` redirects to `/v2?mode=buying`, so Home mounts
   * with `page` already 1. The tab row renders from `page` and showed Buying
   * active while the carousel sat on Selling — the same split as the tab-press
   * bug, reached by deep link instead of by tapping. Starting at 0 lets the
   * effect below fire on mount and move the pane to meet the tab.
   */
  const lastReported = useRef(0);

  useEffect(() => {
    if (page === lastReported.current) return;
    lastReported.current = page;
    pager.current?.jumpTo(ROUTES[page].key);
  }, [page]);

  const handleIndexChange = useCallback(
    (next: number) => {
      lastReported.current = next;
      onPageChange(next);
    },
    [onPageChange],
  );

  return (
    <TabView
      ref={pager}
      navigationState={navigationState}
      onIndexChange={handleIndexChange}
      renderScene={renderScene}
      // Home draws its own tabs, fixed, in the header sheet above this.
      tabBarConfig={{ renderTabBar: () => null }}
      renderMode="all"
      style={styles.fill}
      sceneContainerStyle={styles.fill}
      /**
       * ⚠️ `tabBar: { height: 0 }` IS LOad-BEARING — it removes 50dp of blank.
       *
       * `TabView` seeds `tabBarLayout` with `height: TAB_BAR_HEIGHT` (50), a
       * non-zero DEFAULT, and corrects it from `onLayout` once the bar renders
       * (`reanimated-tab-view/src/components/TabView.tsx:177`, constant in
       * `src/constants/tabBar.ts:1`). We suppress the bar with
       * `renderTabBar: () => null`, so nothing ever lays out — and the default
       * is never corrected. `RTVScrollView` then reserves it as real padding:
       *
       *   paddingTop: tabBarLayout.height + tabViewHeaderLayout.height
       *   — src/components/Scrollable/RTVScrollView.tsx:66
       *
       * So every pane carried 50dp of blank at the top of its scroll, for a tab
       * bar that does not exist. Measured on device 2026-09-17: 112dp between
       * the hero sheet and the first row where the tokens intend ~46.
       *
       * `initialLayout.tabBar` is spread over the default in that same
       * `useState`, so this is the library's own supported override, not a
       * patch. If the bar is ever un-suppressed, delete this line with it.
       */
      /**
       * ⚠️ `tabView.height` IS ALSO LOAD-BEARING, for the same reason
       * `tabBar.height: 0` above is.
       *
       * `tabView` seeds a `{ width: 0, height: 0 }` default (`TabView.tsx:171`)
       * and corrects both from the outer container's own `onLayout` — but only
       * `width` was fed here, so `height` started at 0 and
       * `tabViewCarouselLayout.height` (`= tabViewLayout.height -
       * tabBarLayout.height`) inherited that 0 into `RTVScrollView`'s content
       * container `minHeight` (`RTVScrollView.tsx:66`). Measured on device
       * 2026-09-24: "Ask the assistant" and the guest promo banner — the rows
       * directly below the hero — painted as a blank void; `uiautomator`
       * reported their bounds with `y2 < y1`, an inverted rect, matching a
       * collapsed/negative height rather than a normal one just being short.
       *
       * Full window height is a deliberate OVER-estimate, not the true
       * available height under the fixed brand-bar-and-tabs header above this
       * pager — that header's own height is not known synchronously here. A
       * `minHeight` a little TALLER than needed only adds harmless extra
       * scroll room on a short pane; one that is too SHORT is what collapsed
       * these rows. Never go back to omitting it on the theory that `onLayout`
       * "should" self-correct — it is exactly what was already relied on and
       * did not happen on this screen.
       */
      initialLayout={{ tabView: { width, height }, tabBar: { height: 0 } }}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
