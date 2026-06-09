# Smart-Detect v2 (SSE) — Mobile Integration Plan

Owner: mobile
Status: **P0–P4 implemented + unit-tested behind the flag (default OFF); P5 manual smoke + rollout pending.** See §8 implementation log.
Backend companion: `101recycle-greenbidz-backend/docs/SMART_DETECT_V2_SSE_PLAN.md` (endpoint shipped, pending deploy)
Endpoint: `POST /api/v1/wp/analyze-smart-detection-v2` (SSE)

---

## 0. Guiding principle — swap the transport, keep everything else

The backend's `result` SSE event is **byte-identical to the v1 JSON response** (verified during the backend review: top-level `suggested_terms`, 3-key `detection`, same `products`/`merged_single`/`image_urls`/`document_pages`). Therefore:

> The v2 stream resolves to the **exact same `MappedSmartDetection`** that `useSmartDetect` returns today. Everything downstream of the mutation — `processing.tsx`'s `onSuccess`, `applySmartDetection`, `shouldSkipDetectionChoice`, routing to `scanDetail` / `scanDetection` / `scanGroupedReview`, every review screen — is **untouched**.

What v2 adds:
- Real-time progress (stage / detection / product events) to replace the fake step-walk timer.
- Better cancellation (client disconnect aborts in-flight AI server-side — hardened in the backend).
- No 120 s axios blocking timeout; the backend's 5-min deadline + 15 s heartbeats govern instead.

v1 stays as the **flag-off fallback**. Flipping the flag off reverts instantly with zero other code change.

### Flag matrix — v2 is orthogonal to the existing `SMART_DETECT_ENABLED`

`SMART_DETECT_ENABLED` (existing) decides *whether smart-detect runs at all* on a single-mode scan; `SMART_DETECT_V2_ENABLED` (new) decides *which transport* it uses. They compose:

| `SMART_DETECT_ENABLED` (`EXPO_PUBLIC_SMART_DETECT`) | `SMART_DETECT_V2_ENABLED` (`EXPO_PUBLIC_SMART_DETECT_V2`) | Behavior |
| --- | --- | --- |
| `0` | (any) | Neither — legacy listing-method / `analyze-process-images` flow (unchanged) |
| `1` (default) | `0` (default) | **v1** blocking POST (current prod default) |
| `1` | `1` | **v2** SSE stream |

So v2 is reachable only when smart-detect is already on; turning v2 off falls straight back to v1.

