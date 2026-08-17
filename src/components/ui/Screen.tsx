import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

// Shared screen wrapper: safe-area root + (optionally) a padded ScrollView.
//
// ⚠️ Why the scroll padding is inset-aware. The default `edges={['top']}` means
// the SafeAreaView reserves NOTHING at the bottom, and the scroll content's
// `SCROLL_PADDING_BOTTOM` (48) happens to equal the height of the Android 3-button
// navigation bar — so on the default screen the last element ended exactly at the
// top edge of the nav buttons with zero clearance, and any screen overriding the
// value downwards (login, register, listing/[id]) pushed real, tappable content
// underneath them. Adding the live inset here fixes the whole app's default.
//
// The `edges.includes('bottom')` condition is load-bearing: when a caller opts
// into the bottom edge, the SafeAreaView ALREADY reserves the inset, and adding
// it again would open a visible dead gap above the nav bar (see detection.tsx,
// grouped-review.tsx, grouped-edit.tsx, LabPlaceholder).
//
// NOTE a caller-supplied `contentContainerStyle.paddingBottom` still wins (it is
// merged after) — screens that override it must add the inset themselves or ask
// for the bottom edge.
const SCROLL_PADDING_BOTTOM = 48;

type Props = {
  children: React.ReactNode;
  /** Wrap content in a vertical ScrollView. Default true. */
  scroll?: boolean;
  /** Padding applied to the scroll content (or root view when `scroll={false}`). Default true. */
  padded?: boolean;
  /** Safe-area edges to inset. Default `['top']`. */
  edges?: Edge[];
  /** Allow taps to dismiss the keyboard but keep handled. */
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
  /** Wrap in KeyboardAvoidingView (login / forms). */
  keyboardAware?: boolean;
  /** Pull-to-refresh control forwarded to the scroll view. */
  refreshControl?: ScrollViewProps['refreshControl'];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
  keyboardShouldPersistTaps = 'handled',
  keyboardAware = false,
  refreshControl,
  contentContainerStyle,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const containerClass = padded ? 'flex-1 px-lg' : 'flex-1';

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={refreshControl}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingBottom:
            SCROLL_PADDING_BOTTOM + (edges.includes('bottom') ? 0 : insets.bottom),
        },
        contentContainerStyle,
      ]}
      className={containerClass}
      bounces
    >
      {children}
    </ScrollView>
  ) : (
    <View className={containerClass} style={contentContainerStyle}>
      {children}
    </View>
  );

  const inner = keyboardAware ? (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <SafeAreaView
      className="flex-1 bg-bg"
      edges={edges}
      style={style}
    >
      {inner}
    </SafeAreaView>
  );
}
