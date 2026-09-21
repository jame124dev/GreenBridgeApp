import type { AxiosInstance } from 'axios';

import { getSecureItem } from '@/lib/secureStorage';
import { logout } from '@/services/auth/logout';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function attachGreenbidzInterceptors(client: AxiosInstance) {
  client.interceptors.request.use(async (config) => {
    const access = await getSecureItem('auth.accessToken');
    const refresh = await getSecureItem('auth.refreshToken');
    if (access) config.headers.Authorization = `Bearer ${access}`;
    if (refresh) config.headers['x-refresh-token'] = refresh;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status;
      const url = error.config?.url ?? '';

      /**
       * A DEAD SESSION ON `/drafts` ARRIVES AS 403, NOT 401.
       *
       * `draftAuthGuard` (backend `routes/draftRoutes.js:83`) answers "no valid
       * credentials" with **403**, so an aged token never reached the branch
       * below and nothing cleared the session. Observed on a real device
       * 2026-09-21: Home kept rendering a signed-in shell — DRAFTS, LIVE
       * LISTINGS — off a profile that had outlived its stored token, showing
       * "your drafts did not load" when the truth was "you are not signed in".
       * "Try again" could never succeed; every retry re-sent the same dead
       * token. A cold start dropped the app to guest and confirmed there had
       * been no usable session at all.
       *
       * It hid so well because `/drafts` is the ONLY request on that screen
       * that verifies the token — live listings come from
       * `batchRouter.get("/seller/:sellerId")`, which has no `protect`
       * middleware and renders for anyone.
       *
       * ⚠️ SCOPED TO THE DRAFTS ROUTER, NOT 403 IN GENERAL. A 403 normally
       * means authenticated-but-not-allowed, and logging someone out for one
       * would be its own bug. This router is safe to treat this way because its
       * only other 403 — "Missing actor identity headers" — belongs to the
       * system-key path, which this client never takes: the request
       * interceptor above sends a Bearer token, never `x-drafts-key`.
       * Per-draft ownership does not 403 either; the controller scopes by owner
       * and yields empty/404.
       *
       * ⚠️ THIS IS THE STOPGAP, NOT THE FIX. The backend should return 401 for
       * an unverifiable token — 401 is unauthenticated, 403 is
       * authenticated-but-forbidden — which would make every client recover
       * without knowing anything about this route. That change is in a shared
       * backend and is tracked in `Docs/v2/STATUS.md` §3; when it lands, the
       * `isDeadSessionOn403` clause here becomes dead and should be deleted.
       */
      const isDeadSessionOn403 = status === 403 && /\/drafts(\/|\?|$)/.test(url);

      if ((status === 401 || isDeadSessionOn403) && !url.includes('/auth/login')) {
        await logout();
        onUnauthorized?.();
      }

      return Promise.reject(error);
    },
  );
}
