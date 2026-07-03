// Auth handoff bridge between the native app and the 101 Lab marketplace WebView
// (Browse tab). The mobile app owns the session (SecureStore access/refresh
// tokens + MMKV profile); the embedded web reads its session from
// `localStorage`. These helpers translate the native session into the exact
// localStorage keys the web already reads, and produce JS strings we inject via
// the WebView's `injectedJavaScriptBeforeContentLoaded` (first paint) and
// `injectJavaScript` (re-injection on focus / after `auth-expired`).
//
// INTEGRATION CONTRACT — the web reads these 9 localStorage keys (do NOT
// rename accessToken/refreshToken/userId/userRole/userName/companyName — the
// web already consumes those):
//   accessToken, refreshToken, userId, userRole, jwtRole, activeView,
//   userName, companyName, language
// role/userRole/jwtRole/activeView default to 'buyer'.
import i18n from '@/i18n';
import { mmkv } from '@/lib/mmkv';
import { getSecureItem } from '@/lib/secureStorage';

/** The exact payload shape written into web localStorage. */
export type WebAuthPayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  userRole: string;
  jwtRole: string;
  activeView: string;
  userName: string;
  companyName: string;
  language: string;
};

type StoredProfile = {
  id?: number | string;
  email?: string;
  name?: string;
  role?: string;
  company?: string | null;
};

function readProfile(): StoredProfile {
  try {
    const raw = mmkv.getString('auth.profile');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredProfile;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Read the current native session and assemble the web auth payload. */
export async function buildAuthPayload(): Promise<WebAuthPayload> {
  const [accessToken, refreshToken] = await Promise.all([
    getSecureItem('auth.accessToken'),
    getSecureItem('auth.refreshToken'),
  ]);

  const profile = readProfile();
  // userId is persisted in MMKV as a NUMBER (see services/auth/login.ts
  // `persist`); fall back to the profile id if unset.
  let userId = '';
  try {
    const num = mmkv.getNumber('auth.userId');
    if (num != null && Number.isFinite(num) && num !== 0) userId = String(num);
  } catch {
    // ignore — fall back to profile id below
  }
  if (!userId && profile.id != null) userId = String(profile.id);

  // role defaults to 'buyer' per the contract.
  const role = (profile.role && String(profile.role)) || 'buyer';

  let language = 'en';
  try {
    language = i18n.language || 'en';
  } catch {
    // i18n not ready — English default.
  }

  return {
    accessToken: accessToken ?? '',
    refreshToken: refreshToken ?? '',
    userId,
    userRole: role,
    jwtRole: role,
    activeView: 'buyer',
    userName: profile.name ? String(profile.name) : '',
    companyName: profile.company ? String(profile.company) : '',
    language,
  };
}

/**
 * JS string for `injectedJavaScriptBeforeContentLoaded` — writes the 9 auth
 * keys directly into localStorage BEFORE the web's page scripts run, so the
 * token exists when the app boots. Wrapped in try/catch; ends with `true;` so
 * the injected script returns cleanly on iOS.
 */
export async function buildInjectedAuthJS(): Promise<string> {
  const p = await buildAuthPayload();
  return `(function(){try{
    var s = window.localStorage;
    s.setItem('accessToken', ${JSON.stringify(p.accessToken)});
    s.setItem('refreshToken', ${JSON.stringify(p.refreshToken)});
    s.setItem('userId', ${JSON.stringify(p.userId)});
    s.setItem('userRole', ${JSON.stringify(p.userRole)});
    s.setItem('jwtRole', ${JSON.stringify(p.jwtRole)});
    s.setItem('activeView', ${JSON.stringify(p.activeView)});
    s.setItem('userName', ${JSON.stringify(p.userName)});
    s.setItem('companyName', ${JSON.stringify(p.companyName)});
    s.setItem('language', ${JSON.stringify(p.language)});
  }catch(e){}})();
true;`;
}

/**
 * JS string for re-injection via `ref.injectJavaScript`. Calls the web-defined
 * `window.__gbSetAuth(obj)`, which overwrites the localStorage auth keys. Safe
 * whether called before or after the web registers the function (guarded).
 */
export function buildSetAuthCall(payload: WebAuthPayload): string {
  return `window.__gbSetAuth && window.__gbSetAuth(${JSON.stringify(payload)}); true;`;
}

/**
 * JS string that clears the web auth keys via `window.__gbClearAuth()` (used on
 * native logout). Guarded so it's a no-op if the web hasn't defined it yet.
 */
export function buildClearAuthCall(): string {
  return `window.__gbClearAuth && window.__gbClearAuth(); true;`;
}
