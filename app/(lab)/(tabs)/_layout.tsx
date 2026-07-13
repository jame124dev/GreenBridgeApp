// (lab) tab group — the five SHOW-nav destinations + published (bar, no button).
// Uses the custom FrostedTabBar renderer (NewVersion/08-bottom-nav.md), which
// replaces the legacy capsule tab bar for the customer fork. Route names match
// TAB_CONFIG: home, browse, matches, deals, account.
import { Tabs } from 'expo-router';
import { FrostedTabBar } from '@/features/lab/components';

export default function LabTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FrostedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="deals" />
      <Tabs.Screen name="account" />
      {/* published shows the bar with no tab button; all tabs render idle there */}
      <Tabs.Screen name="published" options={{ href: null }} />
      {/* listings ("See all") — no tab button; FrostedTabBar lights ACCOUNT here */}
      <Tabs.Screen name="listings" options={{ href: null }} />
    </Tabs>
  );
}
