/**
 * The Sign in / Create account segment is the ONLY route between the two
 * forms since the wash-hero rebuild removed the bottom text links, so a dead
 * segment is a dead end on the screen every unauthenticated user lands on.
 *
 * It cannot be pressed on the test device: `AuthGuard` redirects a signed-in
 * user away from `/(auth)/*`, and the device holds a real session whose
 * password we do not have. So the navigation is pinned here instead, and the
 * device pass covers how it looks and that it responds. Stated plainly
 * because "verified on device" would be false for this one control.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/mmkv', () => ({
  mmkv: { getString: () => undefined, set: () => {}, getBoolean: () => undefined, remove: () => {} },
}));
jest.mock('react-native-reanimated', () =>
  require('@/test-utils/reanimatedMock').reanimatedMock(),
);
jest.mock('@/components/ui', () => ({
  LanguageSheet: () => null,
}));

import '@/i18n'; // real en resources

import { router } from 'expo-router';
import { AuthShell } from '@/features/v2/auth/AuthShell';
import { V2ThemeProvider } from '@/theme/v2';
import { Text } from '@/features/v2/ui';

function mount(mode: 'signin' | 'signup', email?: string) {
  return render(
    <V2ThemeProvider initialPreference="light">
      <AuthShell mode={mode} title="t" email={email}>
        <Text variant="body">body</Text>
      </AuthShell>
    </V2ThemeProvider>,
  );
}

describe('AuthShell segment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('switches sign in → create account by route, not by a dead tab', () => {
    const { getByTestId } = mount('signin');
    fireEvent.press(getByTestId('v2-segment-signup'));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/register',
      params: {},
    });
  });

  it('switches create account → sign in', () => {
    const { getByTestId } = mount('signup');
    fireEvent.press(getByTestId('v2-segment-signin'));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/login',
      params: {},
    });
  });

  /**
   * Retyping your address is the price of changing your mind, unless the
   * switch carries it. The receiving screen reads `params.email` — login has
   * always prefilled from it (the forgot-password round trip), and register
   * was taught to in the same change.
   */
  it('carries a typed email across the switch, trimmed', () => {
    const { getByTestId } = mount('signin', '  ada@example.com  ');
    fireEvent.press(getByTestId('v2-segment-signup'));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/(auth)/register',
      params: { email: 'ada@example.com' },
    });
  });

  it('does nothing when the selected segment is pressed again', () => {
    const { getByTestId } = mount('signin');
    fireEvent.press(getByTestId('v2-segment-signin'));
    expect(router.replace).not.toHaveBeenCalled();
  });

  /**
   * Mid-flow steps (the emailed code, the outcome) hide the segment: offering
   * "Sign in" beside a code we have just sent invites abandoning an account
   * that already half-exists.
   */
  it('is absent when the shell is not segmented', () => {
    const { queryByTestId } = render(
      <V2ThemeProvider initialPreference="light">
        <AuthShell mode="signup" segmented={false} title="t">
          <Text variant="body">body</Text>
        </AuthShell>
      </V2ThemeProvider>,
    );
    expect(queryByTestId('v2-segment-signin')).toBeNull();
    expect(queryByTestId('v2-segment-signup')).toBeNull();
  });
});
