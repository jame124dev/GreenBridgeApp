# Hardening Addendum — Deep Links, Push Notifications & Stream Lifecycle

> Promotes the three confirmed gaps from [`07-review-and-hardening.md`](07-review-and-hardening.md) into build-ready design. Read alongside [`03-api-contract.md`](03-api-contract.md), [`04-mobile-integration-plan.md`](04-mobile-integration-plan.md), and [`06-roadmap-risks.md`](06-roadmap-risks.md).
>
> All facts here are verified against the repo: scheme `greenbridge` (`app.config.ts:7`), package/bundle `com.greenbidz.bridge`, `expo-notifications ~56.0.13` already installed, and the backend WTB dispatch pipeline (`greenbidz-ai-assistant/app/wtb/dispatch.py` + `providers.py`).

---

## A. Deep Links (GAP-1)

**Why:** the product promise is *"we only ping you when there's a real match."* A push/email must open the exact Match Detail or Deal Room. The app scheme is already set, so links resolve today; the missing pieces are the route map, cold/warm handling, and HTTPS App/Universal Links for email tap-through.

### A.1 Scheme & link map
- Scheme: **`greenbridge://`** (`app.config.ts:7`). Expo Router is file-based, so URL → route is automatic once the path matches an `app/(lab)/…` file.
- HTTPS App Links (Android) / Universal Links (iOS): register the lab domain so WTB **digest emails** (already sent server-side) open the app instead of the browser.

| Intent | Deep link | Resolves to |
|---|---|---|
| New match | `greenbridge://lab/match/:id` | `app/(lab)/match/[id].tsx` |
| New bid / deal message | `greenbridge://lab/deal/:id` | `app/(lab)/deal/[id].tsx` |
| Match center | `greenbridge://lab/matches` | `app/(lab)/(tabs)/matches.tsx` |

### A.2 Resolution rules (the part that breaks if skipped)
- **Cold start:** `Linking.getInitialURL()` — but do **not** route until (a) auth is hydrated and (b) the `IS_CUSTOMER` fork has resolved, or the link is dropped on a race. Stash the target, finish auth, then `router.replace` to it.
- **Warm:** `Linking.addEventListener('url', …)` while the app is foregrounded/backgrounded.
- **Unauthed:** stash target → run login → replay after `authStore` hydrates.
- **Wrong fork:** a `customer` link arriving in a `seller` build must **no-op gracefully** (route to seller home), never crash. Guard on `IS_CUSTOMER`.
- **Unknown/stale id:** the target screen must handle a 404 from its fetch with an empty/error state (don't assume the id is still live).

> Add the link map to `03-api-contract.md` and the resolution rules to `04-mobile-integration-plan.md`'s shared data-layer section.

---

## B. Push Notifications (GAP-2)

**Why:** `expo-notifications` is in the stack but undesigned. For a match-driven marketplace, the alert *is* the product loop. The backend already computes notify-eligible matches (`app/wtb/dispatch.py`, eligibility ≥ 0.8) and fans out via providers — a **push provider** slots into that existing pipeline; no new matching logic.

### B.1 Client
- **Permission priming:** request permission **after the first meaningful action** (e.g. first listing published or first want saved), not on cold launch — materially higher opt-in. Show a one-line primer screen before the OS prompt.
- **Token registration:** on grant, get the Expo push token and `POST` to a **new Node endpoint** `POST /api/v2/notifications/register` *(does not exist yet — backend work, tracked in `06`)*, body `{ token, platform: 'expo', deviceId }`, auth = Bearer + `X-Site-Type: labgreenbidz`. De-register / refresh on token rotation and logout.
- **Android channel:** create a `matches` channel at init (`expo-notifications` `setNotificationChannelAsync`) — Android drops notifications without one.
- **Foreground handler:** `sonner-native` toast + increment the FrostedTabBar badge. Today the badge is static `STATIC_BADGES.matches = 3` (`src/features/lab/components/tabConfig.ts`) — wire it to a store/query so it reflects real unread counts.
- **Background tap:** payload `{ type, id }` → deep link from §A.

### B.2 Alert taxonomy
| Type | Fires when | Deep link |
|---|---|---|
| `new_match` | WTB match ≥ notify threshold (reuse dispatch eligibility ≥ 0.8) | `…/lab/match/:id` |
| `new_bid` | Bid placed on the user's listing | `…/lab/deal/:id` (or listing) |
| `deal_message` | Counterparty/concierge replies in a deal | `…/lab/deal/:id` |
| `handoff_reply` | Live-agent (Zoho Desk) responds | current deal/chat |

### B.3 Server dependency (for `06` roadmap)
Add a **push provider** alongside the email/Node providers in `app/wtb/providers.py` (or have Node fan out to Expo Push on the events it already emits). Needs the `/notifications/register` store on Node. **Activating native push requires a dev-client rebuild** (`npx expo run:android`).

---

## C. Stream Lifecycle Contract (GAP-3)

**Why:** cancellation is real and correct (`src/services/scanner/smartDetectStream.ts` transport + `useSmartDetect.ts:55` `AbortSignal`) but documented only for the Processing screen. Every streaming surface (chat, detect, any long SSE) needs the **same guarantees**, or you get orphan server AI runs, leaked sockets, and interleaved token streams on re-send.

The shared hook (`useLabChatStream` / `useLabStream` in `04`/`06`) MUST guarantee — not leave to each caller:
1. **Auth at open** — `react-native-sse` bypasses axios interceptors, so Bearer + `x-refresh-token` + `x-platform: LabGreenbidz` are set on the `EventSource` config directly (pattern already in `smartDetectStream.ts:104-121`).
2. **Cancel on unmount AND on screen blur** — `useFocusEffect` cleanup + `useEffect` return both fire the `AbortController` (the seller hook already accepts a `signal`); the abort handler closes the `EventSource`.
3. **Single-flight per conversation** — a new user turn aborts the previous in-flight stream before opening the next (no interleaved token streams).
4. **Heartbeat watchdog** — reuse the seller's ~45s no-frame watchdog (`DEFAULT_WATCHDOG_MS`, reset on `heartbeat`); on trip, close and surface a Retry affordance (§5/`05-mobile-ux.md`), never hang.
5. **Idempotent on remount** — restoring `conversation_id` from MMKV must not replay a completed stream.

> Fold guarantees 2–5 into `04-mobile-integration-plan.md` §1.5 (the `useLabChatStream` spec) so they're the hook's contract, not per-screen boilerplate.

---

## D. Corrections folded back
- Retracted the false "phantom module" claim — `smartDetectStream.ts` exists at `src/services/scanner/`; 01/03/04 citations are correct.
- Deep-link scheme is **already configured** (`greenbridge`), so §A is route-map + lifecycle work, not scheme setup.

## E. Roadmap impact (for `06`)
Add a phase (suggest **P4.5**, after deal-room realtime, before P5 polish): **Notifications & Deep Links** — client push registration + permission priming + Android channel + deep-link resolver + badge wiring; server `/notifications/register` + WTB push provider. Exit criteria: a real `new_match` push on a physical device opens Match Detail via deep link, cold and warm.
