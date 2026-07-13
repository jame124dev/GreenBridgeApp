# 11 — Marketplace: adapt the web buyer-marketplace into the app (Browse tab)

**Status:** IMPLEMENTED (code-complete, both repos, local/uncommitted) via the
marketplace-webview workflow — mobile tsc clean, cross-repo contract verified. Not built,
not deployed. Needs: `npx expo run:android` (WebView native dep) + web push to 101lab.co.
**Decision (confirmed):** hybrid WebView. The **Browse** tab embeds the live Next.js
buyer-marketplace instead of rebuilding the auction/offer/bidding stack natively.
Two forks were chosen: **(a) embedded `?app=1` mode added on the web**, and
**(b) native auth token injected into the WebView** (auto-login, no second sign-in).

---

## Why WebView, not native

The web marketplace is a full transactional auction surface, not a catalog. Live audit
of `https://101lab.co/buyer-marketplace` on a 390-wide mobile viewport found:

- **List:** Available Batches grid — photo, LIVE/ENDED badge, days-left, lot #, country
  flag, category, title.
- **Filters drawer:** Categories + subcategories, Bid Status (Closing Soon / Upcoming /
  Ended / Custom Date), Country (8), Condition (6), Brand (searchable, ~40).
- **Per card:** ♥ favourite · Make Offer (or live price e.g. `$2,500`) · View.
- **Detail (`/buyer-marketplace/[id]`):** gallery, Bid Type (Fixed Price / auction),
  Price + Qty, **Buy Now**, **Make Offer**, Buyer Premium %, Taxes, Seller T&C,
  **Message Seller**, Share, Add to Favourites, location + Open in Maps, Core Specs,
  Key Features, Logistics (rigging/loading/shipping/packaging), Terms, Privacy,
  "More from this category".

Rebuilding bidding + offers + buy-now + buyer-premium + logistics + T&C natively is a
multi-week effort that forks the web team's business logic. Since the web is the **same
team's Next.js app** (`nextjs-port`, currently live on 101lab.co), embedding it is the
right v1 call. The app stays native where it differentiates (AI Home, My Wants,
Messages) and leans on the web for the marketplace.

---

## Repos & facts (verified)

| Thing | Location |
|---|---|
| Mobile app | `GreenBridgeApp` (Expo SDK 56, expo-router, dev-client) |
| Browse tab (today) | `app/(lab)/(tabs)/browse.tsx` — a `LabPlaceholder` stub |
| Web frontend | `nextjs-port` (Next 14 app-router) — branch `feat/lab101-detect-ux-gating`; live on 101lab.co |
| Marketplace page | `nextjs-port/app/buyer-marketplace/page.tsx` → `@/features/marketplace/pages/Marketplace` |
| `react-native-webview` | **NOT installed** — needs add + dev-client rebuild |

### Auth session contract (this is what makes the handoff clean)

Web reads its session from **`localStorage`** (`src/features/auth/pages/Auth.tsx`):

| Web localStorage key | Mobile source |
|---|---|
| `accessToken` | SecureStore `auth.accessToken` |
| `refreshToken` | SecureStore `auth.refreshToken` |
| `userId` | MMKV `auth.userId` |
| `userRole`, `jwtRole`, `activeView` | `auth.profile.role` (buyer) |
| `userName` | `auth.profile.name` |
| `companyName` | `auth.profile.company` |

1:1 mapping — the app already stores every field.

---

## The 4 problems and the fix for each

### 1. Auth bridge → auto-login (chosen: inject native token)
Before the page's own JS runs, inject the mapped keys into `localStorage` via
`injectedJavaScriptBeforeContentLoaded`. Read the 4 stored values natively
(`getSecureItem` ×2 + `mmkv.getString` ×2), JSON-escape, write the 8 web keys, then load.
Re-inject on token refresh. On native logout, post a message so the WebView clears them.

> Security note: this is the **production** buyer session. The token is written only into
> the app's own WebView localStorage (not logged, not sent anywhere new). No behaviour
> change to Buy Now / Make Offer — they hit the same prod endpoints the browser does.

### 2. Strip web chrome (chosen: embedded `?app=1` mode on web)
App loads `…/buyer-marketplace?app=1`. On the web, an embedded flag (read from the query
param, persisted to a context/localStorage so it survives client-side nav) hides:
site **Header**, **Footer**, **newsletter** block; and removes the top/bottom page padding
those added. The Filters button, card grid, pagination, and detail page stay. Robust
across web redeploys (unlike app-side CSS injection).

### 3. One chat system, not two (Message Seller → native Messages)
"Message Seller" on the web must **not** open the web chat — it must open the **native
Deals thread** we already built (Socket.io). In embedded mode, the web's Message-Seller
handler calls `window.ReactNativeWebView.postMessage({type:'message-seller', batchId,
sellerId, sellerName})` instead of navigating. The app's `onMessage` routes to
`/(lab)/deal/[id]`. (Same bridge can later surface offer-success / favourite toasts.)

### 4. Native dependency + rebuild
`react-native-webview` requires a native build. Fold it into the **same
`npx expo run:android` dev-client rebuild** the Scan flow already needs (expo-camera /
expo-location) so it's one rebuild, not two.

---

## Build plan

### A. Web (`nextjs-port`) — embedded mode
1. Add an "embedded" signal: read `?app=1` (client), persist to
   `sessionStorage`/context so it holds through client nav; expose `useEmbedded()`.
