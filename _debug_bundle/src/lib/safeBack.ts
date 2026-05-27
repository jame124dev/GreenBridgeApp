import { router } from 'expo-router';
import type { Href } from 'expo-router';

import { routes } from './routes';

/**
 * `router.back()` that won't trigger React Navigation's
 * "The action 'GO_BACK' was not handled by any navigator" warning when the
 * back stack is empty (deep-link, fresh launch on a non-home route, or after
 * a `router.replace` chain that consumed all history).
 *
 * Falls back to the Home tab unless an explicit fallback is provided.
 */
export function safeBack(fallback: Href = routes.scanHome) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
