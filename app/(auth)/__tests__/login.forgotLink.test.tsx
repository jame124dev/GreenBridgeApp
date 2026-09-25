import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

// NOTE: don't capture an outer `const mockPush = jest.fn()` and reference it
// from inside this factory (the pattern jest's docs show for "mock"-prefixed
// variables). Empirically, in this project's babel/jest setup the factory
// runs before that outer assignment executes, so the captured value is
// `undefined` at construction time and `router.push` silently ends up
// non-callable. Defining the jest.fn() inline in the factory and importing
// `router` back out afterwards (below) sidesteps the hoisting order issue.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/mmkv', () => ({
  mmkv: { getString: () => undefined, set: () => {}, getBoolean: () => undefined, remove: () => {} },
}));
// Button.tsx pulls in react-native-reanimated for its press-scale animation;
// the native Worklets module isn't initialized under jest, so stub the bits
// Button actually uses (mirrors the pattern in forgot-password.test.tsx).
jest.mock('react-native-reanimated', () =>
  require('@/test-utils/reanimatedMock').reanimatedMock(),
);
jest.mock('@/features/auth/useLogin', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
}));
import '@/i18n'; // real en resources, so the assertion below is on real copy

// v2 screens read their colours from context — see the note in login.prefill.
import { V2ThemeProvider } from '@/theme/v2';

import { router } from 'expo-router';
import LoginScreen from '../login';

describe('login "Forgot password?" link', () => {
  /**
   * The LABEL changed with the v2 rebuild (2026-09-22): `mobile.auth.forgotShort`
   * ("Forgot?") → `mobile.auth.forgotPassword` ("Forgot password?").
   *
   * "Forgot?" was shorthand that worked only where it used to sit — on the same
   * row as the PASSWORD eyebrow, where the noun was supplied by the label two
   * inches to its left. The link now sits on its own line under the field, and
   * a bare "Forgot?" there is a question with no subject.
   *
   * What this test is actually for is unchanged and is the thing that matters:
   * the link goes to the NATIVE route and opens no web page. Apple rejected
   * build 14 over an outbound link on this screen.
   */
  it('navigates to the native forgot-password route (no web browser)', () => {
    const { getByText } = render(
      <V2ThemeProvider>
        <LoginScreen />
      </V2ThemeProvider>,
    );
    fireEvent.press(getByText('Forgot password?'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});
