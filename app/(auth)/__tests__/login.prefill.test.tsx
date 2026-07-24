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
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('@/features/auth/useLogin', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
}));
import '@/i18n'; // initializes real en resources so t('mobile.auth.forgotShort') === 'Forgot?'

import LoginScreen from '../login';

describe('login email prefill', () => {
  it('prefills the email field from the "email" search param (forgot-password round-trip)', () => {
    const { getByDisplayValue } = render(<LoginScreen />);
    expect(getByDisplayValue('saved@example.com')).toBeTruthy();
  });
});