2. In the marketplace + batch-detail layouts, conditionally **omit Header / Footer /
   newsletter** and their spacer padding when embedded.
3. In embedded mode, route **Message Seller** through `ReactNativeWebView.postMessage`
   (guarded: no-op if the bridge is absent, so the web still works in a normal browser).
4. QA in a desktop browser at `?app=1` (chrome hidden, grid/detail intact) before shipping.

### B. Mobile (`GreenBridgeApp`)
1. `npx expo add react-native-webview` (+ the run:android rebuild).
2. Rewrite `app/(lab)/(tabs)/browse.tsx`:
   - `<WebView source={{ uri: MARKETPLACE_URL + '?app=1' }} />`
   - `injectedJavaScriptBeforeContentLoaded` = built from the mapped auth keys.
   - `onMessage` → parse bridge events → `router.push('/(lab)/deal/[id]', …)` for
     `message-seller`.
   - Android hardware back → WebView `goBack()` when history exists (else default).
   - Native **loading skeleton** while first paint lands; **pull-to-refresh**;
     safe-area **bottom padding** so content clears the FrostedTabBar.
   - Error state (offline / load fail) with Retry.
3. `MARKETPLACE_URL` in `lib/env.ts` (defaults to `https://101lab.co`, override for dev).
4. Re-inject auth on focus / after token refresh; clear on logout.

### C. Verify (emulator, live)
- Cold-boot emulator with DNS (per ops notes), one clean `CI=1 expo start --clear`.
- Browse tab: chrome-stripped grid renders; Filters drawer works; pagination works.
- Auth: open a listing → **Add to Favourites / Make Offer** shows *logged-in* (no login
  wall) — **do not submit a real offer/buy on prod**; stop at the authed state.
- Message Seller → lands in the **native** Deals thread for that seller.
- Back button walks WebView history, then exits tab.

---

## Scope / non-goals (v1)
- Browse tab only. Home, My Wants, Messages, Account stay native.
- No native re-skin of cards inside the WebView (it's the web UI, chrome-stripped).
- Deep-linking a native **Matches → "View details"** into this WebView detail page is a
  possible follow-up (unifies with the existing native match detail); not in v1.
- Offer/Buy/Favourite all run the web's existing prod flows — no new payment code.

## Review addendum — gaps found (reviewer / mobile eng / UI-UX)

Grounded against the code: web auth is header-from-`localStorage` (injection works,
`apiSlice.ts:164/302`, `axiosInstance.ts:22`); `seller_id` is present on batch detail
(`BuyerBatchDetails.tsx:101`); "Message Seller" currently opens the web `BuyerBatchChat`
— which is exactly what the bridge replaces. Add these to the build:

**Correctness / risk**
- **Token-refresh ownership** — injected `accessToken` expires. Web owns refresh in-view
  (reads localStorage per request); add a `401`→`postMessage` that asks native to
  re-inject a fresh token, and re-inject on tab focus. Avoid native/web token divergence.
- **External-link allowlist** — `onShouldStartLoadWithRequest`: keep `101lab.co` in-view;
  send Open-in-Maps / LinkedIn / `mailto:` / `tel:` / GCS / payment redirects to the
  system browser via `Linking`; block `target=_blank` new windows.
- **Unauthenticated dead-end** — chrome-stripped page has no login button. Confirm `(lab)`
  tabs are always behind native login; route a `401`-in-WebView to the native login.
- **Embedded flag persistence** — `?page=`/category links drop `?app=1`. Set embedded once
  into `sessionStorage`/context on entry; prefer detecting the app via a custom
  **User-Agent suffix** (`applicationNameForUserAgent`) over a losable query param.

**Mobile engineering**
- **Inject-before-content Android gotcha** — writing `localStorage` before origin exists
  can throw; try/catch, same-origin, `domStorageEnabled`, and **gate WebView mount until
  async SecureStore/MMKV reads resolve** (else no token at inject time).
- **Native top bar / top safe-area** — Browse has `headerShown:false` + web header stripped
  → content under the notch. Add a native Browse header + top inset (plan only had bottom).
- **Android pull-to-refresh** — RN WebView `pullToRefreshEnabled` is iOS-only; Android
  needs a RefreshControl wrapper that fights scroll. iOS-first or drop.
- **WebView config** — `originWhitelist`, `setSupportMultipleWindows(false)`,
  `thirdPartyCookiesEnabled`, UA suffix; install via `npx expo install react-native-webview`.

**UI / UX**
- **Filters FAB vs tab bar** — the web's fixed bottom-center Filters button sits under the
  FrostedTabBar; native padding can't move a fixed element → embedded mode must **lift the
  FAB** above tab-bar height (pass tab-bar/safe-area height in via UA/param).
- **Skeleton mimics the card grid**, not a spinner.
- **Locale sync** — inject a `language` key so the web (en/zh/ja/th) follows app i18n.

**Process**
- **QA without prod writes** — offers/Buy-Now write to prod. Verify whether 101lab-dev's
  marketplace API writes to the test backend before pointing `MARKETPLACE_URL` there for
  offer testing; otherwise stop at the authed state and never submit a real offer.

## Open items to confirm before building
- **Web branch/deploy:** embedded mode lands on `feat/lab101-detect-ux-gating`? And the
  usual deploy path (push → GH Actions → rebuild) applies to 101lab.co?
- **Message Seller data:** the web batch-detail must expose `sellerId` for the bridge —
  confirm it's available there (the native WTB snapshot still lacks it, tracked separately).
