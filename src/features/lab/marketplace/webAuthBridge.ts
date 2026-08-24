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

/**
 * Guest guard for the embedded marketplace.
 *
 * ⛔ THE PROBLEM THIS SOLVES, observed on the emulator 2026-08-24:
 * a guest tapping "Message Seller" on a listing got the WEBSITE's own modal —
 * **"Sign In / Company Email / company@yourcompany.com"** — rendered inside the
 * app. Three things wrong with that:
 *
 *   1. It is a BUSINESS login form. "Company Email" is the exact shape App
 *      Review rejected 1.0.3 (19) for under Guideline 3.1.1 ("account
 *      registration feature for businesses and organizations"). We removed our
 *      native business form; the WebView was quietly putting one back.
 *   2. It is a SECOND login, with different fields, in an app that already has
 *      one. Parallel account systems are a defect in their own right.
 *   3. It collects credentials in an embedded browser, and the session it makes
 *      is not the session the app holds.
 *
 * `onShouldStartLoadWithRequest` cannot catch it: the modal is in-page UI, not a
 * navigation, so `navPolicy` never sees it. Hence a click interceptor plus a
 * MutationObserver, injected only when there is NO session.
 *
 * ⚠️ This is the SAFETY NET, not the real fix. The site already knows it is
 * embedded (every URL carries `?app=1`) and already posts `message-seller` to
 * the app for signed-in users. The correct fix is for it to post
 * `auth-required` instead of opening its modal when `app=1` and no token — then
 * this DOM-coupled script becomes redundant. Until then it stays, because
 * without it a missed control shows a guest a company login.
 */
export function buildGuestGuardJS(): string {
  return `(function(){try{
    if (window.__gbGuestGuard) return true;
    window.__gbGuestGuard = true;

    var post = function(action){
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'auth-required', action: action || 'message'
        }));
      } catch(e){}
    };

    // Controls that need an identity. Matched on the visible TEXT of the nearest
    // BUTTON/LINK -- product copy changes far less often than class names.
    var GATED = [
      { re: /message\s*seller/i,                          action: 'message' },
      { re: /make\s*offer/i,                              action: 'offer'   },
      { re: /buy\s*now/i,                                 action: 'offer'   },
      { re: /place\s*bid|^bid$/i,                         action: 'offer'   },
      { re: /add to favourites|add to favorites|^watch$/i, action: 'want'    }
    ];

    // ⛔ FIRST ATTEMPT MISSED "Make Offer" (emulator, 2026-08-24): it walked
    // up 4 parents reading innerText, and an ancestor's text was longer than the
    // 40-char cutoff, so nothing matched and the site's modal opened. Use
    // closest() to land on the actual control, then read only ITS OWN text.
    // ⛔ 'click' ALONE IS TOO LATE. On the emulator the interceptor was still
    // missing "Make Offer": the modal appeared and the observer had to hide it,
    // which is why the prompt said "message" instead of "offer". React opens the
    // dialog from a POINTERDOWN/MOUSEDOWN handler, which fires before click, so a
    // click-only capture arrives after the modal already exists. Intercepting the
    // earlier events is what actually stops it being created.
    var handler = function(ev){
      try {
        var el = ev.target && ev.target.closest
          ? ev.target.closest('button, a, [role="button"], input[type="submit"]')
          : null;
        if (!el) return;
        var txt = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!txt) txt = (el.getAttribute('aria-label') || '').trim();
        if (!txt) return;
        for (var g = 0; g < GATED.length; g++) {
          if (GATED[g].re.test(txt)) {
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
            post(GATED[g].action);
            return;
          }
        }
      } catch(e){}
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(function(t){
      document.addEventListener(t, handler, true);
    });

    // Safety net for anything the interceptor misses. Keyed on "Company Email",
    // which is the Guideline 3.1.1 exposure itself.
    //
    // ⛔ The first version tried to CLICK the modal's close button and failed
    // -- the X is an icon with no matching text or aria-label, so the modal stayed
    // on screen underneath our native sheet. Walk up from the label to the
    // dialog root and hide it instead: deterministic, and needs no cooperation
    // from the site's markup.
    var hideAuthModal = function(){
      try {
        var labels = document.querySelectorAll('label, span, div, h1, h2, h3, p');
        for (var i = 0; i < labels.length; i++) {
          var t = (labels[i].textContent || '').trim();
          if (!/^company email$/i.test(t)) continue;
          var n = labels[i];
          for (var up = 0; up < 12 && n; up++) {
            var cs = window.getComputedStyle(n);
            var isOverlay = n.getAttribute('role') === 'dialog' ||
                            cs.position === 'fixed' ||
                            (n.className && /modal|dialog|overlay|backdrop/i.test(String(n.className)));
            if (isOverlay && n !== document.body) { n.style.display = 'none'; return true; }
            n = n.parentElement;
          }
          // No overlay ancestor found: hide the label's own block as a last resort.
          if (labels[i].parentElement) labels[i].parentElement.style.display = 'none';
          return true;
        }
      } catch(e){}
      return false;
    };

    var busy = false;
    var obs = new MutationObserver(function(){
      try {
        if (busy) return;
        var body = document.body ? (document.body.innerText || '') : '';
        if (!/company email/i.test(body)) return;
        busy = true;
        if (hideAuthModal()) post('message');
        setTimeout(function(){ busy = false; }, 1200);
      } catch(e){}
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }catch(e){} return true;})();`;
}
