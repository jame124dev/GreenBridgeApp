/**
 * `SchemeToggleDev` — a floating light/dark switch. **Development only.**
 *
 * `app.config.ts` pins `userInterfaceStyle: 'light'` to protect the old UI
 * (see `theme/v2/ThemeProvider.tsx`), so the device's own dark-mode setting
 * cannot reach this app. Without this control there is no way to look at a v2
 * screen in dark on a real phone short of editing the layout and reloading —
 * for every screen, every time.
 *
 * Every screen has to be checked in both schemes before it is done, because
 * the failures that matter here are invisible to tsc and to Jest: a hairline
 * that disappears, a caption that goes black-on-black, an accent slab that
 * stops reading as a button.
 *
 * Renders nothing outside `__DEV__`. Deliberately ugly and deliberately in the
 * way — it is a tool, not a feature, and it should be obvious that it is not
 * meant to ship.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
// `Pressable` from GESTURE HANDLER, not react-native. RN's Pressable uses the
// JS responder system, which RNGH intercepts natively — inside Home's pager it
// never receives the tap. See the note in `features/v2/home/HomePager.tsx`.
import { Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { control, radius, space, useV2Theme } from '@/theme/v2';

import { Text } from './Text';

export function SchemeToggleDev() {
  const { scheme, preference, cyclePreference } = useV2Theme();
  const insets = useSafeAreaInsets();
  /**
   * LONG-PRESS HIDES IT for the rest of the session.
   *
   * It floats over the bottom-left of every screen, and twice now it has sat
   * on top of the exact control being verified — the chat composer's camera
   * and attach keys, then 7e's "Go to Details", which is the whole point of the
   * not-ready verdict. Raising it cleared the first and not the second: there
   * is no fixed corner that is empty on every screen.
   *
   * So it gets out of the way on demand. Session-only (plain state, no
   * persistence) because it must come back on the next reload — a dev tool you
   * can permanently lose is a dev tool you stop trusting.
   */
  const [hidden, setHidden] = useState(false);

  if (!__DEV__ || hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      // Cleared of a FOOTER, not just the tab bar. Sitting at
      // `tabBar + inset` put it straight on top of the chat composer's camera
      // and attach keys — the comment below says it moved left to dodge the
      // SEND button, and it simply landed on the other two. `control.input` is
      // the composer's own height, so one more of those clears any footer the
      // kit builds; on a screen with no footer it just floats a little higher.
      style={[
        styles.wrap,
        { bottom: control.tabBar + insets.bottom + control.input + space['3xl'] },
      ]}
    >
      <Pressable
        onPress={cyclePreference}
        onLongPress={() => setHidden(true)}
        accessibilityRole="button"
        accessibilityLabel={`Colour scheme: ${preference}. Tap to change, long-press to hide.`}
        accessibilityHint="Long press hides this development control until the app reloads"
        style={styles.pill}
      >
        <Text variant="micro" color="onAccent">
          {`${preference === 'system' ? 'SYS' : preference.toUpperCase()} → ${scheme.toUpperCase()}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // LEFT, not right: a right-aligned toggle lands exactly on top of the send
  // button on the chat composer and the chevron on every list row, which makes
  // the thing it exists to help you test untappable.
  wrap: { position: 'absolute', left: space['3xl'], alignItems: 'flex-start' },
  pill: {
    // Not a token: this control is not part of the design and must not look
    // like it is. Fixed magenta so it can never be mistaken for a v2 surface.
    backgroundColor: '#B5179E',
    paddingHorizontal: space['3xl'],
    paddingVertical: space.md,
    borderRadius: radius.pill,
    opacity: 0.9,
  },
});