> **Web note (revised post-implementation):** the original plan excluded web (`Platform.OS !== 'web'`) on the assumption v2 needed `fetch` response-body streaming. That was wrong — `react-native-sse` is **XHR-based** and streams `text/event-stream` fine in browsers (verified: zero RN-only imports). The web guard has been **removed**; v2 runs wherever the flag is on, including Expo web. (Cross-origin SSE on web still needs the backend's `cors()` to allow the web origin — same as the v1 POST.)

### What we are NOT changing
- The GCS upload pipeline in `useSmartDetect` (`uploadGcsPhotos` / `uploadGcsDocuments` / `mergeGcs`) — reused verbatim.
- `mapSmartDetection`, `smartDetectionTypes`, `applySmartDetection`, the store, the detection/detail/grouped screens.
- The v1 service (`smartDetect.ts`) — left intact as the fallback path.

---

## 1. Current state (as-is)

| Concern | Where | Note |
| --- | --- | --- |
| Call site | `app/scan/processing.tsx:266` | `smartRef.current.mutate({ photos, documents, language, signal })` |
| Hook | `src/features/scanner/useSmartDetect.ts` | uploads to GCS → `smartDetectFromUrls(...)` → mapped result via `useMutation` |
| v1 transport | `src/services/scanner/smartDetect.ts` | `greenbidz.post('/wp/analyze-smart-detection', body)` (axios, 120 s) |
| Final mapper | `src/features/scanner/mapSmartDetection.ts` | `mapSmartDetection(res, getSiteType())` |
| API client | `src/api/greenbidzClient.ts` + `interceptors.ts` | baseURL = `extra.GREENBIDZ_API_URL`; auth via interceptor |
| Auth headers | `interceptors.ts:13-19` | `Authorization: Bearer <secure access>`, `x-refresh-token`, plus `x-platform` / `x-system-key` from client defaults |
| Flag | `src/lib/flags.ts` | `SMART_DETECT_ENABLED` (v1 on/off) |
| Progress UI | `processing.tsx:185-215` | **fake** 1.8 s `setInterval` step-walk (not real progress) |

**SSE clients:** none installed today (`react-native-sse` and `@microsoft/fetch-event-source` both absent). RN's `fetch` cannot stream a response body, so `fetch-event-source` is out — we use `react-native-sse` (XHR `responseText` incremental reader; supports POST + headers + body).

---

## 2. Phase overview

| Phase | Scope | Outcome | Risk |
| --- | --- | --- | --- |
| **P0** | Add dep + flag + types | `react-native-sse` installed; `SMART_DETECT_V2_ENABLED` (default off); SSE event types | none (inert) |
| **P1** | SSE transport service | `smartDetectStream()` resolves to `MappedSmartDetection`, parity with v1 | isolated, unit-tested |
| **P2** | Hook branch | `useSmartDetect` calls v2 when flag on; GCS upload unchanged; mutation surface unchanged | low |
| **P3** | Real progress UI | `processing.tsx` 4-step loader driven by live events (replaces fake timer) | UI only, flag-gated |
| **P4** | Cancellation + watchdog + errors | abort closes stream; pre-stream 400/429 + fatal/non-fatal handled; dead-socket watchdog | low |
| **P5** | Tests + staged rollout | unit + manual smoke; dev-build flag → staged enable | — |

Each phase is independently shippable behind the flag. P1–P2 give a working end-to-end v2 even before P3's UI polish.

---

## 3. Phase detail

### P0 — Dependency, flag, types

- `npm i react-native-sse` (native autolink; no native config beyond a rebuild of the dev client — note the stale dev-client caveat in repo memory). **Pin the exact version** in `package.json` (not `^`): this lib's "don't reconnect" switch and its `error` event field shape differ across versions (see P1 step 5/7), so the behavior we test against must be the behavior we ship.
- `src/lib/flags.ts`:
  ```ts
  /** v2 SSE smart-detection. Opt-in; default OFF. Parallels backend SMART_DETECT_V2_ENABLED. */
  export const SMART_DETECT_V2_ENABLED = process.env.EXPO_PUBLIC_SMART_DETECT_V2 === '1';
  ```
- New `src/features/scanner/smartDetectStreamTypes.ts` — typed event payloads mirroring backend §3 taxonomy:
  ```ts
  export type StagePhase =
    | 'validating' | 'preparing_pdfs' | 'ai_running' | 'extracting_products' | 'done';
  export type StageEvent     = { phase: StagePhase; message?: string; total?: number; current?: number; ts?: number };
  export type DetectionEvent = { suggested_mode: 'single' | 'multiple'; confidence: number; summary: string; product_count: number };
  export type ProductEvent   = { index: number; id?: string | number; data: unknown | null; image_indexes: number[]; document_indexes: number[]; error?: { code: string; message: string } };
  export type PdfPagesEvent  = { documentIndex: number; pages: { index: number; page: number; url: string; width: number; height: number }[] };
  export type StreamError    = { fatal: boolean; code: string; message: string; retriable?: boolean; context?: unknown };
  export type SmartStreamEvent =
    | { type: 'stage'; data: StageEvent }
    | { type: 'detection'; data: DetectionEvent }
    | { type: 'product'; data: ProductEvent }
    | { type: 'pdf_pages'; data: PdfPagesEvent }
    | { type: 'error'; data: StreamError };
  ```

### P1 — SSE transport (`src/services/scanner/smartDetectStream.ts`)

Mirrors `smartDetectFromUrls` but streams. Signature:

```ts
export async function smartDetectStream(
  imageUrls: string[],
  language: string,
  signal: AbortSignal | undefined,
  documentUrls: string[] | undefined,
  sellerId: number | string | undefined,
  onEvent?: (e: SmartStreamEvent) => void,
): Promise<MappedSmartDetection>
```

Responsibilities:
1. **URL**: `${extra.GREENBIDZ_API_URL}/wp/analyze-smart-detection-v2` (same baseURL axios uses — already includes `/api/v1`).
2. **Headers — replicate the axios interceptor manually** (SSE bypasses interceptors):
   - `Authorization: Bearer ${await getSecureItem('auth.accessToken')}`
   - `x-refresh-token: ${await getSecureItem('auth.refreshToken')}`
   - `x-platform` + optional `x-system-key` (from `Constants.expoConfig.extra`)
   - `Accept: text/event-stream`, `Content-Type: application/json`
3. **Body**: identical to v1 — `{ image_urls, document_urls?, language: toAnalyzeLanguage(language), sellerId? }` (`image_urls` always sent, even `[]` on docs-only).
4. **Open**: `new EventSource(url, { method: 'POST', headers, body: JSON.stringify(body), pollingInterval: 0 })`. `pollingInterval: 0` is the *intended* "do not reconnect" switch, **but it is version-dependent** — some `react-native-sse` versions keep an internal retry loop until listeners are removed. So treat no-reconnect as a two-part contract: pass `pollingInterval: 0` **and** call `es.removeAllEventListeners()` + `es.close()` inside `settle()` (step 8). P5 asserts "after a fatal close, no second connection attempt" so a flaky network can't trigger a silent second AI run.
5. **Listen via NAMED `addEventListener`, not `onmessage`.** The backend emits `event: stage\ndata: …` framed events — `onmessage`/the default `message` handler only fires for frames with **no** `event:` line, so it would never see ours. Register one named listener each:
   ```ts
   for (const name of ['stage','pdf_pages','detection','product','result','error']) {
     es.addEventListener(name, (ev) => handle(name, ev));
   }
   es.addEventListener('open', ...);   // connection established — dev-only console log for observability, no-op in prod
   es.addEventListener('error', ...);  // lib-level transport error (see step 7)
   ```
   `heartbeat` frames only need to reset the watchdog (P4) — no UI, no `onEvent`. Forward every *real* event to `onEvent` for the UI, but **wrap the call**: `try { onEvent?.(parsed); } catch (uiErr) { if (__DEV__) console.warn(…, uiErr); }` — a bug in the UI handler must never poison the AI run already in flight. (Log channel: `console.warn` in dev until Sentry/Datadog is wired.)
6. **Resolve** on `result`: `mapSmartDetection(JSON.parse(ev.data), getSiteType())` — the same mapper v1 uses.
7. **Reject** on:
   - `error` event with `fatal: true` → `new Error(data.message)` (carry `code`/`retriable`).
   - **Lib transport error** (the lib's own `error` event). Two sub-cases, pinned to the chosen version's field names in P1 and mocked in P5:
     - **Pre-stream non-200 (400/429):** the error event carries the HTTP status and the JSON body — in current `react-native-sse` that's `event.xhrStatus` + `event.xhr?.responseText` (parse `responseText` for the localized `message`; 429 = per-seller cap). Do **not** assume the field name — pin it against the installed version.
     - **Transport dropout (`xhrStatus === 0`):** Wi-Fi↔cellular handoff or radio sleep. Treated as **fatal/terminal** — there is no resume (`Last-Event-ID` deferred per backend §12), so the user retries from scratch. Reject with a "connection lost" message.
   - Watchdog (P4).
8. **`settle()` contract — resolve XOR reject, exactly once.** A single `settled` flag guards *both* paths. If a fatal `error` arrives after some `product` events but before `result`, we reject — and a later `result` (network race / lib quirk) must be ignored, not resolve. `settle()` also: clears the watchdog timer (P4), removes the abort listener, calls `es.removeAllEventListeners()` + `es.close()`. Runs exactly once.
   - **Cancellation, incl. already-aborted:** `addEventListener('abort', …)` does **not** fire if the signal is already aborted when we attach. So check synchronously *before* opening the ES — `if (signal?.aborted) return Promise.reject(abortError);` — then register `signal.addEventListener('abort', () => settle(reject, abortError))`, then re-check `if (signal.aborted) settle(reject, abortError)` to close the tiny attach-race window (consumer aborts between open and listener registration, e.g. a `useEffect` cleanup race).

> Mapping uses **only the `result` event** for correctness (it already contains the full `products`). The intermediate `product` events are for live UX, not for assembling the result — keeps parity exact and the mapper unchanged.

### P2 — Hook branch (`useSmartDetect.ts`)

- Keep the entire GCS upload block as-is.
- Accept an optional `onEvent` in the `mutate` variables and thread it down.
- Final call swaps on a single predicate (so future toggles — remote config, % rollout — live in one place):
  ```ts
  // src/features/scanner/smartDetectV2Enabled.ts
  // NB: plain function, NOT a hook — so it is NOT named `use*` (the
  // react-hooks/rules-of-hooks lint reserves the `use` prefix for hooks).
  // Promote to a `useSmartDetectV2Enabled()` hook later only if a
  // remote-config / A-B source needs React state.
  export const smartDetectV2Enabled = () =>
    SMART_DETECT_V2_ENABLED && Platform.OS !== 'web';
  ```
  ```ts
  return smartDetectV2Enabled()
    ? smartDetectStream(imageUrls, language, signal, documentUrls, sellerId, onEvent)
    : smartDetectFromUrls(imageUrls, language, signal, documentUrls, sellerId);
  ```
- Mutation still resolves to `MappedSmartDetection` → **`onSuccess` in `processing.tsx` is unchanged**.
- Web guard: `react-native-sse` targets native; web falls back to v1.
- **Parity guarantee, tested in P5:** the v2 mutation result must be deep-equal to the v1 result for the same fixture. The whole synthetic-PDF-page path in `processing.tsx`'s `onSuccess` keys off `mapped.responseImageUrls.length > photos.length` and `mapped.documentPages` — these come straight from the identical `result` payload, so it works by construction, but a one-line `expect(v2Result).toEqual(v1Result)` test pins it against silent regression.

### P3 — Real progress UI (`processing.tsx`)

- Add local state: `const [stream, setStream] = useState<{ phase?: StagePhase; productsDone: number; productTotal?: number }>(...)`. The handler sets `productTotal` from the `detection` event's `product_count`, and **increments `productsDone` on each `product` event** (`productsDone: prev.productsDone + 1`) — that counter drives the "k/N" sub-label.
- Pass `onEvent` into `smartRef.current.mutate({ ..., onEvent: handleStreamEvent })`.
- `handleStreamEvent` maps events → the **existing** 4-step indicator (no new visuals this pass):
  | Event | UI effect |
  | --- | --- |
  | `stage: validating / preparing_pdfs / ai_running(detecting)` | step 0 active |
  | `detection` | step 1 complete; capture `product_count` |
  | `product` (each) | step 2 active; sub-label "analyzing product {productsDone}/{productTotal}" |
  | `stage: done` | step 3 complete |
  | non-fatal `error` | optional toast/sub-note; keep going |
- When v2 is active, drive `currentStep` from real events and **stop the fake `setInterval` step-walk** (`processing.tsx:200-215`) from *advancing* steps. v1 path keeps the timer.
- **Avoid a frozen-looking screen between concrete events.** The AI detection pass can run ~5 s with no event between `ai_running` and `detection`. Do **not** simply kill all motion — keep the active step looking alive with a generic localized sub-label (e.g. "Analyzing…") and the existing pulse/laser animation while waiting for the next concrete event. (Deliberate choice: a rotating sub-label, **not** re-introducing a step-advancing timer — real steps only advance on real events.)
- `heartbeat` events produce **zero visible feedback** — they reset the watchdog only. Otherwise the UI would flicker every 15 s.
- Everything else on the screen (gear, laser, error layout, navigation) stays identical.

### P4 — Cancellation, errors, watchdog

- **Abort**: `processing.tsx` already builds `controller` and returns `controller.abort()` in cleanup. `smartDetectStream` closes the ES on abort → backend aborts in-flight AI (hardened server-side). Nothing new needed in the screen.
- **Pre-stream 400 / 429** → reject → existing error layout. 429 shows "too many analyses" copy; the message comes localized from the backend.
- **Fatal `error`** → reject; **non-fatal** (`pdf_fetch_failed`, `gcs_upload_failed`, one product failed) → forward to `onEvent`, keep streaming; final `result` still resolves with the partial set.
- **Transport dropout** (lib `error` with `xhrStatus === 0`, e.g. Wi-Fi↔cellular handoff) → fatal/terminal, no resume (see P1 step 7).
- **Watchdog** (client-side dead-socket guard): a timer **reset on every event (incl. `heartbeat`)** and **cleared in `settle()`** so it can never fire into an already-closed transport. If silent for **~45 s** (heartbeat is 15 s), `settle(reject, "connection lost")` (which closes the ES). Backstops a half-open socket the OS hasn't torn down. Complements — doesn't duplicate — the backend's 5-min deadline (different failure mode: backend hang vs. client half-open socket).

### P5 — Tests + rollout

- **Capture the fixture now** (before code): save the backend 2-product PDF curl run as `__tests__/fixtures/smartDetectStream.zh-hant.txt` (raw `event:`/`data:` frames). The unit test replays it frame-by-frame — bit-exact regression coverage for free, and it's the canonical reference for the named-event + parsing work in P1.
- **Unit** (`__tests__/smartDetectStream.test.ts`): inject a fake `EventSource`; replay the captured fixture → assert it resolves to a `MappedSmartDetection` **deep-equal to `mapSmartDetection`** on the equivalent v1 body (`expect(v2Result).toEqual(v1Result)`).
  > Not a tautology: both paths end at `mapSmartDetection(resultPayload, siteType)`, so this passes **by construction** — *unless* the streaming side accidentally reconstructs the result from intermediate `product`/`detection` events instead of the `result` event. That regression is exactly what this asserts (it enforces the "result-only mapping" rule from P1). A maintainer tempted to delete it as trivial should read this note first.

  Cases:
  - fatal `error` event rejects;
  - **pre-stream 429** with the pinned field shape (`xhrStatus: 429`, body in the pinned property) → rejects with the backend's localized "too many concurrent" message (guards against the user seeing a generic "Smart detection failed");
  - **transport dropout** (`xhrStatus: 0`) → rejects "connection lost";
  - abort → `settle(reject)` + ES closed;
  - watchdog fires after silence, then is **cleared** so a late event/timer is a no-op;
  - non-fatal events forwarded to `onEvent` but the stream still resolves on `result`;
  - **no reconnect after fatal:** assert the fake `EventSource` records exactly one connection attempt across a fatal-close (proves `pollingInterval: 0` + `removeAllEventListeners()` actually stop the retry loop → no second AI run);
  - a **throwing `onEvent`** does not reject the stream (UI bug isolation).
- **Manual**: flag on in a dev build; run (a) photo-only, (b) PDF-only, (c) mixed against staging. Confirm progressive steps and **identical** final detail/grouped screens vs v1.
- **Rollout**: `EXPO_PUBLIC_SMART_DETECT_V2` off in prod; on in dev/QA builds → staged enable. v1 is the zero-risk fallback.

> **How to enable v2 on a device (QA):** set `EXPO_PUBLIC_SMART_DETECT_V2=1` in `.env`, then **restart Metro** (`EXPO_PUBLIC_*` is inlined at bundle time, so a hot reload won't pick up the flag change — you need a fresh bundle). `react-native-sse` is **pure JS** (XHR-based), so **no dev-client rebuild is required for this feature** — a Metro restart is enough. (`.env.example` documents the flag.) A dev-client rebuild is only needed for unrelated native modules, e.g. the expo-location/expo-camera fixes this project already had pending.

---

## 4. Risks / open questions

- **Dev client:** `react-native-sse` is pure JS — **no rebuild needed for it** (Metro reload suffices). A rebuild was still done for the unrelated expo-location/expo-camera native fixes the project had pending; bundling them was convenient but not required by this feature.
- **Expo web:** `react-native-sse` is native-only; web path falls back to v1 (guarded in P2).
- **Token lifetime vs 5-min stream:** the token is read once at ES open. A long stream could outlive it, but it's a single request; a 401 at open rejects → user retries. Acceptable; revisit only if observed.
- **`getSiteType()` / `x-platform` parity:** must match v1 so category matching is identical — reuse the same source (`buildFormData.getSiteType()` + client `x-platform`).
- **`react-native-sse` POST + non-200:** ~~open question~~ → **committed to P5.** The exact `error`-event field carrying the HTTP status/body is pinned against the installed version (P1 step 7) and covered by the mocked-XHR 429 test in P5.

---

## 5. File checklist

**New**
- `src/services/scanner/smartDetectStream.ts`
- `src/features/scanner/smartDetectStreamTypes.ts`
- `src/features/scanner/smartDetectV2Enabled.ts` (single predicate: flag + platform; plain fn, not a `use*` hook)
- `__tests__/smartDetectStream.test.ts`
- `__tests__/fixtures/smartDetectStream.zh-hant.txt` (captured backend stream — capture in P5)

**Changed**
- `package.json` (+ `react-native-sse`, **pinned version**)
- `src/lib/flags.ts` (+ `SMART_DETECT_V2_ENABLED`)
- `src/features/scanner/useSmartDetect.ts` (flag branch + `onEvent` passthrough)
- `app/scan/processing.tsx` (event-driven progress; stop fake step-advance when v2 on, keep an "Analyzing…" sub-label)

---

## 6. Review notes folded in (round 1)

Reviewer pass against this plan; all addressed above.

**Substantive**
1. **Named `addEventListener`, not `onmessage`** — backend frames carry `event:` lines, so `onmessage` never fires. Made explicit in P1 step 5.
2. **`pollingInterval: 0` is version-dependent** — reconnect is now a two-part contract (`pollingInterval: 0` + `removeAllEventListeners()` in `settle()`), version pinned in P0, and P5 asserts no second connection after fatal close.
3. **`onEvent` wrapped in try/catch** in the transport — a UI-handler bug can't poison the in-flight AI run (P1 step 5).
4. **Network dropout mid-stream** — lib `error` with `xhrStatus === 0` treated as fatal/terminal; no resume (Last-Event-ID deferred). P1 step 7 + P4.
5. **Pre-stream 400/429 parsing pinned** — exact `react-native-sse` error field (`xhrStatus` + body location) pinned against the installed version; P5 mocks it so the 429 copy actually surfaces.

**Cleanup**
6. **`settle()` = resolve XOR reject, exactly once** — one `settled` flag guards both; a late `result` after a fatal reject is ignored (P1 step 8).
7. **Watchdog cleared in `settle()`**, not just reset on events — can't fire into a closed transport (P4).
8. **Heartbeats reset the watchdog only — zero UI** — no 15 s flicker (P3, P4).

**Low / nits**
9. **v2 result deep-equals v1** asserted in P5 — pins the synthetic-PDF-page path that keys off `responseImageUrls`/`documentPages`.
10. **Don't freeze the screen** between concrete events — keep an "Analyzing…" sub-label + pulse rather than killing motion or re-adding a step-advancing timer (P3).
11. **Capture the backend smoke fixture now** as `__tests__/fixtures/…` for bit-exact replay (P5).
12. **`useSmartDetectV2Enabled()` predicate** — single home for flag + platform + future remote-config/% rollout (P2).

**Kept verbatim (right as-is):** result-only mapping; v1 untouched as instant-rollback fallback; Last-Event-ID deferral; 4-step UI ↔ 5-phase enum collapse; 5-min backend deadline vs. 45 s client watchdog as complementary guards.

## 7. Review notes folded in (round 2)

Second reviewer pass against the round-1 revision; all addressed above.

**Substantive**
1. **Already-aborted signal:** `addEventListener('abort', …)` doesn't fire if the signal is already aborted at attach time. P1 step 8 now checks `signal?.aborted` synchronously before opening the ES and re-checks right after registering the listener (closes the `useEffect`-cleanup attach race).
2. **Flag orthogonality:** added a truth table in §0 for `SMART_DETECT_ENABLED` × `SMART_DETECT_V2_ENABLED` (off → neither; on/off → v1; on/on → v2; web → always v1).
3. **Predicate `use*` naming:** renamed `useSmartDetectV2Enabled.ts` → `smartDetectV2Enabled.ts` (plain fn, not a hook — avoids `react-hooks/rules-of-hooks`). Promote to a hook only if remote-config/A-B state is later needed.

**Cleanup / nits**
4. **§4 risk dedup:** the "POST + non-200" open question is now marked resolved → committed to the P5 mocked-XHR 429 test.
5. **`addEventListener('open')`:** clarified as dev-only connection-established log, no-op in prod (free debugging signal, not left empty).
6. **`productsDone` counter:** P3 now states the handler sets `productTotal` from `detection.product_count` and increments `productsDone` per `product` event — the source of the "k/N" sub-label.
7. **Deep-equals isn't a tautology:** P5 now explains the test enforces the result-only mapping rule (passes by construction unless the stream reconstructs the result from intermediate events) — so a maintainer doesn't delete it as trivial.

## 8. Implementation log

### Status by phase
- **P0 — done.** `react-native-sse` pinned at **`1.2.1`** (exact, no `^`); `SMART_DETECT_V2_ENABLED` flag added (default OFF); `smartDetectStreamTypes.ts` created.
- **P1 — done.** `smartDetectStream.ts` transport + `smartDetectV2Enabled.ts` predicate; fixture + 12-case unit test, all green.
- **P2 — done.** `useSmartDetect` branches on `smartDetectV2Enabled()` (seller URL-mode path only; no-seller multipart + web + flag-off stay v1); `onEvent` threaded through `mutate`.
- **P3 — done.** `processing.tsx` drives the existing 4-step loader from real `stage`/`detection`/`product` events; fake timer disabled under v2; live "k/N" sub-label on the extracting step.
- **P4 — done (covered by P1 tests + existing screen abort).** Cancellation: `processing.tsx`'s `controller.abort()` → `signal` → transport closes the ES; watchdog + full error matrix unit-tested.
- **P5 — pending.** Unit tests landed; **manual on-device smoke + staged rollout still to do**. (No rebuild required for this feature — react-native-sse is pure JS; just restart Metro with the flag on. A fresh dev-client build was done anyway for unrelated native fixes.)

### Files
**New:** `src/services/scanner/smartDetectStream.ts`, `src/features/scanner/smartDetectStreamTypes.ts`, `src/features/scanner/smartDetectV2Enabled.ts`, `src/services/scanner/__tests__/smartDetectStream.test.ts`, `src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt`.
**Changed:** `package.json` (+`react-native-sse@1.2.1`), `src/lib/flags.ts`, `src/features/scanner/useSmartDetect.ts`, `app/scan/processing.tsx`.

### `react-native-sse@1.2.1` contract (verified against source — corrects two plan assumptions)
1. **HTTP-error body is on `event.message`, NOT `event.xhr.responseText`.** The plan (P1 step 7) hedged on the field; in 1.2.1 a non-200 dispatches `{ type:'error', message: xhr.responseText, xhrStatus, xhrState }`. So the pre-stream 400/429 JSON body is parsed from `event.message`. (Implemented + unit-tested with the real field.)
2. **Backend `event: error` frames AND lib transport errors both fire the `'error'` listener.** `'error'` is a built-in event name, and the lib's SSE parser dispatches our `event: error` frames there too. Disambiguated by `typeof ev.data === 'string'` (backend SSE frame) vs `ev.xhrStatus`/`ev.message` (transport). The `'error'` listener also receives `{ type:'timeout' }` and `{ type:'exception' }`.
3. **`pollingInterval: 0` genuinely stops auto-reconnect** — the lib's `_pollAgain(0, false)` guard (`time > 0 || allowZero`) fails, so no reconnect after a DONE/error. We also `removeAllEventListeners()` + `close()` in `settle()`. (No second AI run.)
4. **Default `timeout: 0`** → no client request timeout; we rely on the backend's 5-min deadline + the 45 s heartbeat watchdog.

### Tests
- `smartDetectStream.test.ts` — **12/12**: fixture-replay deep-equals v1 `mapSmartDetection` (result-only mapping), product completion order [1,0], fatal error, non-fatal continues, pre-stream 429 parsed message, transport dropout, timeout, abort-closes-ES, already-aborted (no open), watchdog fires, throwing `onEvent` isolated, single-cleanup + late-event ignored.
- Full scanner suite **91/91**; `tsc --noEmit` clean on all touched files.

### Round-3 review reconciliation (post-implementation)
- **#1 abort-listener kept reference + `removeEventListener`** — already in the shipped transport (`const onAbort = …`; added on open, removed in `cleanup()`). No leak.
- **#2 "already aborted at attach time" test** — already present (`rejects synchronously if the signal is already aborted (ES never opened)`, asserts the factory is never called).
- **#3 `onEvent` catch log channel** — folded: now `console.warn` in `__DEV__` (was a silent swallow). Placeholder until Sentry/Datadog.
- **#4 fixture language** — already zh-hant (the captured smoke was `language:"zh"`); filename matches content. No rename needed.
- **#5 env-var names in the §0 matrix** — folded (`EXPO_PUBLIC_SMART_DETECT` / `EXPO_PUBLIC_SMART_DETECT_V2` now shown).
- **§4 strikethrough** — left as-is for now (review-diff aid); delete on a later cleanup pass.

### Round-4 change — web guard removed (post-implementation)
Local web testing surfaced that v2 never fired in the browser. Root cause: the `Platform.OS !== 'web'` guard in `smartDetectV2Enabled()`, premised on the (false) belief that v2 needs `fetch` response-body streaming. `react-native-sse` is **XHR-based** and streams `text/event-stream` incrementally in browsers (lib has no RN-only imports). **Fix:** `smartDetectV2Enabled()` is now just `SMART_DETECT_V2_ENABLED` — v2 runs on web too. Caveat: cross-origin SSE on web relies on the backend `cors()` allowing the web origin (same requirement as the v1 POST, which already works locally).

### Remaining for P5
1. **No rebuild needed for v2** — `react-native-sse` is pure JS; a Metro restart with `EXPO_PUBLIC_SMART_DETECT_V2=1` is enough. (A fresh `npx expo run:android` build was run for the unrelated expo-location/expo-camera native fixes — done now.)
2. **Manual smoke** — set `EXPO_PUBLIC_SMART_DETECT_V2=1`, run photo-only / PDF-only / mixed against staging; confirm progressive steps + identical detail/grouped screens vs v1.
3. **Staged rollout** — keep OFF in prod; dev/QA builds opt in. v1 instant-rollback by flag.
4. **(Optional, deferred)** P3 phase-2 per-product thumbnails; remote-config source behind `smartDetectV2Enabled()`.

**Unchanged (reused)**
- `mapSmartDetection.ts`, `smartDetectionTypes.ts`, `applySmartDetection.ts`, `scanDraftStore.ts`
- `uploadGcsPhotos.ts`, `gcsUrl.ts`, `smartDetect.ts` (v1 fallback)
- all detection / detail / grouped review screens
