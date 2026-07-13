// Custom Expo Router tabBar — the frosted 5-tab bottom nav for the (lab) fork
// (NewVersion/08-bottom-nav.md). Solid frosted white (rgba, NOT expo-blur),
// hairline top border, dynamic bottom safe-area inset, active tint follows the
// current route (state.index). On `published`, all tabs render idle.
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { haptics } from '@/lib/haptics';
import { navBorder, spacing } from '@/constants/theme';
import { TabBarItem } from './TabBarItem';
import { TAB_CONFIG, STATIC_BADGES } from './tabConfig';

// Measured content height of the bar, safe-area inset EXCLUDED: paddingTop 8 +
// item minHeight 48 + gap/label + paddingBottom 8 ≈ 66. Exported so tab screens
// reserve the exact bar height as scroll paddingBottom instead of guessing with
// magic numbers (see home.tsx). Use `useTabBarHeight()` to add the live inset.
export const TAB_BAR_BASE_HEIGHT = 66;

// Inline fallback for the tabBar props shape (spec 08 §3.1) — `@react-navigation/
// bottom-tabs` isn't a direct dep, so we type only what we use. This is the exact
// runtime shape Expo Router's `<Tabs tabBar={...}>` supplies.
type FrostedTabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

// Live bar height including the bottom safe-area inset. Tab screens use this as
// their scroll `paddingBottom` so the last row / any CTA clears the absolute bar
// identically on every screen (foundation checklist D + E).
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE_HEIGHT + insets.bottom;
}

// href:null screens that visually belong under a real tab — while on them the
// bar shows and that owner tab renders active (e.g. "See all" listings lives
// under Account). Anything not listed falls back to positional highlighting.
const OWNED_BY_TAB: Record<string, string> = { listings: 'account' };

export function FrostedTabBar({ state, navigation }: FrostedTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const activeName = state.routes[state.index]?.name;
  const isPublished = activeName === 'published';
  const ownerTab = activeName ? OWNED_BY_TAB[activeName] : undefined;

  return (
    <View style={[styles.bar, { paddingBottom: spacing.sm + insets.bottom }]}>
      {TAB_CONFIG.map((tab, i) => {
        // published shows the bar with NO tab highlighted (all idle); an owned
        // screen (e.g. listings) highlights its owner tab (account); otherwise
        // the tab at the current route index is active.
        const focused =
          !isPublished && (ownerTab ? tab.name === ownerTab : state.index === i);
        const routeName = state.routes[i]?.name ?? tab.name;
        return (
          <TabBarItem
            key={tab.name}
            Icon={tab.Icon}
            label={t(`mobile.labNav.${tab.labelKey}`)}
            focused={focused}
            badgeCount={tab.badgeKey ? STATIC_BADGES[tab.badgeKey] : 0}
            onPress={() => {
              haptics.tap(); // tab switch = tap() (light/selection feel)
              // Navigate unless we're already ON this tab's own route — so from
              // an owned screen (listings) tapping the lit Account still opens
              // Account, while a true re-tap on the current tab dedupes.
              if (activeName !== routeName) navigation.navigate(routeName);
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm, // 8 — was ad-hoc 9; snapped to the 4/8 grid
    paddingHorizontal: spacing.lg, // 16 — was ad-hoc 14
    borderTopWidth: 1,
    borderTopColor: navBorder, // #E8EEE9
    backgroundColor: 'rgba(255,255,255,0.96)', // solid frosted (NOT expo-blur)
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 5 },
      android: { elevation: 8 },
      web: { boxShadow: '0 -3px 10px rgba(0,0,0,0.03)' },
    }),
  },
});
