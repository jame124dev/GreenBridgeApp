/**
 * `Screen` — the shell every v2 route renders into.
 *
 * It owns the four things that are wrong on almost every hand-rolled RN
 * screen, so no screen has to get them right individually:
 *
 * 1. SAFE AREAS. The canvas draws a 46pt mock status bar inside the green
 *    header wash. Real devices vary (47–62pt), and Android 15+ forces
 *    edge-to-edge, so the wash must bleed to the physical top while its
 *    CONTENT starts below the notch. `insets.top` is added to the header's
 *    own padding rather than pushing the whole sheet down — otherwise a white
 *    band appears above the wash on notched phones.
 *
 * 2. THE BOTTOM. Tab bar (78pt) plus `insets.bottom` (home indicator / gesture
 *    bar). Scroll content must clear both or the last row is unreachable.
 *
 * 3. STATUS BAR CONTRAST. The root layout hardcodes `<StatusBar style="dark" />`.
 *    On a dark v2 screen that is black-on-black. This flips it per scheme;
 *    expo-status-bar is declarative and last-mounted wins.
 *
 * 4. LINE LENGTH. On a tablet or unfolded foldable the 24pt gutter would let
 *    body copy run to a 700pt measure. Content caps at MAX_CONTENT_WIDTH and
 *    centres instead of stretching.
 */
import React, { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar } from './TabBar';
import {
  GUTTER,
  HEADER_SHEET_RADIUS,
  MAX_CONTENT_WIDTH,
  space,
  useV2Colors,
  useV2Theme,
} from '@/theme/v2';

