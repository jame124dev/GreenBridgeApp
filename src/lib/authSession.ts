import { getSecureItem } from '@/lib/secureStorage';

// Decode a JWT's `exp` (seconds). Returns null if it can't be read — callers
// treat null as "unknown", never as expired (fail-open, so a decode quirk can
// never log out a valid user).
function decodeExp(jwt: string): number | null {
  try {
    const part = jwt.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    // eslint-disable-next-line no-undef
    const json =
      typeof atob === 'function'
        ? atob(b64)
        : // eslint-disable-next-line no-undef
          Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * True ONLY when we can prove the long-lived refresh token is expired. The
 * assistant + Node recover identity from the refresh token when the 15-min
 * access token lapses, so the session is only truly dead once the refresh
 * token itself expires. Used to force re-login on boot instead of silently
 * running with a dead session (which makes the AI treat the user as anonymous —
 * "create a free account to continue" despite a persisted profile).
 *
 * Fail-open: no refresh token, or an undecodable one, returns false.
 */
export async function isSessionExpired(): Promise<boolean> {
  const refresh = await getSecureItem('auth.refreshToken');
  if (!refresh) return false;
  const exp = decodeExp(refresh);
  if (exp == null) return false;
  // 30s skew guard so a near-boundary token isn't killed prematurely.
  return exp < Math.floor(Date.now() / 1000) - 30;
}
