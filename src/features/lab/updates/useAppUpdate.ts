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
import { useCallback, useState } from 'react';
import * as Updates from 'expo-updates';

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