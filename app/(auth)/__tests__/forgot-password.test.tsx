import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() } }));
jest.mock('sonner-native', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));
// Button.tsx pulls in react-native-reanimated for its press-scale animation;
// the native Worklets module isn't initialized under jest, so stub the bits
// Button actually uses (mirrors the pattern in StreamingMessage.test.tsx).
jest.mock('react-native-reanimated', () =>
  require('@/test-utils/reanimatedMock').reanimatedMock(),
);
import '@/i18n'; // initializes real en resources so t('mobile.auth.reset.sendCode') === 'Send code'

// v2 screens read their colours from context — see the note in login.prefill.
import { V2ThemeProvider } from '@/theme/v2';

import ForgotPasswordScreen from '../forgot-password';

describe('ForgotPasswordScreen', () => {
  it('renders the email step first (Send code visible, no OTP field yet)', () => {
    const { getByText, queryByTestId } = render(
      <V2ThemeProvider>
        <ForgotPasswordScreen />
      </V2ThemeProvider>,
    );
    expect(getByText('Send code')).toBeTruthy();
    expect(queryByTestId('otp-input')).toBeNull();
  });
});