type ScreenProps = {
  children: ReactNode;
  /**
   * The green wash header. Renders edge-to-edge behind the status bar with the
   * signature 34pt bottom corners. Omit for a screen with no header sheet.
   */
  header?: ReactNode;
  /** Scroll the body. Off for screens that manage their own list (FlatList). */
  scroll?: boolean;
  /**
   * Leave the header sheet OPEN at the bottom — no rounded corners, no bottom
   * padding — so the content below continues the same wash.
   *
   * For a screen whose header is only partly fixed. Home holds the brand bar
   * and the Selling/Buying tabs still while everything beneath them swipes
   * between modes, so the sheet has to be split: the fixed half here, the
   * curved bottom half inside each swiping pane. Both are `c.wash`, so it
   * reads as one sheet.
   */
  headerFlush?: boolean;
  /**
   * Let the CONTENT run under the status bar — for a screen whose first
   * element is a photograph.
   *
   * Only meaningful with no `header`. The shell normally reserves `insets.top`
   * so nothing hides behind the notch, which is right for every screen that
   * opens with type; it is wrong for a hero image, where that reserved strip
   * reads as a grey band above the photo.
   *
   * ⚠️ A bleeding screen owns what it just took on: its own overlay controls
   * must be pushed down by `insets.top` themselves, or they land under the
   * clock.
   */
  bleed?: boolean;
  /** Leave room for the tab bar. Off for full-screen flows like scan/review. */
  tabBar?: boolean;
  /**
   * A sticky primary action, held below the content.
   *
   * Rendered as a FLEX SIBLING of the body, not as an overlay — so it is
   * always visible AND the content above it can never scroll underneath it.
   * `UX_DESIGN_RULES.md` requires a sticky primary CTA on long forms; this is
   * that, without the reservation bug an absolute footer has.
   *
   * ⚠️ NOT for a chat composer. This footer does not move with the keyboard.
   * A screen with a text input at the bottom must own its own footer and pad
   * it by the keyboard inset — see `app/v2/chat.tsx`.
   */
  footer?: ReactNode;
  /** Page ground. Defaults to `base`; some screens sit on `surface`. */
  ground?: 'base' | 'surface';
  style?: StyleProp<ViewStyle>;
  /**
   * Lift the scroll AND the footer clear of the keyboard. For form screens.
   *
   * Without this, tapping a field near the bottom of a long form puts the
   * keyboard over both the field you are typing into and the footer holding
   * Continue — which is 7c exactly: four text inputs above a sticky action.
   *
   * `KeyboardProvider` is already mounted in `app/_layout.tsx`, so this is
   * just opting the screen in.
   */
  keyboard?: boolean;
  /** Applied to the scrolling content container, not the scroll view. */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Screen({
  children,
  header,
  scroll = true,
  headerFlush = false,
  bleed = false,
  tabBar = true,
  footer,
  ground = 'base',
  keyboard = false,
  style,
  contentStyle,
  testID,
}: ScreenProps) {
  const c = useV2Colors();
  const { scheme } = useV2Theme();
  const insets = useSafeAreaInsets();

  /**
   * Bottom padding the CONTENT needs.
   *
   * When `tabBar` is on, the bar is a real flex sibling below the scroll area,
   * so it occupies its own height and the gesture bar — the content needs
   * nothing. Only a tab-bar-less screen has to clear the gesture bar itself.
   *
   * It used to reserve `control.tabBar` as empty space because no tab bar
   * existed yet, which is why every screen ended in a void.
   */
  const bottomReserve = tabBar ? 0 : insets.bottom;

  // `KeyboardAwareScrollView` also keeps the focused field visible, which a
  // plain ScrollView does not.
  const Scroller = keyboard ? KeyboardAwareScrollView : ScrollView;

  // `styles.measure` has no flex, so a FlatList child of a non-scrolling
  // Screen collapses to zero height and the screen renders blank. Every list
  // screen would otherwise have to pass `contentStyle={{flex:1}}` and discover
  // this the hard way, so it is the default here.
  const body = (
    <View style={[styles.measure, !scroll && styles.flex, contentStyle]}>{children}</View>
  );

  const footerView = footer ? (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: c[ground],
          borderTopColor: c.hairline,
          // The footer, being the last thing on screen, owns the bottom
          // reserve: the tab bar's height plus the gesture bar.
          paddingBottom: bottomReserve + space['3xl'],
        },
      ]}
    >
      <View style={styles.measure}>{footer}</View>
    </View>
  ) : null;

  return (
    <View
      testID={testID}
      style={[styles.root, { backgroundColor: c[ground] }, style]}
    >
      {/*
        Light wash → dark status-bar glyphs; dark ground → light glyphs.
        Driven by the resolved scheme, not the device, so the dev override
        flips the status bar too.
      */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {header ? (
        <View
          style={[
            styles.header,
            headerFlush && styles.headerFlush,
            {
              backgroundColor: c.wash,
              // Bleed under the notch; push only the CONTENT down.
              paddingTop: insets.top + space.xl,
            },
          ]}
        >
          <View style={styles.measure}>{header}</View>
        </View>
      ) : bleed ? null : (
        // No sheet: still clear the notch.
        <View style={{ height: insets.top }} />
      )}

      {scroll ? (
        <Scroller
          style={styles.flex}
          // With a footer the reserve belongs to the footer, not the scroll
          // content — the footer is a sibling and already occupies that space.
          contentContainerStyle={{
            paddingBottom: footer ? space['6xl'] : bottomReserve + space['6xl'],
          }}
          showsVerticalScrollIndicator={false}
          // Momentum that matches the design's calm: no bounce-heavy feel on
          // Android, and the indicator never sits under the tab bar.
          scrollIndicatorInsets={{ bottom: footer ? 0 : bottomReserve }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bottomOffset={keyboard ? space['8xl'] : undefined}
        >
          {body}
        </Scroller>
      ) : (
        <View style={styles.flex}>{body}</View>
      )}

      {keyboard && footerView ? (
        // Rides up with the keyboard. `closed: 0` keeps the resting position
        // exactly as it is without keyboard mode, so opting in changes nothing
        // until a field is focused.
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
          {footerView}
        </KeyboardStickyView>
      ) : (
        footerView
      )}

      {tabBar ? <TabBar /> : null}
    </View>
  );
}

/**
 * Bottom padding a screen's own list needs, beyond what `Screen` handles.
 *
 * Now that the tab bar is a real flex sibling rather than reserved empty
 * space, a list inside a tab screen needs NOTHING at the bottom — the bar sits
 * below the scroll area, not over it. A screen with no tab bar still has to
 * clear the gesture bar itself.
 *
 * Kept as a hook rather than deleted so list screens have one place to ask,
 * instead of each deciding whether the answer is now zero.
 */
export function useTabBarReserve({ tabBar = true }: { tabBar?: boolean } = {}): number {
  const insets = useSafeAreaInsets();
  return tabBar ? 0 : insets.bottom;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    // The signature shape: the wash curves away from the status bar.
    borderBottomLeftRadius: HEADER_SHEET_RADIUS,
    borderBottomRightRadius: HEADER_SHEET_RADIUS,
    paddingHorizontal: GUTTER,
    paddingBottom: space['8xl'],
  },
  headerFlush: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 0,
  },
  /** Caps the measure on wide screens and centres it. No-op on phones. */
  measure: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
  footer: {
    // A flex sibling, NOT position:'absolute'. An absolute footer does not
    // reserve its own height, so the last rows of the content scrolled
    // underneath it and were unreachable. Two separate screen builds hit this
    // and both worked around it by rendering their own footer; the primitive
    // was wrong, not the screens.
    flex: 0,
    borderTopWidth: 1,
    paddingHorizontal: GUTTER,
    paddingTop: space['3xl'],
  },
});
