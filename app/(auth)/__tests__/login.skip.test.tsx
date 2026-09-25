import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

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
jest.mock('react-native-reanimated', () =>
  require('@/test-utils/reanimatedMock').reanimatedMock(),
);
jest.mock('@/features/auth/useLogin', () => ({
  useLogin: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/features/auth/useRegistration', () => ({
  useRegistration: () => ({
    state: {
      step: 'credentials',
      email: '',
      name: '',
      password: '',
      busy: false,
      error: null,
      restarted: false,
      result: null,
    },
    resendCooldown: 0,
    submitCredentials: jest.fn(),
    submitCode: jest.fn(),
    resend: jest.fn(),
    back: jest.fn(),
  }),
}));
// Mock hardware back since register uses it
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native') as any;
  RN.BackHandler = {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  };
  return RN;
});

import '@/i18n'; // real en resources

import { V2ThemeProvider } from '@/theme/v2';
import { router } from 'expo-router';
import { homeRoute } from '@/features/v2/routing/postAuthLanding';
import LoginScreen from '../login';
import RegisterScreen from '../register';

describe('auth skip / Do later options', () => {
  it('login screen Do later button navigates to homeRoute()', () => {
    const { getByText } = render(
      <V2ThemeProvider>
        <LoginScreen />
      </V2ThemeProvider>,
    );
    fireEvent.press(getByText('Do later'));
    expect(router.replace).toHaveBeenCalledWith(homeRoute());
  });

  it('register screen Do later button navigates to homeRoute()', () => {
    const { getByText } = render(
      <V2ThemeProvider>
        <RegisterScreen />
      </V2ThemeProvider>,
    );
    fireEvent.press(getByText('Do later'));
    expect(router.replace).toHaveBeenCalledWith(homeRoute());
  });
});
