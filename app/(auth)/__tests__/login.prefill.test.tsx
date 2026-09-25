import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

// NOTE: don't capture an outer `const mockPush = jest.fn()` and reference it
// from inside this factory (the pattern jest's docs show for "mock"-prefixed
// variables). Empirically, in this project's babel/jest setup the factory
// runs before that outer assignment executes, so the captured value is
// `undefined` at construction time and `router.push` silently ends up
// non-callable. Defining the jest.fn() inline in the factory and importing
// `router` back out afterwards (below) sidesteps the hoisting order issue.
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ email: 'saved@example.com' }),
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
import '@/i18n'; // initializes real en resources so t('mobile.auth.forgotShort') === 'Forgot?'

// The screen is v2 since 2026-09-22, so `useV2Colors()` needs a provider. In
// the app that comes from `app/(auth)/_layout.tsx`; a test that renders the
// screen alone has to supply it, or the render throws
// "useV2Theme must be used inside <V2ThemeProvider>".
import { V2ThemeProvider } from '@/theme/v2';

import LoginScreen from '../login';

describe('login email prefill', () => {
  it('prefills the email field from the "email" search param (forgot-password round-trip)', () => {
    const { getByDisplayValue } = render(
      <V2ThemeProvider>
        <LoginScreen />
      </V2ThemeProvider>,
    );
    expect(getByDisplayValue('saved@example.com')).toBeTruthy();
  });
});
