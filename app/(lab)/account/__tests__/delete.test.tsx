import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
}));
jest.mock('sonner-native', () => ({
  toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warning: jest.fn() } }));
// `@/i18n` pulls in src/lib/mmkv for the persisted language, and MMKV needs a
// native module jest has no binary for.
jest.mock('@/lib/mmkv', () => ({ mmkv: { getString: () => undefined, set: () => {} } }));
// Button.tsx pulls in react-native-reanimated for its press-scale animation; the
// native Worklets module isn't initialized under jest (same stub as the
// forgot-password screen test).
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

const mockUseDeletionPreview = jest.fn();
jest.mock('@/features/settings/useAccountDeletion', () => ({
  useDeletionPreview: () => mockUseDeletionPreview(),
  useDeleteAccount: () => ({ mutate: jest.fn(), isPending: false }),
}));

import '@/i18n'; // real en resources, so assertions read the shipped copy

import DeleteAccountScreen from '../delete';

const CLEAN = {
  liveListings: 0,
  openOrders: 0,
  unpaidWinningBids: 0,
  activeWants: 0,
  hasOutstanding: false,
};

beforeEach(() => {
  mockUseDeletionPreview.mockReset();
});

describe('DeleteAccountScreen', () => {
  it('explains what happens before asking for anything', () => {
    mockUseDeletionPreview.mockReturnValue({ isLoading: false, data: CLEAN });
    const { getByText } = render(<DeleteAccountScreen />);
    expect(getByText('Delete your account')).toBeTruthy();
    expect(getByText('What happens')).toBeTruthy();
    expect(getByText('Delete my account')).toBeTruthy();
  });

  it('shows an explaining loader, not a bare spinner, while the preview loads', () => {
    mockUseDeletionPreview.mockReturnValue({ isLoading: true, data: undefined });
    const { getByText } = render(<DeleteAccountScreen />);
    expect(getByText('Checking your account…')).toBeTruthy();
  });

  it('lists only the obligations the account actually has', () => {
    mockUseDeletionPreview.mockReturnValue({
      isLoading: false,
      data: {
        liveListings: 3,
        openOrders: 0,
        unpaidWinningBids: 1,
        activeWants: 2,
        hasOutstanding: true,
      },
    });
    const { getByText, queryByText } = render(<DeleteAccountScreen />);
    expect(getByText('Before you delete')).toBeTruthy();
    expect(getByText('• 3 listings still on the market')).toBeTruthy();
    // Singular form resolves for a count of 1.
    expect(getByText('• 1 unpaid winning bid')).toBeTruthy();
    // openOrders is 0 — a "0 open orders" line would be noise.
    expect(queryByText('• 0 open orders')).toBeNull();
  });

  it('renders no warning block for a clean account', () => {
    mockUseDeletionPreview.mockReturnValue({ isLoading: false, data: CLEAN });
    const { queryByText } = render(<DeleteAccountScreen />);
    expect(queryByText('Before you delete')).toBeNull();
  });

  it('disables the delete CTA until a password is entered', () => {
    mockUseDeletionPreview.mockReturnValue({ isLoading: false, data: CLEAN });
    const { getByTestId } = render(<DeleteAccountScreen />);
    expect(getByTestId('delete-account-submit').props.accessibilityState.disabled).toBe(true);
  });
});
