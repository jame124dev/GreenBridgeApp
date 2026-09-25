/**
 * `TabBar` — the bottom bar, on all six tab screens.
 *
 * ⚠️ NOT DRAWN FROM THE CANVAS FILE. `GreenBidz Mobile.dc.html` imports this
 * rather than drawing it (`<dc-import name="TabBar" …>`), and `TabBar.dc.html`
 * needs a Claude Design re-auth to fetch. What the canvas DOES pin down and
 * what is honoured here:
 *
 *   • `hint-size="100%,78px"`         → `control.tabBar` (78), excluding the
 *                                       gesture bar, which is added on top
 *   • `active="home|browse|matches|chat|account"` → five tabs, in that order
 *   • `theme="light" tone="soft"`     → no filled pill behind the active tab;
 *                                       the accent colour alone carries it
 *
 * Everything else — the icons, the label size, the hairline — is the kit's own
 * language. Replace this wholesale when the drawing is available; nothing else
 * depends on its internals.
 *
 * ── The bug this must not repeat ──
 *
 * The shipped app has a live defect where the Home tab stays highlighted on
 * every tab for signed-in users. That happens when the active tab is held in
 * state instead of derived. Here it is derived from `usePathname()` on every
 * render, so it cannot drift out of step with the route.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import {
  Home,
  MessageCircle,
  Search,
  Target,
  User,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HAIRLINE_WIDTH,
  MIN_TOUCH,
  control,
  icon as iconScale,
  radius,
  space,
  usePressFeedback,
  useV2Colors,
} from '@/theme/v2';
import { useKeyboardInset } from '@/features/lab/chat/hooks/useKeyboardInset';
import { haptics } from '@/lib/haptics';

import { Text } from './Text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabKey = 'home' | 'browse' | 'matches' | 'messages' | 'account';

type Tab = {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
  href: string;
  /** Routes that should light this tab. `href` is included implicitly. */
  also?: readonly string[];
};

const TABS: readonly Tab[] = [
  // Selling and buying are two routes rendering one screen, so both light Home.
  { key: 'home', label: 'Home', Icon: Home, href: '/v2', also: ['/v2/buying'] },
  /*
   * `Search`, deliberately kept. Two reviewers called the magnifier a mismatch,
   * but 6c Browse IS a search surface — the web page it frames leads with a
   * search field over ~3,000 open lots, and that field is the reason the site
   * header is not hidden. The glyph matches what the screen actually does.
   */
  { key: 'browse', label: 'Browse', Icon: Search, href: '/v2/browse' },
  /*
   * `Target`. ⚠️ THIS DEPARTS FROM THE DRAWING, DELIBERATELY AND ON REQUEST.
   *
   * `TabBar.dc.html` maps matches to `sparkles-outline`, and this was set to
   * `Sparkles` to match it. On the device that is wrong, and the user called it
   * immediately: **Home already uses `Sparkles` for "Ask the assistant"**, in a
   * filled accent circle, on the same screen as the tab bar. So sparkles means
   * AI in this app, and the Matches tab was reading as a second AI entry point.
   *
   * The drawing could not have known that — the assistant row's glyph is a
   * choice made in `SellingPane`, not in the canvas. Where the canvas and the
   * app's own established vocabulary disagree, the vocabulary wins: an icon's
   * job is to mean one thing.
   *
   * History, so this does not cycle: `Bookmark` (two reviews read it as
   * "Saved") → `Target` → `Sparkles` (the drawing) → `Target` (this).
   */
  { key: 'matches', label: 'Matches', Icon: Target, href: '/v2/matches' },
  /*
   * The fourth slot is MESSAGES, not the assistant.
   *
   * The canvas is explicit: `6e.html` — the buyer↔seller inbox — is drawn on
   * `<dc-import name="TabBar" active="chat">`, so that slot belongs to the
   * inbox. The assistant is reached from Home's "Ask the assistant" row, which
   * both 6a and 6b draw. Naming it "Assistant" here pointed the tab at
   * `/v2/chat` and left the inbox with no way in at all.
   */
  // `MessageCircle`, not `Mail`: an envelope means email. This is a live
  // buyer↔seller conversation inbox, so it gets the conversation glyph.
  { key: 'messages', label: 'Messages', Icon: MessageCircle, href: '/v2/messages' },
  { key: 'account', label: 'Account', Icon: User, href: '/v2/account' },
];

