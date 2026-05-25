import Constants from 'expo-constants';

export function getExpoExtra() {
  return Constants.expoConfig?.extra ?? {};
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
