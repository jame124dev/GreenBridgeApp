/**
 * The dashboard's side menu.
 *
 * ── BORROWED, NOT INVENTED ──
 *
 * Built on the standard custom-drawer pattern: a `DrawerContentScrollView`
 * wrapping `DrawerItem`s, with the active route decided by comparing
 * `usePathname()` against each item's href. That is the shape every
 * expo-router drawer example uses — https://docs.expo.dev/router/advanced/drawer/
 * and https://galaxies.dev/quickwin/expo-router-drawer-navigation — and it is
 * where this file should have started.
 *
 * The first version was a hand-rolled `ScrollView` + `Row` composition, and
 * that is how the hamburger shipped as a DEAD CONTROL: rolling the container
 * by hand meant rolling the open/close wiring by hand too, and getting it
 * wrong (`useNavigation()` instead of `useNavigation('/v2/dashboard')`). The
 * library's own pieces come with that wiring already correct.
 *
 * ⚠️ THE IMPORT PATH IS `expo-router/build/react-navigation/drawer`, NOT
 * `@react-navigation/drawer`. As of SDK 56 expo-router bans direct
 * react-navigation imports and Metro enforces it at bundle time — a direct
 * import takes the WHOLE APP down with "Failed to compile", not just this
 * screen (`withMetroMultiPlatform.js:529`). expo-router re-exports the same
 * components, which is the sanctioned way to use this pattern here.
 *
 * Reference clone: `ui_git_repo/drawer-expo-router`
 * (github.com/syednomishah/Drawer-Navigation-Expo-Router). ⚠️ That repo has
 * NO LICENCE FILE, so nothing is copied from it verbatim — it was read to
 * confirm the canonical shape, which is the same one Expo's own MIT-licensed
 * docs show. The one concrete thing it corrected here was passing `{...props}`
 * through to `DrawerContentScrollView`.
 *
 * What is ours rather than the example's: the tokens. `DrawerItem` takes
 * `activeTintColor`, `inactiveTintColor` and `labelStyle`, so the palette and
 * the type scale come from `useV2Colors()` / `type` like everywhere else.
 *
 * ── WHY A DRAWER HERE, WHEN THE APP SAYS NOT TO ──
 *
 * The app navigates by a bottom tab bar, and an app-wide drawer would be a
 * second navigation system hiding the same five destinations. This is not
 * that. It is a drawer SCOPED TO ONE SECTION, holding eight pages that have
 * no room in the tab bar — and the section keeps a permanent, visible exit
 * back to the app (`Back to Home` pinned below the list, plus a Home button
 * on every screen's bar). The rule the app cares about is "never trap the
 * user in a mode"; a scoped drawer with a pinned way out does not.
 *
 * ── UNBUILT PAGES ARE SHOWN, DISABLED ──
 *
 * Seven of the eight rows have no screen yet. They are listed anyway, marked
 * "Soon", because the question this menu answers is "what is in the
 * dashboard". They do nothing when pressed and announce themselves as not
 * built — information, rather than a control that leads nowhere.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
// ⚠️ NOT `@react-navigation/drawer` — see the header note.
import {
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from 'expo-router/build/react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hairline, SectionHeader, Text } from '@/features/v2/ui';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
import { GUTTER, space, type as typeScale, useV2Colors } from '@/theme/v2';

import { DASHBOARD_GROUPS } from './nav';

export function DrawerContent(props: DrawerContentComponentProps) {
  const c = useV2Colors();
  const pathname = usePathname();
  /**
   * ⚠️ THE DRAWER IS NOT INSIDE `Screen`, SO IT OWNS ITS OWN SAFE AREAS.
   *
   * Everywhere else in v2 the shell handles this. A drawer renders in its own
   * layer beside the navigator, so nothing pads it: the first version put
   * "Dashboard" under the status-bar clock and clipped "Back to Home" behind
   * the gesture bar. Seen on the device.
   */
  const insets = useSafeAreaInsets();

  return (
    // flat: the menu's page ground, not a control.
    <View style={[styles.root, { backgroundColor: c.base }]}>
      {/*
        `{...props}` is NOT decoration. `DrawerContentScrollView` uses the
        navigator's props for its own insets and scroll state; the first
        version of this file rendered it bare and lost both. Taken from the
        reference implementation in `ui_git_repo/drawer-expo-router`
        (`components/customDrawerContent.tsx`), which is the same shape as
        Expo's own drawer docs.
      */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + space['3xl'] }]}
      >
        <Text variant="h2" style={styles.title}>
          Dashboard
        </Text>
        <Text variant="caption" color="inkSubtle" style={styles.blurb}>
          Everything you are buying and selling.
        </Text>

        {DASHBOARD_GROUPS.map((group) => (
          <View key={group.key} style={styles.group}>
            <SectionHeader title={group.title} />
            <Hairline />
            {group.items.map((item) => {
              const active = item.href != null && pathname === String(item.href);
              return (
                <DrawerItem
                  key={item.key}
                  label={item.href ? item.label : `${item.label}  ·  ${item.note ?? 'Soon'}`}
                  focused={active}
                  activeTintColor={c.accentInk}
                  inactiveTintColor={item.href ? c.ink : c.inkDisabled}
                  activeBackgroundColor={c.accentWash}
                  labelStyle={typeScale.row}
                  style={styles.item}
                  onPress={() => {
                    if (!item.href) return;
                    router.navigate(item.href);
                  }}
                  accessibilityLabel={
                    item.href
                      ? `${item.label}${active ? ', current page' : ''}`
                      : `${item.label}, not built yet`
                  }
                />
              );
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      {/*
        The way out, pinned so it is reachable without scrolling the menu.
        This is the control that makes a scoped drawer acceptable.
      */}
      <View
        style={[
          styles.exit,
          { borderTopColor: c.hairline, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <DrawerItem
          label="Back to Home"
          inactiveTintColor={c.accentInk}
          labelStyle={typeScale.row}
          style={styles.item}
          onPress={() => router.navigate(homeRoute())}
          accessibilityLabel="Back to Home"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: space['6xl'] },
  title: { paddingHorizontal: GUTTER },
  blurb: { paddingHorizontal: GUTTER, marginTop: space.sm },
  group: { marginTop: space['6xl'] },
  /** `DrawerItem` brings its own margins; pull it back toward the gutter. */
  item: { marginHorizontal: space.md, borderRadius: space.md },
  exit: { borderTopWidth: 1, paddingTop: space.md },
});