/** Which tab a path belongs to, or `null` for a screen outside the tabs. */
function activeTabFor(pathname: string): TabKey | null {
  // Longest match first, so `/v2/matches` beats `/v2`.
  const ranked = [...TABS].sort((a, b) => b.href.length - a.href.length);
  for (const t of ranked) {
    if (pathname === t.href || t.also?.includes(pathname)) return t.key;
    if (t.href !== '/v2' && pathname.startsWith(`${t.href}/`)) return t.key;
  }
  return null;
}

type TabBarProps = {
  /**
   * Controlled mode, for the single shared bar `RootTabsPager` renders below
   * its swiping panes. When set, the active tab and every tap are driven by
   * the pager's index instead of `usePathname()`/`router.navigate` — the
   * panes are five mounted scenes of ONE route (`/v2`), so the pathname never
   * changes between them and cannot tell them apart.
   */
  index?: number;
  onChangeIndex?: (next: number) => void;
};

export function TabBar({ index, onChangeIndex }: TabBarProps = {}) {
  const c = useV2Colors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const controlled = index != null && onChangeIndex != null;
  const active = controlled ? TABS[index]?.key : activeTabFor(pathname);

  // 78pt of BAR, then the gesture bar underneath it — so the height is the sum,
  // not 78 with padding stuffed inside it.
  //
  // Setting `height: 78` and adding `paddingBottom: insets.bottom` separately
  // does NOT do this: the fixed height wins and the padding pushes the labels
  // down THROUGH the bar, straight under the Android navigation buttons. Caught
  // on a device; the layout looked correct in every other respect.
  const barHeight = control.tabBar + insets.bottom;

  /**
   * ── The bar gets out of the keyboard's way ──
   *
   * This is React Navigation's `tabBarHideOnKeyboard` (older name
   * `keyboardHidesTabBar`), which defaults to TRUE — we cannot use the option
   * itself because `app/v2/_layout.tsx` is a `Stack` and this bar is a plain
   * component `Screen` renders, so the behaviour is reproduced here.
   *
   * It is not cosmetic. `KeyboardProvider` (mounted in `app/_layout.tsx`)
   * disables Android's `adjustResize`, so with the IME open the window stays
   * full height — measured on RMX2151: `mFrame=[0,0][1080,2400]`. This bar is a
   * flex SIBLING below the content, so it went on reserving `barHeight` at the
   * bottom of that window, behind the keyboard. Every screen that lifts its own
   * footer by the keyboard height then overshot by exactly `barHeight`: on
   * `/v2/chat` the composer floated 122dp above the keyboard and the thread
   * above it was squeezed to a sliver — the starter prompts had no room to draw
   * at all.
   *
   * Collapsing the bar returns those 122dp to the content, and the consumer's
   * `paddingBottom: keyboardInset` becomes correct again with no change on its
   * side. `useKeyboardInset` is the repo's existing 3-channel reconciled value,
   * so a missed native callback cannot strand the bar collapsed.
   *
   * The ramp is `barHeight`, not the keyboard height: the bar must be GONE by
   * the time the rising keyboard reaches it, and tying it to the full travel
   * would still be half-open when covered.
   */
  const kb = useKeyboardInset();
  const collapse = useAnimatedStyle(() => {
    const t = Math.min(kb.value / Math.max(barHeight, 1), 1);
    return {
      height: barHeight * (1 - t),
      paddingBottom: insets.bottom * (1 - t),
      opacity: 1 - t,
    };
  }, [barHeight, insets.bottom]);

  return (
    <Animated.View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: c.base,
          borderTopColor: c.hairline,
        },
        collapse,
      ]}
    >
      {TABS.map((tab, i) => (
        <TabButton
          key={tab.key}
          tab={tab}
          on={tab.key === active}
          onPress={controlled ? () => onChangeIndex!(i) : undefined}
        />
      ))}
    </Animated.View>
  );
}

