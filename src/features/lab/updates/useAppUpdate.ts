// useAppUpdate — thin, safe wrapper over `expo-updates`.
//
// WHY THIS EXISTS
// ---------------
// The app shipped with `EXUpdatesLaunchWaitMs: 0` and NO runtime updates code
// at all. That combination is silent by construction: expo-updates downloads a
// new bundle in the background and only swaps it in on the NEXT cold start, so
// a published hotfix appears to do nothing until the user happens to fully kill
// the app — and there is no way, from inside the app, to tell whether an update
// is downloading, waiting, or already running. When a shipped OTA fix "didn't
// arrive" there was nothing to inspect and no way to distinguish "never
// downloaded" from "downloaded but not applied".
//
// This hook makes both states visible and gives the user a one-tap way to apply
// a waiting update immediately instead of guessing at force-quits.
//
// Everything is guarded on `Updates.isEnabled`, which is false in Expo Go and
// in debug dev-client builds — there the hook reports a benign idle state rather
// than throwing.
//
// WHY expo-updates IS LOADED WITH require() AND NOT import
// -------------------------------------------------------
// `isEnabled` is not enough on its own. In a binary built BEFORE expo-updates
// was added (an older dev client, or Expo Go), the package throws while it is
// being imported — "Cannot find native module 'ExpoUpdates'" — which happens
// before any guard in this file can run, and takes the whole app down at launch
// with an uncaught error. That was observed on an older dev client here. Given
// the app has already been rejected once for crashing on launch, no native
// module may be allowed to fail the startup import: load it defensively and
// degrade to the disabled stub below when it is absent.
import { useCallback, useState } from 'react';

/** Only the surface of expo-updates this module actually uses. */
interface UpdatesApi {
  useUpdates: () => { isUpdatePending: boolean; isDownloading: boolean };
  isEnabled: boolean;
  reloadAsync: () => Promise<unknown>;
  runtimeVersion: string | null;
  channel: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
}

// Reports "nothing to update, running the built-in bundle" — the truth when the
// native module is missing. `useUpdates` calls no hooks, so swapping it in does
// not disturb hook order (the choice is made once, at module load).
const UPDATES_UNAVAILABLE: UpdatesApi = {
  useUpdates: () => ({ isUpdatePending: false, isDownloading: false }),
  isEnabled: false,
  reloadAsync: () => Promise.reject(new Error('expo-updates is not available in this binary')),
  runtimeVersion: null,
  channel: null,
  updateId: null,
  isEmbeddedLaunch: true,
};

let Updates: UpdatesApi = UPDATES_UNAVAILABLE;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates') as UpdatesApi;
} catch {
  // No ExpoUpdates native module in this binary — keep the stub.
}

export interface AppUpdateState {
  /** A newer bundle is downloaded and will run on the next launch. */
  pending: boolean;
  /** A download is in flight right now. */
  downloading: boolean;
  /** True while `restart()` is tearing the app down. */
  restarting: boolean;
  /** Apply a pending update NOW by reloading into it. */
  restart: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const { isUpdatePending, isDownloading } = Updates.useUpdates();
  const [restarting, setRestarting] = useState(false);

  const restart = useCallback(() => {
    if (!Updates.isEnabled) return;
    setRestarting(true);
    // reloadAsync resolves only as the app tears down; a rejection (dev client,
    // no pending update) must not leave the button spinning forever.
    Updates.reloadAsync().catch(() => setRestarting(false));
  }, []);

  return {
    pending: Updates.isEnabled && isUpdatePending,
    downloading: Updates.isEnabled && isDownloading,
    restarting,
    restart,
  };
}

/** Which bundle is running right now — for the Account screen + support. */
export interface RunningBundle {
  version: string;
  channel: string;
  /** Short update id, or null when running the bundle baked into the binary. */
  updateId: string | null;
  embedded: boolean;
}

export function getRunningBundle(): RunningBundle {
  return {
    version: (Updates.runtimeVersion ?? '') || '—',
    channel: Updates.channel ?? 'dev',
    // `isEmbeddedLaunch` is the ONLY reliable way to tell "running the binary's
    // own bundle" from "running an OTA update" — updateId is non-null for the
    // embedded bundle too.
    updateId: Updates.isEmbeddedLaunch ? null : (Updates.updateId?.slice(0, 8) ?? null),
    embedded: Updates.isEmbeddedLaunch,
  };
}