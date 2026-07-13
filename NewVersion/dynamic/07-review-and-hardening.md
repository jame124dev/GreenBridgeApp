# Bulletproof Review & Hardening — Mobile Dynamic Plan

> Audit of `00`–`06` in this folder: what's **missing**, what **can break**, and where the **UX is weaker than it should be** — with ready-to-merge fixes for the confirmed gaps.
>
> **Method note (be honest):** the planned 28-agent adversarial audit could not run — the account hit its session usage limit. This pass was done manually via coverage analysis (topic-by-topic grep across all 7 docs) + spot-checks against the real repos and the sibling docs. The three gaps in §2 are **confirmed by absence/thinness in the docs**; the correctness watch-items in §3 are carried from the authoring-review corrections. A full line-by-line adversarial audit should still be re-run after the limit resets (see §5).

---

## 1. Verdict summary

| Doc | Verdict | Note |
|---|---|---|
| 00-overview | solid | Architecture + phases sound. Index must add this doc + deep-link/push. |
| 01-chat-architecture | solid, one thin spot | Stream **lifecycle/cancellation** needs to be a shared-hook guarantee, not implied. |
| 02-action-component-catalog | solid | Every real `data`-frame/tool has a mobile renderer. No orphan actions found. |
| 03-api-contract | gaps | No **push-token registration** endpoint; **deep-link** targets undocumented. |
| 04-mobile-integration-plan | gaps | Cancellation only covered on Processing; not generalized. No notif→screen routing. |
| 05-mobile-ux | solid | Strong UX depth (skeletons, reduced-motion, a11y, scroll-to-bottom). Missing notification UX. |
| 06-roadmap-risks | gaps | Push + deep links only named in passing; not a phase with scope/exit criteria. |

**Well-covered (verified present — NOT gaps):** JWT token refresh, offline/flaky-network, i18n (zh/ja/th), reduced-motion, accessibility labels, scroll-to-bottom + typing indicator, 429/rate-limit + backoff, pagination, optimistic sends + rollback.

---

## 2. Confirmed gaps (missing / thin) — with fixes

### GAP-1 — Deep links are entirely absent (highest priority)
**Why it breaks the product:** the core promise is *"we only ping you when there's a real match."* That ping must open the exact **Match Detail** or **Deal Room**. Zero `Linking`/scheme/route-target design exists across all 7 docs. Without it, push notifications and the "3 new matches" badge have nowhere to land.

**Fix — add to `03-api-contract.md` (client routing) + `04-mobile-integration-plan.md`:**
- App scheme is **already configured**: `scheme: 'greenbridge'` (`app.config.ts:7`), package/bundle `com.greenbidz.bridge`. So `greenbridge://…` links work today; what's missing is the **route map, cold/warm handling, and HTTPS App Links / Universal Links** against the lab domain for tap-through from the WTB digest emails.
- Expo Router is file-based, so URL→route is automatic; define the canonical link map:
  | Intent | Deep link | Resolves to |
  |---|---|---|
  | New match | `greenbridge://lab/match/:id` | `app/(lab)/match/[id].tsx` |
  | New bid / deal msg | `greenbridge://lab/deal/:id` | `app/(lab)/deal/[id].tsx` |
  | Match center | `greenbridge://lab/matches` | `app/(lab)/(tabs)/matches.tsx` |
- Handle **cold-start** (`Linking.getInitialURL()` — route after auth hydration + `IS_CUSTOMER` fork resolves, else the link is dropped) **and warm** (`Linking.addEventListener`). Gate: if not authed → stash the target, run auth, then replay.
- Guard against forks: a `customer` deep link that arrives in a `seller` build must no-op gracefully (route to seller home), not crash.

### GAP-2 — Push notifications are named but not designed
**Why it matters:** `expo-notifications` is already in the stack, but there's no token registration, permission flow, alert taxonomy, or foreground/background handling. For a match-driven marketplace this is a feature, not a footnote. Backend already dispatches WTB match notifications (`greenbidz-ai-assistant/app/wtb/dispatch.py` + `providers.py`, currently email/Node) — a **push channel** slots into that existing pipeline.