/**
 * One tab. A component rather than inline JSX because `usePressFeedback` is a
 * hook and cannot be called inside `.map`.
 *
 * ── Why this exists at all (Docs/UIUXRuleSet/responsiveness.md) ──
 *
 * This was a bare `Pressable` with no feedback of any kind, and the active tint
 * is derived from `usePathname()` — correct, and the reason the active tab
 * cannot drift out of step with the route, but it means the tint cannot move
 * until navigation COMPLETES. Between finger-down and screen-change the bottom
 * nav therefore emitted nothing at all, on the most-tapped control in the app.
 *
 * Reported as "it takes time, so users click twice" — which is literally what
 * happens: past the OS double-tap window (250ms on iOS) the retry is a second
 * press, not a double tap. R1 wants an answer inside 100ms; R3 says it must fire
 * on `onPressIn` and must not wait for the work. Both now do.
 */
function TabButton({
  tab,
  on,
  onPress,
}: {
  tab: Tab;
  on: boolean;
  /** Set by the controlled (pager) mode; moves the pager's index instead of
   *  navigating a route. */
  onPress?: () => void;
}) {
  const c = useV2Colors();
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ scale: false });
  const { label, Icon, href } = tab;

  return (
    <AnimatedPressable
      onPress={() => {
        if (on) return;
        // Selection feel, per responsiveness.md R5 — and BEFORE the navigate,
        // because tactile feedback degrades from 70ms, tighter than visual.
        haptics.tap();
        if (onPress) {
          onPress();
          return;
        }
        // `navigate`, not `push` — tabs replace each other rather than
        // stacking, so Back leaves the app instead of walking the
        // history of every tab you touched.
        router.navigate(href as never);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.tab, animatedStyle]}
    >
      {/*
        The active marker: a 54 × 28 pill BEHIND THE ICON — `accentWash` when
        selected, transparent otherwise.

        ⚠️ THIS IS THE DRAWING, and it corrects two wrong beliefs this file
        carried. `TabBar.dc.html` DOES exist — it sits beside the screen files in
        the canvas folder, not behind a re-auth — and it renders exactly this:

            width:54px; height:28px; border-radius:999px; background:{{ t.bg }}
            t.bg = on ? (soft ? "#DFF0E7" : "#DDEDE4") : "transparent"

        So the header note claiming `tone="soft"` means "no filled pill behind
        the active tab; the accent colour alone carries it" was wrong: soft still
        has a pill, just a paler one. `#DFF0E7` is our `accentWash` to the byte,
        and that token's stated role is "selected chips" — which is what this is.

        It replaced a 2pt top-edge bar invented while the drawing was believed
        lost. That bar was a reasonable guess. It was still a guess.
      */}
      <View style={[styles.pill, { backgroundColor: on ? c.accentWash : 'transparent' }]}>
        <Icon
          size={iconScale.xl}
          /*
            `accentInk`, NOT `accent`. In dark, `accent` measures 3.74:1 on
            `base` while the INACTIVE `inkSubtle` measures 5.65:1 — so the
            selected icon was the dimmest thing in the bar and the active state
            read as the disabled one.

            ⚠️ INACTIVE IS `inkMuted`, NOT `inkSubtle`. `inkSubtle` #8B9A92 on
            white measures 2.94:1 — under AA 4.5 for the label and under
            1.4.11's 3:1 for the icon, on the app's primary navigation.
            `inkMuted` #5A6B62 is 5.65:1 light / 8.98:1 dark and clears both.
            (Dark was already fine; only light failed.)

            The drawing independently agrees: its soft tone is
            `on ? "#22624A" : "#5A6B62"` — `accentInk` and `inkMuted` exactly.
            This one was changed for the contrast measurement before the drawing
            was found, and the drawing confirmed it.

            The pill matters for the same reason: accentInk vs inkMuted is only
            1.27:1 light / 1.08:1 dark, so selection cannot rest on the ink
            colour alone. The ground behind the icon is what carries it.
          */
          color={on ? c.accentInk : c.inkMuted}
          strokeWidth={on ? 2 : 1.75}
        />
      </View>
      <Text variant="small" color={on ? 'accentInk' : 'inkMuted'}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: HAIRLINE_WIDTH,
    alignItems: 'flex-start',
    paddingTop: space.xl,
    // The tabs keep their intrinsic height while the BAR animates to zero, so
    // without this they spill out of it and draw over the composer on the way
    // down.
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
  },
  /**
   * The active pill, straight off `TabBar.dc.html`:
   * `width:54px; height:28px; border-radius:999px`.
   * 54 × 28 are the drawing's own numbers, not scale steps — a drawn shape, so
   * they are written as themselves rather than bent onto the nearest token.
   */
  pill: {
    width: 54,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
