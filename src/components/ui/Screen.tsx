import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

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
  const containerClass = padded ? 'flex-1 px-lg' : 'flex-1';

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      refreshControl={refreshControl}
      contentContainerStyle={[
        { flexGrow: 1, paddingBottom: 48 },
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
