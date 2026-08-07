/**
 * Regression: a missing ExpoUpdates native module must NOT crash the app.
 *
 * In a binary built before expo-updates was added (an older dev client, or Expo
 * Go), `expo-updates` throws while it is being IMPORTED — "Cannot find native
 * module 'ExpoUpdates'" — which is before any `Updates.isEnabled` guard can run.
 * That produced an uncaught error at launch and a blank app. Since the app has
 * already been rejected by App Review once for crashing on launch, this is
 * pinned: importing this module must succeed, and it must report the same
 * benign "nothing pending, running the built-in bundle" state it reports when
 * updates are merely disabled.
 */
import { describe, it, expect, jest } from '@jest/globals';
// Must be imported at top level: this package registers its own beforeAll/afterAll,
// and requiring it inside a test fails with "Hooks cannot be defined inside tests".
import { renderHook } from '@testing-library/react-native';

jest.mock('expo-updates', () => {
  throw new Error("Cannot find native module 'ExpoUpdates'");
});

/* eslint-disable @typescript-eslint/no-require-imports */
// NOTE: no jest.resetModules() here. Resetting the registry hands this file a
// second copy of `react`, so the hook renders against a null dispatcher
// ("Cannot read properties of null (reading 'useState')"). Every test below wants
// the same module state anyway — the mock throws on each load regardless.

describe('useAppUpdate with no ExpoUpdates native module', () => {
  it('imports without throwing', () => {
    expect(() => require('../useAppUpdate')).not.toThrow();
  });

  it('reports the built-in bundle rather than an OTA update', () => {
    const { getRunningBundle } = require('../useAppUpdate');
    const bundle = getRunningBundle();
    expect(bundle.embedded).toBe(true);
    expect(bundle.updateId).toBeNull();
    // no runtimeVersion/channel to read from a module that isn't there
    expect(bundle.version).toBe('—');
    expect(bundle.channel).toBe('dev');
  });

  it('never claims an update is pending or downloading', () => {
    const { useAppUpdate } = require('../useAppUpdate');
    // useAppUpdate calls useState, so drive it through a renderer.
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.pending).toBe(false);
    expect(result.current.downloading).toBe(false);
    expect(result.current.restarting).toBe(false);
  });

  it('restart() is inert instead of throwing', () => {
    const { useAppUpdate } = require('../useAppUpdate');
    const { result } = renderHook(() => useAppUpdate());
    expect(() => result.current.restart()).not.toThrow();
  });
});