**Fix — add a "Notifications" section to `03`, `04`, `06`:**
- **Registration:** on login (customer), request permission **after the first meaningful action** (not on cold launch — higher opt-in), get the Expo push token, `POST` it to a **new Node endpoint** (`/api/v2/notifications/register` — *does not exist yet; backend work, flag in 06*) keyed to the user + `X-Site-Type: labgreenbidz`.
- **Alert taxonomy:** `new_match` (WTB match ≥ notify threshold — reuse the existing `dispatch` eligibility ≥0.8), `new_bid`, `deal_message`, `handoff_reply`. Each carries `{ type, id }` for the deep link in GAP-1.
- **Handling:** foreground → in-app toast (`sonner-native`) + increment the FrostedTabBar Matches/Deals badge (today it's static `STATIC_BADGES.matches=3` — wire to a store/query). Background tap → deep link. Android needs a notification **channel** set up at init.
- **Server side (06 dependency):** add a `push` provider alongside the email/Node providers in `app/wtb/providers.py`, or have Node fan out to Expo Push on the events it already emits. No new mobile dep beyond `expo-notifications` (already present) — but **needs a dev-client rebuild** to activate native push.

### GAP-3 — Stream lifecycle/cancellation is per-screen, not guaranteed
**Why it can break:** only [04-mobile-integration-plan.md:386](04-mobile-integration-plan.md#L386) covers abort (Processing screen). The chat surface, detect flow, and any long-lived SSE need the **same contract** or you get orphan AI runs (server keeps generating), memory leaks, and duplicate streams when the user re-sends.

> **Verification note (a finding I initially got wrong, then corrected):** `smartDetectStream.ts` **does exist** — at `src/services/scanner/smartDetectStream.ts` (10.7KB, with tests), NOT `src/features/scanner/`, where a first check mistakenly looked. **The citations in 01/03/04 are correct — do not change them.** The transport lives in `smartDetectStream.ts`; the wrapping hook `useSmartDetect.ts:55` takes an `AbortSignal`, so cancellation is **signal-based**. The genuine (minor) gap is only that teardown is documented **per-screen** (Processing) rather than **guaranteed by the shared hook** for every streaming surface.

**Fix — promote to a shared-hook guarantee in `01` + `04`:** the shared SSE/chat hook (built on the real `smartDetectStream.ts` transport + an `AbortSignal`) MUST:
1. Attach auth headers **at stream open** — `react-native-sse` bypasses the axios interceptors, so the Bearer/`X-Refresh-Token`/`x-platform` headers must be set on the `EventSource` config directly (already flagged in 01 — make it the hook's responsibility, not each caller's).
2. **Cancel on unmount AND on screen blur** — `useFocusEffect` cleanup + `useEffect` return both trigger the `AbortController` (the seller hook already takes a `signal`); the `EventSource` is closed in the abort handler. Navigating away from a streaming screen must not leave the socket open.
3. **Single-flight per conversation** — a new user turn aborts the previous in-flight stream before opening the next (no interleaved token streams).
4. **Heartbeat watchdog** — if no `heartbeat`/`token` frame in N seconds, close and surface a "reconnect" affordance (don't hang on a dead socket).
5. **Idempotent on remount** — restoring `conversation_id` from MMKV must not replay a completed stream.

---

## 3. Correctness watch-items (fixed once — re-verify at build)
These were corrected during the authoring review and are the items most likely to silently break if reintroduced from the prototype/spec text:
- **Mode mapping:** composer `sell`/`buy` → assistant `seller`/`buyer` (never send raw `buy` in the body → mis-routing).
- **Seller tool name** is `get_seller_summary` (not `get_seller_activity`).
- **`/detect/stream` `stage`** frame is `{ phase, message?, total?, cur? }` — not a fabricated stage-name string.
- **`x-platform` header** value is the literal `LabGreenbidz`.
- **`AI_BASE_URL`** for the assistant surface must be added to `src/lib/env.ts` (today it only knows `GREENBIDZ_API_URL` / `X_SYSTEM_KEY` / `WEB_APP_URL`).
- **Writes go through conversational turns** (publish = literal `CONFIRM CREATE`); the mobile client never mints service JWTs.
- **Flag-gated features return 404**, not an error frame — the client must treat 404 on `/wtb`/detect as "feature off," not "crash."
- ~~Phantom module citation~~ **RETRACTED:** `smartDetectStream.ts` exists at `src/services/scanner/` (verified) — the 01/03/04 citations are correct. (An earlier check looked in the wrong dir.)

---

## 4. UX watch-items (mostly covered — keep honest at build)
- **Per-token re-render jank:** stream into a single ref-backed text node / batch with `requestAnimationFrame`, not `setState` per token, or long messages drop frames. (05 mentions stream-first paint — make the batching explicit.)
- **Autoscroll vs user scroll:** only auto-stick to bottom when the user is already near the bottom; otherwise show the "jump to latest" pill (05 covers this — verify the threshold logic in build).
- **Card entrance animations must not re-fire** as later stream frames patch the same card in place (replace-in-place, keyed by card id — 02 notes this; enforce in the renderer).
- **Notification UX (new):** permission priming screen, foreground toast style, badge wiring — currently undocumented (ties to GAP-2).

---

## 5. Next actions
1. **Apply GAP-1/2/3 fixes** into `03`, `04`, `06` (+ the lifecycle guarantee into `01`), and add this doc + a "Notifications & Deep Links" row to the `00-overview.md` index.
2. **Re-run the full 28-agent adversarial audit after the session-limit reset (3:30 pm Asia/Calcutta)** for the line-by-line correctness pass this manual review could not complete — then fold any confirmed findings here.
3. Only then start **P0** (shared data layer: `AI_BASE_URL` + auth interceptor + the lifecycle-correct SSE hook), since GAP-3 lives in that hook.
