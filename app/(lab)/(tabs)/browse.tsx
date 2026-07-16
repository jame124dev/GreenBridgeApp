// (lab) Browse — the 101 Lab buyer marketplace, rendered inside a WebView.
//
// Rather than re-build the catalog/search/filters natively, the Browse tab
// embeds the live web marketplace (`${MARKETPLACE_URL}/buyer-marketplace?app=1`)
// via the shared MarketplaceWebView (which owns the auth handoff + WEB↔NATIVE
// bridge). See MarketplaceWebView.tsx / webAuthBridge.ts for the contract.
//
// Tab bar SHOWS here (headerShown:false — the web keeps its own compact header;
// we pad the bottom so content clears the FrostedTabBar).
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand } from '@/constants/theme';
import { useTabBarHeight } from '@/features/lab/components';
import { MarketplaceWebView } from '@/features/lab/marketplace/MarketplaceWebView';

export default function LabBrowse() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  return (
    // White status-bar strip so it blends with the web header sitting just below.
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <MarketplaceWebView path="/buyer-marketplace" bottomInset={tabBarHeight} registerAuthClear />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: brand.surface },
});
