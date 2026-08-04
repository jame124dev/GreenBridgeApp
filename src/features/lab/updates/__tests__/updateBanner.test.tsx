import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react-native';

// Guards the OTA-visibility fix. Build 8 shipped with EXUpdatesLaunchWaitMs=0 and
// no runtime updates code, so a downloaded update sat idle with nothing on screen
// to say so — indistinguishable, from the user's side, from an update that never
// arrived. These tests pin the two behaviours that make that state observable:
// the banner appears only when an update is actually pending, and the version
// line reports embedded-vs-OTA truthfully.
// `__esModule: true` is REQUIRED: without it Babel's interopRequireWildcard
// copies the namespace into a fresh object at import time, so `Updates.isEnabled
// = false` in a test would never be seen by the module under test.
jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  isEmbeddedLaunch: true,
  updateId: 'abcdef1234567890',
  channel: 'production',
  runtimeVersion: '1.0.0',
  reloadAsync: jest.fn(() => Promise.resolve()),
  useUpdates: jest.fn(() => ({ isUpdatePending: false, isDownloading: false })),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('lucide-react-native', () => {
  const React_ = require('react');
  const { View } = require('react-native');
  return new Proxy({}, { get: () => (props: object) => React_.createElement(View, props) });
});
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/ui', () => {
  const RN = require('react-native');
  return { Text: RN.Text };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const Updates = require('expo-updates') as {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string;
  reloadAsync: jest.Mock;
  useUpdates: jest.Mock;
};

function loadBanner() {
  return require('../UpdateReadyBanner').UpdateReadyBanner as React.ComponentType;
}
function loadVersionLine() {
  return require('../AppVersionLine').AppVersionLine as React.ComponentType;
}

const idle = { isUpdatePending: false, isDownloading: false };
const pending = { isUpdatePending: true, isDownloading: false };

beforeEach(() => {
  jest.clearAllMocks();
  Updates.isEnabled = true;
  Updates.isEmbeddedLaunch = true;
  Updates.useUpdates.mockReturnValue(idle);
});

describe('UpdateReadyBanner', () => {
  it('renders nothing while no update is pending', () => {
    const Banner = loadBanner();
    const { queryByText } = render(<Banner />);
    expect(queryByText('mobile.labUpdate.readyTitle')).toBeNull();
  });

  it('surfaces a pending update with a single primary action', () => {
    Updates.useUpdates.mockReturnValue(pending);
    const Banner = loadBanner();
    const { getByText, getByLabelText } = render(<Banner />);
    expect(getByText('mobile.labUpdate.readyTitle')).toBeTruthy();
    // States the consequence, not just "update available".
    expect(getByText('mobile.labUpdate.readyBody')).toBeTruthy();
    expect(getByLabelText('mobile.labUpdate.restart')).toBeTruthy();
  });

  it('applies the update immediately when the user taps Restart', () => {
    Updates.useUpdates.mockReturnValue(pending);
    const Banner = loadBanner();
    const { getByLabelText } = render(<Banner />);
    fireEvent.press(getByLabelText('mobile.labUpdate.restart'));
    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('is dismissible — it must not block the app', () => {
    Updates.useUpdates.mockReturnValue(pending);
    const Banner = loadBanner();
    const { getByLabelText, queryByText } = render(<Banner />);
    fireEvent.press(getByLabelText('mobile.labUpdate.later'));
    expect(queryByText('mobile.labUpdate.readyTitle')).toBeNull();
  });

  it('stays hidden when updates are disabled (Expo Go / debug dev client)', () => {
    Updates.isEnabled = false;
    Updates.useUpdates.mockReturnValue(pending);
    const Banner = loadBanner();
    const { queryByText } = render(<Banner />);
    expect(queryByText('mobile.labUpdate.readyTitle')).toBeNull();
  });
});

describe('AppVersionLine', () => {
  it('reports the embedded bundle as built-in', () => {
    Updates.isEmbeddedLaunch = true;
    const Line = loadVersionLine();
    const { getByText } = render(<Line />);
    expect(getByText(/mobile\.labUpdate\.builtIn/)).toBeTruthy();
  });

  it('reports the short update id when running an OTA update', () => {
    Updates.isEmbeddedLaunch = false;
    const Line = loadVersionLine();
    const { getByText, queryByText } = render(<Line />);
    // Short id only — the full uuid is unreadable in a footer.
    expect(getByText(/abcdef12/)).toBeTruthy();
    expect(queryByText(/abcdef1234567890/)).toBeNull();
  });

  it('shows the downloading state so a slow update is not invisible', () => {
    Updates.useUpdates.mockReturnValue({ isUpdatePending: false, isDownloading: true });
    const Line = loadVersionLine();
    const { getByText } = render(<Line />);
    expect(getByText('mobile.labUpdate.downloading')).toBeTruthy();
  });
});
