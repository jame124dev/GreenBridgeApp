/**
 * Live OS push-permission state for UI that offers a way back on.
 *
 * Re-reads on foreground because the only real fix for a denied permission is
 * the system Settings app — the user leaves, flips the switch, and comes back,
 * and the card they left must not still say "off".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  addPushPermissionListener,
  getPushPermission,
  type PushPermissionState,
} from '@/lib/onesignal';

/** `unknown` only until the first async read resolves — callers should render
 *  nothing for it rather than flash an "off" state that may be wrong. */
export type PushPermissionUiState = PushPermissionState | 'unknown';

export function usePushPermission() {
  const [state, setState] = useState<PushPermissionUiState>('unknown');
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const next = await getPushPermission();
    if (mounted.current) setState(next);
    return next;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    // The event only carries a boolean, which cannot tell "declined" from
    // "never asked" — re-read instead of downgrading the state to `denied`.
    const offPermission = addPushPermissionListener(() => {
      void refresh();
    });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });

    return () => {
      mounted.current = false;
      offPermission();
      sub.remove();
    };
  }, [refresh]);

  return { state, refresh };
}
