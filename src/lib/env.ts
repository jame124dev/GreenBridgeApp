import Constants from 'expo-constants';

export function getExpoExtra() {
  return Constants.expoConfig?.extra ?? {};
}

/** NODE base URL (auth, GCS upload, product/batch fetch, smart-detect v2). */
export function getGreenbidzApiUrl(): string {
  return (getExpoExtra().GREENBIDZ_API_URL as string | undefined) ?? '';
}

/**
 * ASSISTANT (Python FastAPI) base URL — chat stream, detect stream (Route B),
 * WTB, handoff. Defaulted in `app.config.ts` to `https://ai.greenbidz.com`, so
 * this is non-empty even without an `AI_BASE_URL` in `.env`.
 */
export function getAiBaseUrl(): string {
  return (getExpoExtra().AI_BASE_URL as string | undefined) ?? '';
}

/**
 * Socket.io server origin for the buyer↔seller messages (Node). The web uses a
 * separate `VITE_SOCKET_URL` that is just the API host WITHOUT the `/api/v1`
 * suffix (web `:4000/api/v1/` → socket `:4000`). We mirror that: honor an
 * explicit `SOCKET_URL` from extra if set, else derive it from
 * `GREENBIDZ_API_URL` by stripping a trailing `/api/v1` (+ any trailing slash).
 */
export function getSocketUrl(): string {
  const explicit = (getExpoExtra().SOCKET_URL as string | undefined)?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const api = getGreenbidzApiUrl().replace(/\/$/, '');
  return api.replace(/\/api\/v\d+$/, '');
}

/**
 * 101 Lab marketplace web origin — the Browse tab loads `${MARKETPLACE_URL}
 * /buyer-marketplace?app=1` inside a WebView. Honor an explicit
 * `EXPO_PUBLIC_MARKETPLACE_URL` (via app.config extra), else default to the
 * live site. No trailing slash.
 */
export function getMarketplaceUrl(): string {
  const extra = getExpoExtra().MARKETPLACE_URL as string | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_MARKETPLACE_URL;
  return (extra ?? fromEnv ?? 'https://101lab.co').replace(/\/$/, '');
}

export function isAuthEnvConfigured(): boolean {
  const extra = getExpoExtra();
  return Boolean(extra.GREENBIDZ_API_URL && extra.X_SYSTEM_KEY);
}

/** Dev-only warnings when required env vars are missing from app.config extra. */
export function warnMissingEnvInDev() {
  if (!__DEV__) return;

  const extra = getExpoExtra();

  if (!extra.GREENBIDZ_API_URL) {
    console.warn('[env] GREENBIDZ_API_URL is not set — login will fail');
  }
  if (!extra.X_SYSTEM_KEY) {
    console.warn(
      '[env] X_SYSTEM_KEY is not set — copy VITE_X_SYSTEM_KEY from 101lab-2/.env into GreenBridgeApp/.env, then restart Expo',
    );
  }
}

/** Seller dashboard deep link (101 Lab web). Set WEB_APP_URL in .env (no trailing slash). */
export function getSellerListingWebUrl(batchPk?: number): string | null {
  const base = (getExpoExtra().WEB_APP_URL as string | undefined)?.replace(/\/$/, '');
  if (!base) return null;
  if (batchPk == null || !Number.isFinite(batchPk)) return `${base}/dashboard`;
  return `${base}/dashboard/marketplace/${batchPk}`;
}

export function getAuthConfigError(): string | null {
  const extra = getExpoExtra();
  if (!extra.X_SYSTEM_KEY) {
    return 'X_SYSTEM_KEY is missing. Copy VITE_X_SYSTEM_KEY from 101lab-2/.env into GreenBridgeApp/.env and restart Expo (npx expo start --clear).';
  }
  if (!extra.GREENBIDZ_API_URL) {
    return 'GREENBIDZ_API_URL is missing in .env. Restart Expo after fixing.';
  }
  return null;
}
