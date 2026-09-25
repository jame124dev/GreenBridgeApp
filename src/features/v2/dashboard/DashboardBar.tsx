/**
 * The bar at the top of every dashboard screen: menu, title, way out.
 *
 * It replaces `BrandBar` inside this section. `BrandBar` carries the wordmark,
 * the language pill and the bell — the chrome of the app's own tab screens.
 * In here the two things that matter are *which page am I on* and *how do I
 * leave*, and the drawer is the app's identity for as long as you are in it.
 *
 * `GlyphButton` takes no `testID` — it is targeted by its
 * `accessibilityLabel`, which it requires precisely because an icon-only
 * control has no visible text to fall back on.
 *
 * ⚠️ THE EXIT IS NOT OPTIONAL AND IT IS NOT ONLY IN THE DRAWER. A section
 * with its own navigation has to be leavable from the surface, not from
 * inside a menu the person has to know about. `Home` sits at the trailing
 * edge of every dashboard screen for that reason. The drawer's pinned "Back
 * to Home" is the second copy, for someone who already has it open — the two
 * are the same action in two contexts, not a duplicated control.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
// ⚠️ NOT `@react-navigation/drawer` — expo-router 56 bans that import and
// Metro fails the WHOLE bundle on it. This is the sanctioned re-export.
import { DrawerToggleButton } from 'expo-router/build/react-navigation/drawer';
import { Home } from 'lucide-react-native';

import { GlyphButton, Text } from '@/features/v2/ui';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
import { icon, space, useV2Colors } from '@/theme/v2';

export function DashboardBar({ title }: { title: string }) {
  const c = useV2Colors();
  return (
    <View style={styles.row}>
      {/*
        The library's own toggle, not a hand-wired button.
        My first version was a `GlyphButton` calling
        `useNavigation().openDrawer?.()` — and `useNavigation()` without the
        layout route returns the CURRENT screen's navigation, which has no
        `openDrawer`. The optional call swallowed it, so the hamburger was a
        dead control that typechecked, passed every test and did nothing when
        pressed. `DrawerToggleButton` is already wired to its own navigator.
      */}
      <DrawerToggleButton tintColor={c.ink} />

      <Text variant="h3" style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <GlyphButton
        accessibilityLabel="Back to Home"
        onPress={() => router.navigate(homeRoute())}
      >
        <Home size={icon.xl} color={c.ink} strokeWidth={1.75} />
      </GlyphButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space['3xl'] },
  /** `minWidth: 0` or a long title pushes the Home button off the edge. */
  title: { flex: 1, minWidth: 0 },
});
