# Phase 4 — App: the actual unlock, behind confirmation

**Tasks:** M-3 (routing chip + marketplace sheet) · M-4 (all three locks + two guards) ·
M-6 (consume the routing signal) · M-12 (server-driven supported-marketplaces list)
**Parent plan:** `../MULTI_MARKETPLACE_PLAN.md` §2, §4, §5, §6, §7 (Stage 1)
**Target release:** app **1.0.4** (a store binary — **no OTA**, see §0.3)
**Environment:** DEV only — `https://testapi.greenbidz.com`, DB `greenbidz_test`

Everything below was re-verified against the working trees on 2026-08-18. Where the parent plan's
`file:line` had drifted, the corrected reference is inline and repeated in §12.

---

## 0. Read this before you touch anything

### 0.1 Tree state you must not disturb

| Tree | HEAD | Branch | Uncommitted |
|---|---|---|---|
| `GreenBridgeApp/` | **`45abb39`** | `feat/app-store-account-deletion` | only `Docs/multi-marketplace/` (untracked) — `git status --porcelain \| wc -l` = **1** |
| `101recycle-greenbidz-backend/` | **`8383b62`** | **`fix/seller-gate-existing-sellers`** | **27 entries** — 8 modified (`controller/chatController.js`, `controller/wordPress.js`, `controller/wordPressGroupedSubmit.js`, `controller/wordPressSmart.js`, `middleware/chatAccess.js`, `routes/chatRoute.js`, `routes/wpProductRoutes.js`, `socket/socket.js`) + 19 untracked. **None of it is yours.** |

Verified with `git log --oneline -6` + `git status --short` in both trees.

**⚠️ PHASE 5 HAS LANDED. Every line reference in this document was re-verified against `45abb39`
on 2026-08-18, AFTER Phase 5 committed.** The app tree moved from `11ef609` to `45abb39` while this
document was being revised — three commits, exactly the app track's Phase 5:

```
45abb39 fix(scan): M-5/M-10 — the profit card stops inventing numbers
dbe6c4f feat(scan): M-8/M-9/M-11 — the footer says what is missing, and Submit answers
c490428 fix(scan): M-7 — no schema-required field can block Submit invisibly
11ef609 feat(1.0.3): GreenBidz branding, notification/badge/version fixes, …   ← the old baseline
```

What that means for you, all four confirmed by reading the tree rather than the commit messages:

- **Step 1-5's checks (a), (b) and (c) already pass.** `MARKETPLACE_OPTIONS` has `description`
  (`constants.ts:49-58`, entries `:53-56`); all six locales have
  `mobile.detail.marketplaceOption.<value>.description`; `DetailFooter.tsx:110` is
  `disabled={!!submitting}` for single mode (grouped stays `disabled={!allRequired}` at `:74`, `:85`,
  `:91`); `missingPhotos` exists at `useDetailController.ts:180-185`; `rowForPath` is exported at
  `requiredStatus.ts:47`.
- **Phase 5 left you a written seam.** `useDetailController.ts:187-200` is a comment block addressed to
  Phase 4 by name, telling you to add `missingRouting()` mirroring `missingPhotos()` and to call it
  immediately after `if (missingPhotos()) return;` (`:203`). Step 8-10 is that, spelled out.
- **Step 1-5 check (d) still FAILS.** `Sheet.tsx` has no `keyboardShouldPersistTaps` — **Phase 3 has not
  landed.** M-1 (the recycle tree) and M-2 (the searchable picker) are therefore still open, which keeps
  `101recycle` out of the server list (§2) and keeps §14's before-merge table live.
- **`CategoryConditionCard.tsx:203` now reads `required ai`** (M-10's badge). This phase does not touch
  that file; the reference is here only so you do not mistake it for drift.

Line references in this document that MOVED because of Phase 5, and are already corrected inline:
`constants.ts` `:40-48`→**`:49-58`**, `:70-72`→**`:80-82`**, `:116-130`→**`:126-140`** ·
`detail.tsx` `:109`→**`:114`**, `:127`→**`:136`**, `:129`→**`:141`**, `:148`→**`:186`** ·
`useDetailController.ts` `:44-45`→**`:55-56`**, `:51-55`→**`:62-66`**, `:57-64`→**`:69-76`**,
`:66-70`→**`:78-82`**, `:94`→**`:202`**, `:16`→**`:22`** ·
`formMapping.ts` `:53`→**`:78`**, `:91`→**`:133`** ·
`grouped-review.tsx` `:100`→**`:101`**, `:158`→**`:159`**, `:498`→**`:499`**, and the `missingLabel` IIFE
`:542-567`→**`:543-552`** (Phase 5 replaced its private `labelForKey` switch with `useRequiredRowLabel`,
exactly as integration §3 predicted) ·
`DetailFooter.tsx` `:117`→**`:110`** · locale line counts **+17 each** (see §10).

Line references that did **not** move, re-checked one by one: `scanDraftStore.ts` `:64`, `:108`, `:159`,
`:214`, `:293`, `:369`, `:413`, `:711-719`, `:795-809`, `:850`, `:862` · `MarketplaceCard.tsx` `:22`,
`:29` · `processing.tsx` `:113`, `:481`, `:504-508`, `:518-520`, `:527` · `mapSmartDetection.ts` `:152`,
`:157`, `:188`, `:209`, `:225`, `:231`, `:250`, `:258-261` · `mapAnalyze.ts` `:53`, `:100` ·
`smartDetectionTypes.ts` `:37`, `:84`, `:125` · `schema.ts` `:23`, `:57` · `buildFormData.ts` `:18`,
`:34-38`, `:161`, `:164`, `:223-224`, `:270`, `:271`, `:290-293` · `Sheet.tsx` `:53`, `:110`, `:141`,
`:203` · `CategoryConditionCard.tsx` `:46-47`, `:124`, `:157`, `:166-169`, `:204-206`, `:212`, `:268` ·
`grouped-edit.tsx` `:58`, `:61`, `:67`, `:70-73`, `:217`, `:219` · `_layout.tsx` `:44`, `:149-158`,
`:179`, `:186` · `en.json:3702` (`mobile.detail`), `:3805` (`profitIntelligence`).

- **The backend is NOT on `main`, and PHASE 1 HAS LANDED ON IT.** HEAD is now `8383b62`, two commits
  past the old `aabac85` baseline:
  ```
  8383b62 S0-2: emit site_type_confidence + site_type_source per product
  eb073fb S0-1: inferSiteTypeFromProduct may only override on identity fields
  aabac85 feat(seller): let a seller edit their own published listing   ← the old baseline
  ```
  Its 27 uncommitted entries are the chat IDOR fix, socket auth, the AI-description fix and other
  people's scratch. **No commit, no push, no branch switch, no stash, no reset, no clean** in either
  tree. **You make NO backend edit at all** — integration C12 gives §7A to the server engineer (§7).
- **S0-2 changes what this phase receives.** See §0.4, which has been rewritten: the two fields this
  document previously described as "not on the wire" now **are**.
- Other engineers are landing sibling phases. If a file you are about to edit already contains a
  change you did not make, stop and re-read it rather than overwriting.

### 0.2 DEV endpoint — mandatory, and you must restore it

`GreenBridgeApp/.env` currently holds **production**:

```
GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
```

`.env` is **gitignored** (`.gitignore:34`), so a bad edit is **not recoverable from git** — an
earlier session left it on a `localhost` URL and it had to be restored from a file backup. Therefore:

1. **Back it up first** (§4, Step 1-1). Do not skip this. **Two fixed paths, both OUTSIDE the repo:**
   `C:/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical` (integration C9's shared
   copy, taken once for the whole programme, never rotated, **never deleted** — four other phases may be
   relying on it) and `C:/Users/Pc/AppData/Local/Temp/claude/.env.backup.phase4` (yours).
   ⚠️ **Not next to `.env`.** `.gitignore:34` ignores the literal name `.env` and `.env*.local` — it does
   **not** ignore `.env.backup.phase4`, so a backup written inside `GreenBridgeApp/` shows up as untracked
   and can be swept into someone else's commit. Verified today with `git check-ignore -v`.
2. Point it at dev for all of this work.
3. **Restore it** at the end (§11, Step **V-10**) and prove the restore with a `diff` against the backup
   **and** an empty `git diff --stat -- .env`. Note that `git diff -- .env` is empty whether or not you
   restored, precisely because it is gitignored — the `diff` against the backup is the real check.

Dev base URL re-verified read-only today: `GET https://testapi.greenbidz.com/api/v1/product/lab/category?language=en`
→ **HTTP 200**, envelope `{"success":true,"message":…,"data":[…]}`; `GET …/api/v1/mobile-config` → **404**
(the route does not exist yet — §7A is the server engineer's, integration C12). `/product/machines/category`
and `/product/it/category` also **200** on dev.

**No production write, no prod deploy, no prod migration.** Nothing in this phase needs prod. And this
phase makes **no server change at all** — the one new endpoint (§7A) belongs to the server engineer.

### 0.3 No OTA while 1.0.3 is in review

`app.config.ts:34` → `version: '1.0.3'` (re-confirmed today); `app.config.ts:90-92` →
`runtimeVersion: { policy: 'appVersion' }`. An EAS Update published for 1.0.3 would reach the binary Apple
is testing right now. **Do not run `eas update` — and do not run `eas build` or `eas submit` either.** This
phase is delivered as source on a feature branch and ships inside the 1.0.4 binary. Local verification is
Metro + emulator only (V-0, V-5 … V-9).

### 0.4 The one rule this phase can most easily break

**v1 ships "always confirm" — there is no numeric confidence threshold.** That rule is unchanged. What
changed on 2026-08-18 is *why* it is now easy to break.

#### ⚠️ S0-2 HAS LANDED. `site_type_confidence` and `site_type_source` ARE on the wire.

The earlier text of this section said they were not, and built three arguments on that. It is now false.
Verified in the backend working tree at `8383b62`:

- `buildRoutingSignal` — a new **pure** function at `controller/wordPressSmart.js:1987-2013` — computes
  `{ site_type, site_type_confidence, site_type_source }`.
- `processProductGroup` stamps **all three** per product: `data.site_type = siteType` at
  **`:2054`**, then `data.site_type_confidence = routingSignal.site_type_confidence` and
  `data.site_type_source = routingSignal.site_type_source` at **`:2125-2126`**.
- `site_type_confidence` is rounded to 2 dp (`:2011`) and clamped to `[0,1]` (`:1990-1993`), defaulting
  to `0.75` when the model gave nothing.
- The `site_type_source` enum on the wire is exactly the four values this phase's `RoutingSource` type
  declares — `'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback'` — set at `:1701`,
  `:1712`, `:1726`, `:1731` and `:2000`. **No app-side type change is needed** (§2 already matches).
- `low_confidence_fallback` caps the confidence at `REGEX_OVERRIDE_CONFIDENCE` (`:2004-2007`), and
  `regex_override` sets it (`:1998-2001`) — so integration **G3**'s contract
  (`source ∈ {regex_override, low_confidence_fallback} ⇒ confidence ≤ 0.5`) is structural, not luck.

**Three consequences you must plan for, none of which the old text anticipated:**

1. **The confidence line in `RoutingChip` will actually render.** Step 9-3 gates it on
   `state.confidence != null`, and it is no longer always null. Its three-band display words
   (`confHigh` ≥ 0.85, `confMedium` ≥ 0.6, `confLow`) go live on the first scan. That is fine and
   intended — it is a **display** of a number the server sent — but it means the i18n keys
   `routing.confidence` / `confHigh` / `confMedium` / `confLow` are now **user-visible in v1**, not
   dormant. Translate them properly (§10); do not treat them as future-proofing.
2. **The ask state now has three live triggers, not one.** `needs_clearer_photo` (37.5% of products,
   integration C8) **plus** `regex_override` **plus** `low_confidence_fallback`. Integration **G4** —
   "write the `site_type_source` distribution down before any app lock flips" — is therefore no longer a
   courtesy. If `regex_override + low_confidence_fallback` clears 20% of products, the combined ask rate
   goes past ~50% and that is an owner escalation, not an implementation detail.
3. **The no-threshold rule is now breakable.** Previously a threshold would have compared against
   `null` and done nothing, so the rule was self-enforcing. Now a `state.confidence > 0.8` written
   anywhere in a branch would silently work, on real numbers, and would be the one thing parent plan
   §2.1 forbids — because it would be calibrated on **zero** logged agreement observations.

**So: the code you write in M-6 CARRIES `site_type_confidence` and never compares it to anything, except
to choose a display word.** The tests that enforce that are Step 6-6's
`a low confidence number alone does NOT change any mapped field`, Step 6-8's
`the confidence NUMBER alone never flips the trigger` and `the confidence NUMBER alone never changes the
state`. All three now exercise a live field rather than a permanent `null`, which makes them *more*
valuable than when they were written.

#### The v1 ask-trigger set

**`needs_clearer_photo`** — live, per product, zero backend change needed. Stamped for every product at
`controller/wordPressSmart.js:828-829` (drifted from `:818-819`):

```js
  const modelSaysUnsure = data.needs_clearer_photo === true;
  data.needs_clearer_photo = modelSaysUnsure || (!data.brand && !data.model);
```

inside `normalizeIdentityAndConfidence` (`:820`), called from the attribute-extraction path at
**`:1915`** (was `:1869`), which `processProductGroup` (**`:2016`**, was `:1922`) runs for every product.
Measured **true on 27 of 72 products = 37.5%** across the recorded DEV runs (integration C8's
re-measurement; this document's earlier "9/24 photos" figure is the same data counted per photo).
Deterministic per photo — never 1 or 2 of 3 runs — and concentrated on **machines (M2–M5) and recycle
(R1–R4)**, i.e. exactly the two marketplaces in `CATEGORY_UNTRUSTED`. It has **zero** references in
`src/` and `app/` today.

**`regex_override` / `low_confidence_fallback`** — now live via S0-2, as above.

**`category_source` is still NOT on the wire.** Grepped today: no `category_source` in
`controller/wordPressSmart.js` or `services/smartExtractionValidator.js`. It arrives with **Phase 2's
S0-3a**, which has not landed. So `signalFromDraft(...).categorySource` reads `null`, and the §0.5
category clear is driven entirely by `CATEGORY_UNTRUSTED` until then. Integration C6 still governs its
enum when it does arrive: `'ai' | 'fuzzy' | 'unresolved'`.

**The old `recycle`-means-unsure behaviour is also still live**, because Phase 2 (S0-3b) has not landed:
`services/smartExtractionValidator.js:326-336` returns `siteType: "recycle"` for an off-list type and
`:339-345` returns `siteType: "recycle"` for `confidence < 0.6`, and `detectSiteTypeForGroup`'s catch
(`:1660-1665`) returns `recycle` with `confidence: 0`. Combined with `low_confidence_fallback`, that
means a genuinely-unsure item shows up as **`101recycle` + ask**, and `101recycle` is withheld from the
server list until M-1 (§2) — so `pickAppliedMarketplace` will discard it and the chip will ask, which is
the correct outcome. Do not "fix" it here.

### 0.5 OWNER DECISION — APPROVED 2026-08-18 (do not re-open)

> **When the AI routes an item to 101MACHINE or 101RECYCLE, the app must NOT pre-fill the AI's
> category guess as though it were an answer. Clear it and make the seller choose.**

This is the `prefillCategory === false` half of parent plan §2.2 row 3 / M-3, and it is **IN SCOPE for
this phase**. It is not a display concern — it is a **write** concern, and the earlier draft of this
document only rendered a message:

- Today a machines-routed item arrives with a **machines** category id, because the backend
  fuzzy-matches inside the detected site's own tree and falls back to `pickDefaultParent`
  (`controller/wordPressSmart.js:687-692`) = `tree[0]` = **5300 "Boring & Drilling Machines"** (13 flat
  parents, zero subcategories — parent plan §4.1).
- The app's only category-clearing mechanism is `CategoryConditionCard`'s stale-id effect, which
  clears an id **only when it is not in the loaded tree** (`CategoryConditionCard.tsx:124`
  `stillValid` → `:157` `setValue('categoryId','')` — both opened and confirmed today). A machines id
  under a machines marketplace **is** valid, so it is never cleared, and the seller is silently offered
  "Boring & Drilling Machines" for a welding fixture.
- Therefore `prefillCategory: false` must be **enforced at draft construction** — Step 8-2 (store) and
  Step 8-3 (analyze path) — and again on every marketplace change (Step 9-5 / 9-6). Rendering
  `categoryNotSet` is the *explanation*, never the mechanism.

Enforcement steps: **8-2b** (store), **8-3** (analyze path), **9-5**/**9-6** (`onConfirm`).
Tests: **8-8** (store level), **8-9** (`onConfirm` patch shape).

### 0.6 What the CTO integration review changed in this document

`PHASE_INTEGRATION.md` §2 **overrides** this file wherever they disagree. Applied here, in full:

| Ref | Decision | Where it lands in this document |
|---|---|---|
| **C4** | Phase 5 lands FIRST and un-disables the single-mode Submit, so `allRequired` no longer gates it. `marketplaceConfirmed` is a **draft** field, invisible to `handleSubmit`/`detailSchema`, so without a guard an unconfirmed item submits. | New **Step 8-10** — the `missingRouting()` guard in `useDetailController.ts` + its test. Gate **G17**. |
| **C6** | `category_source` is `'ai' \| 'fuzzy' \| 'unresolved'`. `'llm'` and `'default_parent'` are dropped. | Steps **6-1**, **6-2**, **6-7**, §2. |
| **C7** | `MARKETPLACE_OPTIONS`' third field belongs to **Phase 5**: `description`, key `mobile.detail.marketplaceOption.<value>.description`, all six translations shipped by Phase 5. | Step **9-1** is now a **pre-check, not an edit**. `hintKey`/`hint` and all four `marketplaceHint.*` keys are **deleted from this phase** — code and all six locales (§10). |
| **C12** | One backend branch, owned by the **SERVER** engineer. The server half of M-12 (`controller/mobileConfigController.js`, `routes/mobileConfigRoute.js`, the `app.js` mount, the dev env var) is **NOT this engineer's work**. | §7 is now split: **§7A server (not yours)**, **§7B client (yours)**. The client must be correct with the route **absent**. |
| **C13** | `site_type_source` is one field with one enum, owned by Phase 1's `SITE_TYPE_SOURCE`. | This phase only **reads** it; §6 unchanged in substance. |
| **M-7** | Phase 5's M-7 is a prerequisite for M-4, because `marketplace: z.enum([...])` (`schema.ts:57`) is the first realistic way for AI input to create an **invisible** Submit blocker (`requiredStatus.ts` has no `marketplace` row). | §14's before-merge gate now carries it as a hard row. |
| §6.1 5th bullet | Naming the marketplace in the loading copy. | **Decided: NOT DOING IT HERE.** See §13, with the two verified reasons. |

---

## 1. File structure — everything created and modified

### Created (app)

| File | Responsibility |
|---|---|
| `src/features/scanner/routing/routingState.ts` | **Pure** routing logic. `RoutingSource`, `CategorySource`, `RoutingSignal`, `RoutingState`, `deriveRoutingState()`, `isRoutingResolved()`, `routingWhyLine()`. No React, no I/O — the whole decision surface, unit-tested. |
| `src/features/scanner/routing/supportedMarketplacesCache.ts` | **NEW — blocker (e).** The **axios-free** half of M-12: `normalizeSupported()`, `readCachedSupported()`, `writeCachedSupported()`, `fallbackMarketplaces()`, `supportedNow()`. Imports only `@/lib/mmkv`, `@/features/scanner/constants` and `getSiteType`. This is the ONLY routing module `scanDraftStore.ts` and `processing.tsx` may import. |
| `src/features/scanner/routing/supportedMarketplaces.ts` | M-12 **transport only**. `fetchSupportedMarketplaces()` — imports `@/api/greenbidzClient` (axios) and re-exports nothing from the cache module. Imported by the hook and by the `_layout.tsx` prefetch, and by **nothing in the store**. |
| `src/features/scanner/routing/useSupportedMarketplaces.ts` | M-12 React Query hook returning `MarketplaceKey[]`. **`placeholderData`, never `initialData`** — see blocker (b) / Step 7-9. |
| `src/features/scanner/routing/__tests__/supportedMarketplacesCache.test.ts` | Tests for `normalizeSupported` / cache read-write / fail-closed. Axios-free, so it stays a fast pure suite. |
| `src/features/scanner/routing/__tests__/useSupportedMarketplaces.test.tsx` | **NEW — blocker (b).** Proves the hook actually **fetches** on mount while still returning a synchronous first value. |
| `src/features/scanner/components/detail/RoutingChip.tsx` | M-3 UI. Confirmed / ask states; owns the "change" affordance and the disabled instructive CTA. |
| `src/features/scanner/components/detail/MarketplaceSheet.tsx` | M-3 sheet. `MarketplaceCard`'s pill row becomes this body, as `Sheet.Option` rows with one-line descriptions. |
| `src/features/scanner/__tests__/routingState.test.ts` | Tests for `deriveRoutingState` incl. the **no-threshold** guard. |
| ~~`src/features/scanner/routing/__tests__/supportedMarketplaces.test.ts`~~ | **Renamed** — see `supportedMarketplacesCache.test.ts` two rows above. Testing the axios-free module is what keeps this a fast pure suite. |
| `src/features/scanner/__tests__/marketplaceUnlock.test.ts` | M-4 **mapper** tests only: `mergedSingleFields` mixed-batch guard; currency stays USD; the M-6 carry-through and the no-threshold guard. **It does NOT and cannot test lock 2** — see the next row. |
| `src/features/scanner/components/detail/__tests__/missingRouting.test.ts` | **NEW — C4.** Proves the single-mode Submit guard refuses an unconfirmed draft. |

### Modified (app)

| File | Change |
|---|---|
| `src/features/scanner/smartDetectionTypes.ts` | M-6: four wire fields on `SmartProductData` (`:37` area); four carried fields on `SmartItemFields` (`:125` area). |
| `src/features/scanner/mapSmartDetection.ts` | M-6 carry-through (`:188`, `:209`, `:225`); M-4 currency lock (`:157` — parameter renamed `siteType` → `deploymentSiteType`); M-4 `mergedSingleFields` guard (`:258-261`). |
| `src/features/scanner/mapAnalyze.ts` | M-6 on the analyze path (`:53`, `:100`). |
| `src/stores/__tests__/scanDraftStore.test.ts` | **NEW WORK — blocker (d).** Extend the existing `applySmartDetection` describe (`:150-238`; MMKV already mocked at `:23-33`) with the **store-level lock-2 tests**. Reverting `pickAppliedMarketplace` must turn this suite RED. |
| `src/stores/scanDraftStore.ts` | M-6: routing fields + `marketplaceConfirmed` on `DraftItem` (`:159` area) and `AiResult` (`:64` area); M-4 **lock 2** at **`:413`**; **owner-decision category clear** (§0.5); migration default in `migrateDraft` (`:345` area) and `emptyDraft` (`:250`). Imports **only** `supportedMarketplacesCache.ts` + `routingState.ts` — never `supportedMarketplaces.ts`. |
| `app/_layout.tsx` | **NEW — blocker (a).** One `queryClient.prefetchQuery` in the existing mount effect (`:149-158`) so the M-12 list is warm **before** any scan can build a draft. |
| `app/scan/processing.tsx` | M-4 **lock 3** — the omitted marketplace patch at **`:504-508`**. Uses the shared `routingNeedsAsk` + `shouldPrefillCategory`, not a hand-copied inline IIFE. |
| `src/features/scanner/components/detail/MarketplaceCard.tsx` | M-4 **lock 1** — `MARKETPLACE_LOCKED` at **`:22`** / `return null` at **`:29`** become an **unconditional** `return null` (Step 8-1); the pill row (`:39-76`) is lifted into `MarketplaceSheet`, and the supported-list gate lives in `RoutingChip`/`deriveRoutingState`, not here. |
| `src/features/scanner/components/detail/index.ts` | Export `RoutingChip`, `MarketplaceSheet`. |
| `src/features/scanner/components/detail/useDetailController.ts` | Two changes: (1) read the marketplace for `buildDraftPatch`'s category lookup from the **form**, not the store (`:44-45`); (2) **C4** — the `missingRouting()` submit guard (Step 8-10). |
| `app/scan/detail.tsx` | M-3: mount `<RoutingChip>` above `<IdentityCard />` (**`:127`**); gate the footer's `allRequired` (`:148`). |
| `app/scan/grouped-edit.tsx` | M-3: mount `<RoutingChip>` above `<IdentityCard />` (`:217`); same form-vs-store category fix (`:67`). |
| `app/scan/grouped-review.tsx` | M-3: per-row marketplace on `HubRow` (`:498-706`); routing folded into `ready` (`:100`) and the submit sweep (`:158`). |
| ~~`src/features/scanner/constants.ts`~~ | **NOT TOUCHED BY THIS PHASE (integration C7).** Phase 5 S16 step 1 owns `MARKETPLACE_OPTIONS`' third field as `description`. Step 9-1 is now a **pre-check grep**, not an edit. |
| `src/i18n/locales/{en,ja,th,vi,zh-Hans,zh-Hant}.json` | **20 new keys** — 18 under `mobile.detail.routing`, 2 under `mobile.reviewHub` (§10). **Zero `marketplaceHint.*` keys** (C7). |
| `src/i18n/_phase4_keys.py` | **NEW.** The text-mode locale editor (C11), same shape as Phase 5's `_phase5_keys.py`. Never a JSON round-trip. |
| `.env` | Point at dev, then restore (§4 Step 1-1, §11 Step **V-10**). Backups live OUTSIDE the repo — `.gitignore:34` ignores only the literal name `.env`. |

### Created / modified (backend, DEV only) — **NOT YOUR WORK** (integration C12)

> **The server half of M-12 belongs to the SERVER engineer**, on the single backend branch that already
> carries Phase 1 and Phase 2. You do **not** create it, edit `app.js`, touch the dev `.env`, or restart
> pm2. §7A is reproduced below only so you know the contract you are coding against. **Your client must
> be correct while `GET /api/v1/mobile-config` returns 404** — that is the fail-closed path (§7B, V-8),
> and it is the state of the world on the day you start.

| File | Change |
|---|---|
| `controller/mobileConfigController.js` | **new** — reads `MOBILE_SUPPORTED_MARKETPLACES`, validates, returns the list. |
| `routes/mobileConfigRoute.js` | **new** — `GET /` on the router. |
| `app.js` | mount `app.use("/api/v1/mobile-config", mobileConfigRouter);` |
| `__tests__/mobileConfig.test.js` | **new** — parse / default / whitespace / unknown-value tests. |
| server `.env` (dev host only) | `MOBILE_SUPPORTED_MARKETPLACES=101lab,101machine,101it,101recycle` |

`GET https://testapi.greenbidz.com/api/v1/mobile-config` returns **404 today** — verified, so the
path is free.

---

## 2. Interfaces this phase publishes

Later tasks consume these by exact name. Do not rename them.

```ts
// src/features/scanner/routing/routingState.ts
export type RoutingSource =
  | 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback';
// Integration C6 / Decision 2 — ONE enum, the SERVER's. 'llm' and
// 'default_parent' are gone: the server emits 'ai', and 'default_parent'
// becomes unreachable by construction once Phase 2's S0-3a lands.
export type CategorySource = 'ai' | 'fuzzy' | 'unresolved';

/** Exactly what the wire gives us about routing. Every field may be absent. */
export type RoutingSignal = {
  suggestedMarketplace: MarketplaceKey | null;
  needsClearerPhoto: boolean;
  siteTypeConfidence: number | null;   // LIVE since S0-2. NEVER compared (§0.4).
  siteTypeSource: RoutingSource | null;// LIVE since S0-2.
  categorySource: CategorySource | null;
};

export type RoutingState = {
  kind: 'confirmed' | 'ask';
  suggested: MarketplaceKey | null;
  current: MarketplaceKey;
  resolved: boolean;        // false ⇒ block Submit for this item
  prefillCategory: boolean; // false ⇒ category must not be shown as an AI answer
  confidence: number | null;
  source: RoutingSource | null;
};

export function deriveRoutingState(args: {
  current: MarketplaceKey;
  confirmed: boolean;
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): RoutingState;

export function signalFromDraft(draft: DraftItem): RoutingSignal;
export function signalFromSmartFields(fields: SmartItemFields): RoutingSignal;
export function signalFromAiResult(ai: AiResult): RoutingSignal;
export function isRoutingResolved(draft: DraftItem): boolean;
export function routingWhyLine(draft: DraftItem): { key: string; identity?: string } | null;

/**
 * ⛔ blocker (d) — THE ONE HOME for the ask-trigger. `deriveRoutingState`,
 * `scanDraftStore.draftFromSmartFields` and `app/scan/processing.tsx` all call
 * THIS function. There is no second copy anywhere. Pure: the supported list is
 * an argument, so this module stays free of MMKV, axios and React.
 */
export function routingNeedsAsk(args: {
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): boolean;

/** ⛔ §0.5 owner decision — THE ONE HOME for "may we pre-fill the category?". */
export function shouldPrefillCategory(args: {
  marketplace: MarketplaceKey;
  signal: RoutingSignal;
}): boolean;

/**
 * The two exact patches that clear every marketplace-scoped category field.
 * TWO, because the draft and the form disagree on what "empty" is: `DraftItem`
 * types `categoryId`/`categoryName` as `string | null` and `emptyDraft` sets
 * them to `null` (scanDraftStore.ts:122-123, :223-224), while the form is
 * `z.string()` and `draftToFormValues` maps `draft.categoryId ?? ''`
 * (formMapping.ts:78). Using the wrong one is a `tsc` error on the form side
 * and a silent divergence from `emptyDraft` on the draft side.
 */
export const CLEARED_CATEGORY_DRAFT_FIELDS: Readonly<Partial<DraftItem>>;
export const CLEARED_CATEGORY_FORM_FIELDS: Readonly<{
  categoryId: string;
  categoryName: string;
  parentCategoryId: string;
  parentCategoryName: string;
  customSubcategory: string;
}>;
```

```ts
// src/features/scanner/routing/supportedMarketplacesCache.ts  — AXIOS-FREE
export function normalizeSupported(value: unknown): MarketplaceKey[];
export function fallbackMarketplaces(): MarketplaceKey[];
export function readCachedSupported(): MarketplaceKey[] | null;
export function writeCachedSupported(list: MarketplaceKey[]): void;
export function supportedNow(): MarketplaceKey[];
export const SUPPORTED_CACHE_KEY = 'scan.supportedMarketplaces';
```

```ts
// src/features/scanner/routing/supportedMarketplaces.ts  — transport (axios)
export function fetchSupportedMarketplaces(): Promise<MarketplaceKey[]>;
export const SUPPORTED_QUERY_KEY: readonly ['supportedMarketplaces'];
```

```ts
// src/features/scanner/routing/useSupportedMarketplaces.ts
export function useSupportedMarketplaces(): MarketplaceKey[];
```

New persisted `DraftItem` fields (M-6/M-4):

```ts
needsClearerPhoto?: boolean;
siteTypeConfidence?: number | null;
siteTypeSource?: RoutingSource | null;
categorySource?: CategorySource | null;
/** false ⇒ the seller has not yet answered the routing question. */
marketplaceConfirmed?: boolean;
```

New `SmartItemFields` fields (M-6), consumed by `draftFromSmartFields`:

```ts
needsClearerPhoto: boolean;
siteTypeConfidence: number | null;
siteTypeSource: RoutingSource | null;
categorySource: CategorySource | null;
```

`MARKETPLACE_OPTIONS` is **not changed by this phase** (integration C7). **Phase 5 S16 step 1** adds
the third field as `description: string`, with the i18n key
`mobile.detail.marketplaceOption.<value>.description` and all six translations. Verified today at
`src/features/scanner/constants.ts:49-58`: the type is still `{value; label}[]` with entries at
`:44-47` and **no** third field, so Step 9-1's pre-check is what tells you whether Phase 5 has landed.
Both `MarketplaceSheet` and `RoutingChip.descriptionFor` read exactly:

```ts
t(`mobile.detail.marketplaceOption.${opt.value}.description`, { defaultValue: opt.description })
```

Consumed **from** other tasks (this phase must work without them):

- **S0-2** will start sending `site_type_confidence` / `site_type_source`. Absent today → `null`.
- **S0-3a** will start sending `category_source: 'ai' | 'fuzzy' | 'unresolved'` (integration C6 —
  **`'ai'`, not `'llm'`**). Absent today → `null`.
- **M-1** fixes the 101recycle tree. **Until M-1 lands, `101recycle` must stay OUT of the server list**
  (§7 Step 7-6) — otherwise a routed recycle item gets a cleared `categoryId` and cannot be submitted
  at all (`schema.ts:23` makes it required; zero id overlap between the recycle and lab trees per
  parent plan §5).
- **M-2** (searchable category sheet) is the reason "don't pre-fill the category" is acceptable UX.

---

## 3. Order of work

```
§4   Step 1     env + branch + baselines + Phase-5-landed pre-checks
§5   Steps 2-3  PROVE the problem (locks, wire fields, no remote config)  ← failures first
§6   Steps 6-*  M-6  wire fields + routingState (the ONE home for the triggers)
§7B  Steps 7-*  M-12 CLIENT: cache module → transport → hook → _layout prefetch
§8   Steps 8-*  M-4  locks 1-3 + the two guards + the category clear + C4's submit guard
§9   Steps 9-*  M-3  chip + sheet + HubRow
§10  Step 10    i18n (text mode, C11)
§11  Steps V-*  verification, on-device, env restore
```

Order rationale, corrected for the two blockers that were ordering bugs:

- **M-6 first** because M-4 and M-3 both read its fields.
- **`routingState.ts` before the store** because it is now the single home for `routingNeedsAsk` and
  `shouldPrefillCategory` (blocker (d)); the store *calls* them.
- **The cache module (Step 7-7) before the store edit (Step 8-2)**, and **the `_layout.tsx` prefetch
  (Step 7-10) in the same commit as the store edit**. This is blocker (a): the store's lock reads the
  cache **synchronously**, so if nothing has warmed it the first scan of a fresh install silently
  behaves like 1.0.3. The prefetch is not a nice-to-have; it is the other half of lock 2.
- **The server half of M-12 is not in this sequence at all** (integration C12). You build and verify
  the whole client against a **404**, which is the real state of the dev host until the server engineer
  ships §7A. Step V-4 is the only step that assumes the route exists, and it is explicitly optional.

---

## 4. Step 1 — env, branch, baselines

**Step 1-1. Back up `.env`, then point the app at dev.**

Integration **C9**: five phases want this one gitignored file, and five earlier drafts prescribed five
different backup paths. Two fixed names only — a **canonical** copy shared by the whole programme and a
**phase-scoped** copy that is yours to restore from:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
# C9's canonical copy — taken ONCE for the whole programme, never rotated,
# never deleted (another phase may be relying on it).
test -f "/c/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical"   || cp .env "/c/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical"
# Your phase-scoped copy.
cp .env "/c/Users/Pc/AppData/Local/Temp/claude/.env.backup.phase4"
head -1 "/c/Users/Pc/AppData/Local/Temp/claude/.env.backup.phase4"
```

Expected: `GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1` — the **production** URL,
which is what the file holds right now (verified today). **Do not proceed until you see it.**

> ⚠️ **The backup must live OUTSIDE the repo.** `.gitignore:34` ignores the literal name `.env` and
> `.env*.local` — it does **not** ignore `.env.backup.phase4`. A backup written next to `.env` inside
> `GreenBridgeApp/` shows up as an untracked file and can be swept into someone's commit. Verified today:
> `git check-ignore -v .env .env.backup.phase4` reports a rule for `.env` only.
>
> ⚠️ **Never delete a backup another phase may own.** `GreenBridgeApp.env.PROD.canonical` is shared.

Now edit `.env` — change exactly one line:

```diff
-GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
+GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1
```

Confirm, and confirm nothing else moved:

```bash
grep -n "GREENBIDZ_API_URL" .env
git status --short .env    # expect NO output — .env is gitignored
```

Expected: `1:GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1`, and empty git output.

**Step 1-2. Work on a feature branch in the app tree only.**

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
git status --porcelain | wc -l          # RECORD THIS NUMBER before any commit
git checkout -b feat/multi-marketplace-unlock-1.0.4
git status --short   # expect only `?? Docs/multi-marketplace/`
```

Measured today: `git status --porcelain | wc -l` → **1**, the single entry being
`?? Docs/multi-marketplace/`. Record it, because every commit in this phase must be made by **explicit
path** (`git add path/one path/two`) — never `git add -A`, `git add .` or `git commit -a` — and that
number is how you prove you did not sweep up another engineer's file.

**Do not create a branch in the backend tree, and do not edit the backend tree at all.** Integration
C12 gives the whole server side, including M-12's route, to the **server** engineer on their single
branch. Your `git status` in `101recycle-greenbidz-backend/` must be byte-identical before and after
this phase.

**Step 1-3. Take the baselines.**

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp && npx tsc --noEmit; echo "tsc exit=$?"
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp && npx jest --silent 2>&1 | tail -5
cd /c/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend && node --experimental-vm-modules node_modules/jest/bin/jest.js 2>&1 | tail -5
```

Measured today, these are your baselines:

- app `tsc`: **exit 0, zero errors**
- app jest, at the old `11ef609` baseline: 92 suites / 825 tests / 22 snapshots (plus a benign
  `A worker process has failed to exit gracefully` line — pre-existing, ignore it)
- backend jest: **2 suites failed, 56 passed, 58 total; 3 tests failed, 1 skipped, 720 passed**.
  The two failures are pre-existing and unrelated: `__tests__/uploadValidationService.test.js` and
  `__tests__/zohoListingSyncPublished.test.js` (`SyntaxError: … does not provide an export named
  'createZohoOffer'`).

**Step 1-4. Re-verify the line references you are about to edit.** `main` moves; these are the
anchors. Every one was checked today.

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
sed -n '22p;29p' src/features/scanner/components/detail/MarketplaceCard.tsx
sed -n '413p'    src/stores/scanDraftStore.ts
sed -n '504,508p' app/scan/processing.tsx
sed -n '127p;129p;148p' app/scan/detail.tsx
sed -n '188p;209p;225p;258,261p' src/features/scanner/mapSmartDetection.ts
sed -n '37p;125p'  src/features/scanner/smartDetectionTypes.ts
sed -n '53p;100p'  src/features/scanner/mapAnalyze.ts
sed -n '100p;158p' app/scan/grouped-review.tsx
# Added by the blocker revision. Every one opened and confirmed 2026-08-18.
sed -n '179p'      app/_layout.tsx                        # QueryClientProvider
sed -n '149,158p'  app/_layout.tsx                        # the mount-once effect (prefetch host)
sed -n '850p;862p' src/stores/scanDraftStore.ts           # the two draftFromSmartFields calls
sed -n '711,719p'  src/stores/scanDraftStore.ts           # patch() replaces `current`
sed -n '57,64p'    src/features/scanner/components/detail/useDetailController.ts
sed -n '53p'       src/features/scanner/components/detail/formMapping.ts
sed -n '161p;164p;223,224p;270,271p' src/services/scanner/buildFormData.ts
sed -n '23p;150p'  src/stores/__tests__/scanDraftStore.test.ts
sed -n '124p;157p' src/features/scanner/components/detail/CategoryConditionCard.tsx
```

Expected output, in order:

```
const MARKETPLACE_LOCKED = true;
  if (MARKETPLACE_LOCKED) return null;
    marketplace: marketplaceFromSiteType(getSiteType()),
              // Marketplace is LOCKED to this deployment's site (web parity:
              // `lockedMarketplace = marketplaceFromSiteType(SITE_TYPE)`). This
              // build is 101lab-only, so we never let the AI's detected
              // site_type flip the marketplace — the draft keeps its env
              // default from emptyDraft.
          <IdentityCard />
          <MarketplaceCard />
          allRequired={required.allComplete}
  const suggestedMarketplace = marketplaceFromSiteType(data.site_type);
    suggestedMarketplace,
      suggestedMarketplace,
  const mergedSingleFields = mapProductData(
    res.merged_single ?? rawProducts[0]?.data ?? {},
    siteType,
  );
  site_type?: string;
  suggestedMarketplace: '101lab' | '101machine' | '101recycle' | '101it' | null;
  const suggestedMarketplace = marketplaceFromSiteType(siteTypeRaw);
    suggestedMarketplace,
        const ready = status.allComplete && hasPhotos;
        getDraftRequiredStatus(it).allComplete && (it.photos?.length ?? 0) > 0;
```

and, from the added block:

```
            <QueryClientProvider client={queryClient}>
  useEffect(() => {
    hydrate();
    setUnauthorizedHandler(() => {
      reset();
      router.replace('/(auth)/login');
    });
    // Init only - the permission ask is deliberately NOT here (it fired on the
    // login screen). PushPermissionGate owns it, post-auth.
    initOneSignal();
  }, [hydrate, reset, router]);
        draftFromSmartFields(photos, mapped.products[i].fields, visibility),
      draftFromSmartFields(sourcePhotos, mapped.mergedSingleFields, visibility),
  patch: (partial) => {
    const cur = get().current;
    if (!cur) return;
    const next = { ...cur, ...partial };
    const session = { ...snapshot(get), current: next };
    // Debounced - keystrokes don't synchronously rewrite the whole session.
    schedulePatchPersist(session);
    set({ current: next });
  },
  const draft = useScanDraft((s) => s.current);
  useEffect(() => {
    if (!draft) {
      router.replace(routes.scanHome);
      return;
    }
    reset(draftToFormValues(draft));
  }, [draft, reset]);
    categoryId: draft.categoryId ?? '',
    fd.append('product_category_ids', submittedCategory.id);
    fd.append('category_name', submittedCategory.name);
  const allowedSite = marketplaceToAllowedSite(item.marketplace) || opts.siteType;
  fd.append('allowed_sites[]', allowedSite);
  if (submittedCategory.id) meta.product_category_ids = submittedCategory.id;
  if (submittedCategory.name) meta.category_name = submittedCategory.name;
jest.mock('@/lib/mmkv', () => {
  describe('applySmartDetection forceMode override', () => {
    const stillValid = categories.data.options.some((o) => o.id === id);
    setValue('categoryId', '', { shouldValidate: false });
```

Note the two anchors the brief got wrong, so you do not go looking in the wrong place: the in-memory
MMKV mock in `scanDraftStore.test.ts` is at **`:23-33`** (not `:181`), and the
`applySmartDetection` describe block is **`:150-238`** with its four calls at `:184`, `:201`, `:218`,
`:231`.

If any line differs, **search for the construct by name** (`grep -n MARKETPLACE_LOCKED`,
`grep -n 'marketplaceFromSiteType(getSiteType())'`, `grep -n mergedSingleFields`,
`grep -n draftFromSmartFields`, `grep -n QueryClientProvider`) and use the line you find. Note the
correction in your PR description.

**Step 1-5. Confirm Phase 5 and Phase 3 have landed — this phase runs FOURTH.**

Integration §1 fixes the app order as **Phase 5 → Phase 3 → Phase 4**. Four of your steps depend on
that, so prove it rather than assume it:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
# (a) Phase 5 S16 step 1 - MARKETPLACE_OPTIONS' `description` (C7). Steps 9-1/9-2/9-3 need it.
grep -n "description" src/features/scanner/constants.ts | head
node -e "const j=require('./src/i18n/locales/en.json');console.log(Object.keys(j.mobile.detail.marketplaceOption ?? {}))"
# (b) Phase 5 S9 - the un-disabled single-mode Submit (C4). Step 8-10 exists because of it.
grep -n "disabled=" src/features/scanner/components/detail/DetailFooter.tsx
grep -n "missingPhotos" src/features/scanner/components/detail/useDetailController.ts
# (c) Phase 5 M-7 - a checklist row or a guaranteed-valid default for every schema-required field.
grep -n "rowForPath" src/features/scanner/requiredStatus.ts
# (d) Phase 3 - Sheet.tsx's keyboardShouldPersistTaps, which MarketplaceSheet inherits for free.
grep -n "keyboardShouldPersistTaps" src/components/ui/Sheet.tsx
```

Expected **after** Phase 5 + Phase 3: (a) `description: string;` in the `MARKETPLACE_OPTIONS` type and
`[ '101lab', '101machine', '101it', '101recycle' ]` from the locale probe; (b) `disabled={!!submitting}`
in `DetailFooter.tsx` and a `missingPhotos` function in `useDetailController.ts`; (c) `rowForPath`
exported; (d) one `keyboardShouldPersistTaps` hit around `Sheet.tsx:120`.

Measured **today, before either phase lands** — so you can tell "not yet" from "broken":
`constants.ts:49-58` is still `{value; label}[]` with entries `:44-47` and **no** third field;
`marketplaceOption` is **absent from all six locales**; `DetailFooter.tsx:110` is still
`disabled={!allRequired && canPublish}`; `useDetailController.ts` has **no** `missingPhotos`;
`Sheet.tsx:120` has **no** `keyboardShouldPersistTaps`; `Sheet.Option` already accepts `description`
(`Sheet.tsx:141` declaration, `:202-206` render, `numberOfLines={2}`); `FieldLabel` already accepts
`ai` (`FieldLabel.tsx:8`).

**If (a) is missing, STOP.** Do not add `description` yourself and do not resurrect `hintKey`/`hint` —
that is exactly the duplicate-string collision integration C7 exists to prevent. Ask the engineer
running Phase 5 to land S16 step 1 first.
**If (b) is missing**, Step 8-10 is still correct and still required: write it, and put
`missingRouting()` where `missingPhotos()` will go.
**If (c) is missing, STOP.** Integration C3 / parent plan §7: M-4 is what lets the AI write
`marketplace: z.enum([...])` (`schema.ts:57`, verified), and `requiredStatus.ts`'s `rowForPath` returns
`null` for `marketplace`, so an unrecognised value fails `detailSchema` on a field with **no checklist
row and no on-screen explanation**. That is a dead Submit button. See §14.
**If (d) is missing**, `MarketplaceSheet`'s first tap is swallowed while the keyboard is up (Phase 3
gate G19). Record it and do not chase it here.

---

## 5. Steps 2-3 — prove the problem before fixing it

### Step 2 — prove the three locks are live and `suggestedMarketplace` is computed-but-unused

Create `src/features/scanner/__tests__/marketplaceUnlock.test.ts` with the **failing** half first:

```ts
import { describe, it, expect } from '@jest/globals';

import { mapProductData, mapSmartDetection } from '../mapSmartDetection';
import type { SmartDetectionResponse, SmartProductData } from '../smartDetectionTypes';

const IT_ITEM: SmartProductData = {
  name: 'ASUS ProArt Display PA279CV',
  brand: 'ASUS',
  model: 'PA279CV',
  equipment_description: '27-inch professional monitor.',
  currency: 'USD',
  price: 450,
  site_type: '101it',
  product_cat: { id: 5501, name: 'Monitors' },
  subcategory: { id: '', name: '' },
};

const LAB_ITEM: SmartProductData = {
  name: 'Hsiangtai CN-1050 Centrifuge',
  brand: 'Hsiangtai',
  model: 'CN-1050',
  equipment_description: 'Benchtop centrifuge.',
  currency: 'USD',
  price: 1200,
  site_type: 'LabGreenbidz',
  product_cat: { id: 5375, name: 'Lab Infrastructure & Essentials' },
  subcategory: { id: '', name: '' },
};

/** A genuinely mixed batch: product 0 is 101it, product 1 is lab. */
const MIXED: SmartDetectionResponse = {
  success: true,
  language: 'en',
  detection: { suggested_mode: 'multiple', confidence: 0.9, summary: '2 items' },
  // The backend sets merged_single = the FIRST product with data
  // (controller/wordPressSmart.js:3451), so it carries product 0's site_type.
  merged_single: IT_ITEM,
  products: [
    { id: 'p-0', image_indexes: [0], document_indexes: [], data: IT_ITEM },
    { id: 'p-1', image_indexes: [1], document_indexes: [], data: LAB_ITEM },
  ],
  suggested_terms: {},
};

describe('M-4 — the detected marketplace reaches the draft', () => {
  it('mergedSingleFields does NOT carry a mixed batch’s first marketplace', () => {
    // §6.4: merged_single.site_type is product 0's marketplace. Any path that
    // falls back to mergedSingleFields on a MIXED batch must not inherit it.
    const m = mapSmartDetection(MIXED, 'LabGreenbidz');
    expect(m.products[0].fields.suggestedMarketplace).toBe('101it');
    expect(m.products[1].fields.suggestedMarketplace).toBe('101lab');
    expect(m.mergedSingleFields.suggestedMarketplace).toBeNull();
  });

  it('AI price currency stays USD regardless of the detected marketplace (§6.4)', () => {
    const f = mapProductData(IT_ITEM, 'LabGreenbidz');
    expect(f.priceCurrency).toBe('USD');
    expect(f.ai.currency).toBe('USD');
    expect(f.pricePerUnit).toBe('450');
  });
});
```

Run it:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/features/scanner/__tests__/marketplaceUnlock.test.ts
```

**Expected now: the first test FAILS** with
`expect(received).toBeNull() … Received: "101it"` — `mapSmartDetection.ts:258-261` builds
`mergedSingleFields` from `res.merged_single` with no mixed-batch guard, so it silently inherits
product 0's marketplace. The second test **passes** today (`mapProductData` is only ever called with
`getSiteType()`), and its job is to *stay* passing — it is the §6.4 regression lock.

**Step 2-2. Prove locks 1-3 by inspection, and write down what you saw.** These three are UI/store
state, not unit-testable without a harness the plan does not fund; the proof is the four lines you
already printed in Step 1-4:

- `MarketplaceCard.tsx:22` `const MARKETPLACE_LOCKED = true;` + `:29` `if (MARKETPLACE_LOCKED) return null;`
  → the picker never renders, on **both** editors (`detail.tsx:141`, `grouped-edit.tsx:219`).
- `scanDraftStore.ts:413` `marketplace: marketplaceFromSiteType(getSiteType())` → the smart-detect
  apply path throws `fields.suggestedMarketplace` away.
- `processing.tsx:504-508` is a **comment block with no marketplace patch** → the analyze path never
  applies it either.

**Correction to the brief:** `processing.tsx:504-508` is *not* the single-photo path. It sits in the
`else` branch at **`:481`** which runs only when `useSmart === false`, i.e. when
`mode !== 'single'` (`processing.tsx:113` — `const useSmart = SMART_DETECT_ENABLED && mode === 'single'`).
Single-mode smart scans hand off to `processing-v2.tsx` at `:372-374` because `.env` sets
`EXPO_PUBLIC_SMART_DETECT_V2=1` (`src/lib/flags.ts:30`, read at `processing.tsx:120`). So `:504-508`
is the **manual-grouped / legacy `analyze-process-images`** path. It still needs the patch — that is
how a manually-grouped upload gets routed — but do not expect to reach it with a one-photo AI scan.

### Step 3 — prove there is no remote config

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
grep -rn "SITE_TYPE" app.config.ts eas.json | head
sed -n '290,293p' src/services/scanner/buildFormData.ts
curl -s -o /dev/null -w "%{http_code}\n" "https://testapi.greenbidz.com/api/v1/mobile-config"
```

Expected:

- `app.config.ts:262` → `SITE_TYPE: process.env.SITE_TYPE ?? 'LabGreenbidz',` inside `extra` (`:251-268`)
- `eas.json` bakes `SITE_TYPE` and `GREENBIDZ_API_URL` into all three profiles' `env` blocks (lines
  10-15, 32-36, 53-57)
- `buildFormData.ts:290-293` →
  `export function getSiteType() { const extra = Constants.expoConfig?.extra ?? {}; return (extra.SITE_TYPE as string | undefined) ?? 'LabGreenbidz'; }`
- `curl` → **404**

That is the whole story: the marketplace set is a **build-time constant**, and there is no endpoint
to change it. Without M-12 the only lever is an EAS Update — which §0.3 forbids while 1.0.3 is in
review, and which would still be a JS ship rather than a config flip.

---

## 6. M-6 — consume the routing signal

### Step 6-1. Add the wire fields to `SmartProductData`

`src/features/scanner/smartDetectionTypes.ts` — replace the `site_type` block (currently `:35-37`):

```ts
  // W2 (scan_v3): backend prompt now asks the AI to also return site_type,
  // which the seller-side uses to pre-pick the marketplace.
  site_type?: string;
  /**
   * Multi-marketplace unlock (M-6). All four are optional; THREE of the four
   * are now actually emitted (re-verified against backend 8383b62, §0.4):
   *   - `needs_clearer_photo`  — LIVE. Stamped per product at
   *     controller/wordPressSmart.js:828-829 (model self-report OR the
   *     deterministic "no brand AND no model" backstop), true on 37.5% of
   *     products. The primary v1 ask-trigger; needed no backend change.
   *   - `site_type_confidence` — LIVE since S0-2. `buildRoutingSignal`
   *     (wordPressSmart.js:1987-2013) computes it; processProductGroup stamps
   *     it at :2125. Clamped to [0,1], rounded to 2 dp, defaults 0.75.
   *     ⛔ CARRIED FOR DISPLAY ONLY. Never compared to a threshold (plan
   *     §2.1) — and now that it is a real number, that rule is breakable.
   *   - `site_type_source`     — LIVE since S0-2, stamped at :2126. The enum
   *     below is the WHOLE wire enum (:1701, :1712, :1726, :1731, :2000).
   *     `regex_override` and `low_confidence_fallback` are ask-triggers.
   *   - `category_source`      — NOT YET ON THE WIRE. Arrives with S0-3a, and
   *     the values are the SERVER's: 'ai' | 'fuzzy' | 'unresolved'
   *     (integration C6 / Decision 2). NOT 'llm' — that was this document's
   *     own invention — and NOT 'default_parent', which S0-3a makes
   *     unreachable by construction once the default substitution is gated.
   */
  needs_clearer_photo?: boolean;
  site_type_confidence?: number;
  site_type_source?: 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback';
  category_source?: 'ai' | 'fuzzy' | 'unresolved';
```

Also add the top-level aggregate to `SmartDetectionResponse` (after `suggested_terms`, `:84`) — the
backend already sends it (`controller/wordPressSmart.js:3506-3508` streaming, `:2387-2389`
non-streaming). We do **not** use it as the trigger (it loses which product it belonged to), but
typing it stops anyone reaching for `as any`:

```ts
  /**
   * Upload-level OR of every product's needs_clearer_photo
   * (wordPressSmart.js:3506-3508). NOT the ask-trigger — it is merged at the
   * payload's top level, so it cannot say WHICH product was unclear. Read the
   * per-product `products[].data.needs_clearer_photo` instead.
   */
  needs_clearer_photo?: boolean;
```

### Step 6-2. Add the carried fields to `SmartItemFields`

Same file, after `suggestedMarketplace` (`:125`):

```ts
  suggestedMarketplace: '101lab' | '101machine' | '101recycle' | '101it' | null;
  /** M-6 routing signal, carried verbatim. See SmartProductData above. */
  needsClearerPhoto: boolean;
  siteTypeConfidence: number | null;
  siteTypeSource: 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback' | null;
  /** Integration C6 — the SERVER's enum. No 'llm', no 'default_parent'. */
  categorySource: 'ai' | 'fuzzy' | 'unresolved' | null;
```

### Step 6-3. Carry them through `mapProductData`

`src/features/scanner/mapSmartDetection.ts` — after `:188`:

```ts
  const suggestedMarketplace = marketplaceFromSiteType(data.site_type);

  // M-6 — carry the routing signal verbatim. No arithmetic, no comparison:
  // `siteTypeConfidence` exists to be DISPLAYED once S0-2 emits it (plan §2.3)
  // and is deliberately not used in any branch (plan §2.1 — no threshold in v1).
  const needsClearerPhoto = data.needs_clearer_photo === true;
  const siteTypeConfidence =
    typeof data.site_type_confidence === 'number' ? data.site_type_confidence : null;
  const siteTypeSource = data.site_type_source ?? null;
  const categorySource = data.category_source ?? null;
```

and add all four to **both** returned objects — the top level (next to `suggestedMarketplace` at
`:209`) and the `ai` mirror (next to `:225`):

```ts
    suggestedMarketplace,
    needsClearerPhoto,
    siteTypeConfidence,
    siteTypeSource,
    categorySource,
```

```ts
      suggestedMarketplace,
      needsClearerPhoto,
      siteTypeConfidence,
      siteTypeSource,
      categorySource,
```

### Step 6-4. Same on the analyze path

`src/features/scanner/mapAnalyze.ts` — after `:53`:

```ts
  const suggestedMarketplace = marketplaceFromSiteType(siteTypeRaw);

  // M-6 — same routing signal on the /analyze-process-images path. The
  // backend runs the same normalizeIdentityAndConfidence choke point
  // (controller/wordPressSmart.js:828-829) so needs_clearer_photo is present
  // here too; the other three arrive with S0-2 / S0-3a.
  const d = data as SmartProductData;
  const needsClearerPhoto = d.needs_clearer_photo === true;
  const siteTypeConfidence =
    typeof d.site_type_confidence === 'number' ? d.site_type_confidence : null;
  const siteTypeSource = d.site_type_source ?? null;
  const categorySource = d.category_source ?? null;
```

and in the returned object, next to `suggestedMarketplace` (`:100`):

```ts
    suggestedMarketplace,
    needsClearerPhoto,
    siteTypeConfidence,
    siteTypeSource,
    categorySource,
```

### Step 6-5. Widen `AiResult` and `DraftItem`

`src/stores/scanDraftStore.ts` — in `AiResult`, after `suggestedMarketplace?:` (`:64`):

```ts
  suggestedMarketplace?: MarketplaceKey | null;
  /** M-6 routing signal (see features/scanner/smartDetectionTypes.ts). */
  needsClearerPhoto?: boolean;
  siteTypeConfidence?: number | null;
  siteTypeSource?: RoutingSource | null;
  categorySource?: CategorySource | null;
```

in `DraftItem`, after `marketplace: MarketplaceKey;` (`:159`):

```ts
  marketplace: MarketplaceKey;
  /**
   * M-3/M-4 — the seller has answered the routing question (or there was never
   * a question to answer). `false` blocks Submit for this item until the
   * RoutingChip's sheet is used. Optional so persisted 1.0.3 drafts and
   * manual-entry drafts read as `true` via `isRoutingResolved`.
   */
  marketplaceConfirmed?: boolean;
  /** M-6 routing signal, persisted so grouped-review can render per-row state. */
  needsClearerPhoto?: boolean;
  siteTypeConfidence?: number | null;
  siteTypeSource?: RoutingSource | null;
  categorySource?: CategorySource | null;
```

Add the import at the top of `scanDraftStore.ts` (next to the existing
`@/features/scanner/*` imports, around `:3-7`):

```ts
import type { CategorySource, RoutingSource } from '@/features/scanner/routing/routingState';
```

> `routingState.ts` imports `MarketplaceKey` **as a type only** from `scanDraftStore`, and
> `scanDraftStore` imports `RoutingSource`/`CategorySource` **as types only** from `routingState`.
> Type-only cycles are erased by the TS transform and by Babel's `isolatedModules` handling, so this
> does not create a runtime require cycle. Keep both `import type` — a value import here **will**
> create one.

In `emptyDraft` (`:214-255`), after `marketplace: marketplaceFromSiteType(siteType),` (`:250`):

```ts
    marketplace: marketplaceFromSiteType(siteType),
    // Manual entry: the deployment's own marketplace IS the answer, there is
    // no AI claim to confirm. `true` so the footer is never blocked on a
    // question the seller was never asked.
    marketplaceConfirmed: true,
    needsClearerPhoto: false,
    siteTypeConfidence: null,
    siteTypeSource: null,
    categorySource: null,
```

In `migrateDraft`, after `marketplace: d.marketplace ?? marketplaceFromSiteType(siteType),` (`:345`):

```ts
    marketplace: d.marketplace ?? marketplaceFromSiteType(siteType),
    // Persisted 1.0.3 drafts predate the routing question — treat them as
    // answered so an upgrade can never wedge an in-flight draft.
    marketplaceConfirmed: d.marketplaceConfirmed ?? true,
    needsClearerPhoto: d.needsClearerPhoto ?? false,
    siteTypeConfidence: d.siteTypeConfidence ?? null,
    siteTypeSource: d.siteTypeSource ?? null,
    categorySource: d.categorySource ?? null,
```

### Step 6-6. The no-threshold guard test

Append to `src/features/scanner/__tests__/marketplaceUnlock.test.ts`:

```ts
describe('M-6 — routing signal is carried, not interpreted', () => {
  it('carries needs_clearer_photo / confidence / sources verbatim', () => {
    const f = mapProductData(
      {
        ...LAB_ITEM,
        needs_clearer_photo: true,
        site_type_confidence: 0.31,
        site_type_source: 'low_confidence_fallback',
        category_source: 'unresolved',
      },
      'LabGreenbidz',
    );
    expect(f.needsClearerPhoto).toBe(true);
    expect(f.siteTypeConfidence).toBe(0.31);
    expect(f.siteTypeSource).toBe('low_confidence_fallback');
    expect(f.categorySource).toBe('unresolved');
  });

  it('defaults every absent field instead of guessing (today’s wire)', () => {
    const f = mapProductData(LAB_ITEM, 'LabGreenbidz');
    expect(f.needsClearerPhoto).toBe(false);
    expect(f.siteTypeConfidence).toBeNull();
    expect(f.siteTypeSource).toBeNull();
    expect(f.categorySource).toBeNull();
  });

  // ⛔ PLAN §2.1 — v1 ships "always confirm", no numeric threshold. If this
  // test ever fails, someone has made the confidence NUMBER change behaviour.
  it('a low confidence number alone does NOT change any mapped field', () => {
    const low  = mapProductData({ ...LAB_ITEM, site_type_confidence: 0.05 }, 'LabGreenbidz');
    const high = mapProductData({ ...LAB_ITEM, site_type_confidence: 0.99 }, 'LabGreenbidz');
    const { siteTypeConfidence: _l, ...lowRest }  = low;
    const { siteTypeConfidence: _h, ...highRest } = high;
    expect(lowRest).toEqual(highRest);
  });
});
```

```bash
npx jest src/features/scanner/__tests__/marketplaceUnlock.test.ts
```

Expected: the three M-6 tests **pass**; the `mergedSingleFields` test still **fails** (fixed in
Step 6-9); the currency test **passes**.

> ⚠️ **blocker (d) — read this before you believe §1's old claim.** Everything in
> `marketplaceUnlock.test.ts` exercises `mapProductData` / `mapSmartDetection` only. It says **nothing**
> about lock 2: revert Step 8-2 to `marketplace: marketplaceFromSiteType(getSiteType())` and every test
> in this file still passes. The behaviour that is the headline of this phase is tested in **Step 8-8**,
> at the store level, and nowhere else.

### Step 6-7. `routingState.ts` — the whole decision, in ONE pure file

> **This is blocker (d)'s fix.** The earlier draft hand-copied the ask-trigger into three places:
> `deriveRoutingState`, a local `routingNeedsAsk` inside `scanDraftStore.ts`, and an inline IIFE in
> `app/scan/processing.tsx` — and then claimed `routingState.test.ts` "asserts them identical", which it
> could not, because that suite never imports the store. **One home was chosen over three-plus-a-lock,**
> for two reasons: (1) the store and `processing.tsx` are exactly where the trigger has to be *persisted*,
> so a divergence there is the one that ships; (2) the function is trivially pure — the supported list is
> an argument — so there is no plumbing cost to importing it. `routingState.ts` keeps **zero value
> imports**, which is what lets the store import it without dragging anything in (blocker (e)).

Create `src/features/scanner/routing/routingState.ts`:

```ts
import type { SmartItemFields } from '@/features/scanner/smartDetectionTypes';
import type { AiResult, DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

export type RoutingSource =
  | 'hint'
  | 'vision'
  | 'regex_override'
  | 'low_confidence_fallback';

/**
 * Integration C6 / Decision 2 — ONE enum, the SERVER's. Phase 2 §4.2/§9.1 emit
 * exactly these three. 'llm' was this app's invention (the server never sends
 * it) and 'default_parent' is unreachable once S0-3a gates the default
 * substitution, so both are gone.
 */
export type CategorySource = 'ai' | 'fuzzy' | 'unresolved';

/** Exactly what the wire tells us about routing. Every field may be absent. */
export type RoutingSignal = {
  suggestedMarketplace: MarketplaceKey | null;
  needsClearerPhoto: boolean;
  /**
   * LIVE since S0-2 (wordPressSmart.js:2125). Clamped [0,1], 2 dp, default
   * 0.75. Null only for a persisted pre-S0-2 draft or the analyze path before
   * the backend catches up. ⛔ NEVER compared to a threshold — plan §2.1, and
   * §0.4 explains why that rule is now breakable rather than self-enforcing.
   */
  siteTypeConfidence: number | null;
  siteTypeSource: RoutingSource | null;
  categorySource: CategorySource | null;
};

export type RoutingState = {
  /** 'confirmed' → a statement with a quiet "change". 'ask' → a question. */
  kind: 'confirmed' | 'ask';
  /** The AI's routed marketplace. In 'ask' it is a HIGHLIGHTED GUESS, never a selection. */
  suggested: MarketplaceKey | null;
  /** What the draft/form currently holds. */
  current: MarketplaceKey;
  /** false ⇒ block Submit for this item until the seller chooses. */
  resolved: boolean;
  /** false ⇒ the category must not be presented as an AI answer. */
  prefillCategory: boolean;
  confidence: number | null;
  source: RoutingSource | null;
};

/**
 * Marketplaces whose category tree cannot currently produce a trustworthy
 * default, per plan §4.1 (both measured live against the WP endpoints):
 *   - machines: 13 flat parents, ZERO subcategories, so `pickDefaultParent`
 *     (controller/wordPressSmart.js:687-692) returns tree[0] = 5300
 *     "Boring & Drilling Machines" — proven shipped on a welding fixture.
 *   - recycle:  ZERO id overlap with the tree the app fetches, so every AI
 *     recycle id is cleared on arrival (until M-1 lands).
 *
 * ⚠️ This list is the BELT. The BRACES are `categorySource === 'unresolved'`,
 * which the server itself starts sending with S0-3a, and M-1's recycle-tree
 * fix. It is deliberately conservative and it is NOT permanent policy: once
 * S0-3a and M-1 are both live in a shipped build, revisit whether machines
 * still needs to be here (integration §3, "one assumption invalidation").
 */
const CATEGORY_UNTRUSTED: readonly MarketplaceKey[] = ['101machine', '101recycle'];

/**
 * Sources that mean "the pipeline overwrote or invented the answer", so the
 * seller must be asked. Both arrive with S0-2; until then they are null and
 * `needsClearerPhoto` is the only live trigger.
 */
const ASK_SOURCES: readonly RoutingSource[] = ['regex_override', 'low_confidence_fallback'];

/**
 * ⛔ blocker (d) — THE ONE HOME for the ask-trigger.
 *
 * Called by `deriveRoutingState` (UI), by `draftFromSmartFields` (the store's
 * persisted answer) and by `app/scan/processing.tsx` (the analyze path). There
 * is no second copy. If you are about to write `if (fields.needsClearerPhoto)`
 * anywhere else, call this instead.
 *
 * Pure by construction: `supported` is an argument, so this module imports no
 * MMKV, no axios and no React — which is what lets `scanDraftStore.ts` import
 * it (blocker (e)).
 *
 * Note it does NOT take `confirmed`. "Has the seller already answered?" is a
 * separate question, owned by `deriveRoutingState` and `isRoutingResolved`;
 * this function only answers "is there a question worth asking?".
 */
export function routingNeedsAsk(args: {
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): boolean {
  const { signal, supported } = args;

  // Only ONE marketplace on offer ⇒ there is no question to ask. A single-
  // marketplace build (or a server list pulled back to one) behaves exactly
  // like 1.0.3. This is also the fail-closed path: `fallbackMarketplaces()`
  // returns one entry.
  if (supported.length <= 1) return false;

  if (signal.needsClearerPhoto) return true;
  if (signal.siteTypeSource != null && ASK_SOURCES.includes(signal.siteTypeSource)) return true;

  // `suggested === null` is a DEFENSIVE trigger, not the primary one. Plan §2.2
  // rejected it AS THE trigger because every backend path hard-defaults to a
  // valid site type (smartExtractionValidator.js:326-336, :339-345;
  // wordPressSmart.js:1669-1674) so on its own it essentially never fires. It
  // DOES fire when the AI names a marketplace this build does not support —
  // and asking is the right answer then.
  return !(signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace));
}

/**
 * ⛔ §0.5 OWNER DECISION (APPROVED 2026-08-18) — THE ONE HOME for "may we show
 * the AI's category as an answer?".
 *
 * Called by `deriveRoutingState` (to render "not set"), by
 * `draftFromSmartFields` and `processing.tsx` (to actually CLEAR the fields at
 * draft construction), and by the chip's `onConfirm` (to clear them again on a
 * marketplace change). All four must agree, so there is one function.
 *
 * Why the write matters and the render does not: a machines-routed item arrives
 * carrying a machines category id, so `CategoryConditionCard`'s stale-id effect
 * (`:124` validity check → `:157` clear) sees a VALID id and keeps it. Nothing
 * else in the app would ever clear it. Rendering `categoryNotSet` without
 * clearing the field would be a message that contradicts the form.
 */
export function shouldPrefillCategory(args: {
  marketplace: MarketplaceKey;
  signal: RoutingSignal;
}): boolean {
  const { marketplace, signal } = args;
  if (signal.categorySource === 'unresolved') return false;
  if (CATEGORY_UNTRUSTED.includes(marketplace)) return false;
  return true;
}

/**
 * The exact patch that clears every marketplace-scoped category field.
 *
 * FIVE fields, not one. `categoryId` + `categoryName` are the leaf;
 * `parentCategoryId` + `parentCategoryName` are what the "Other (type brand)"
 * sentinel files under (`buildFormData.ts:34-38` reads them when
 * `categoryId === OTHER_SUBCATEGORY_ID`); `customSubcategory` is the typed
 * brand. Clearing the leaf alone leaves a PREVIOUS marketplace's parent id in
 * the submit payload (`buildFormData.ts:161` single / `:270` grouped) and its
 * name in `category_name` (`:164` / `:271`).
 *
 * TWO constants, because the draft and the form disagree on what "empty" is:
 *   - `DraftItem.categoryId` / `.categoryName` are `string | null`
 *     (scanDraftStore.ts:122-123) and `emptyDraft` sets them to **null**
 *     (:223-224). Match that, or a cleared draft is subtly unlike a fresh one.
 *   - The FORM is `categoryId: z.string().min(1, 'Category is required')`
 *     (schema.ts:23) with `categoryName: z.string().optional()` (:26), and
 *     `draftToFormValues` maps `draft.categoryId ?? ''` (formMapping.ts:78).
 *     `null` there is a `tsc` error.
 * Both read as "missing" to the checklist: `getDraftRequiredStatus` runs the
 * draft through `draftToFormValues` before `detailSchema`
 * (requiredStatus.ts:80-81), so `null` becomes `''` and fails `.min(1)`.
 *
 * Frozen so the store, the analyze path and both `onConfirm` call sites cannot
 * drift into clearing three of the five.
 */
export const CLEARED_CATEGORY_DRAFT_FIELDS = Object.freeze({
  categoryId: null,
  categoryName: null,
  parentCategoryId: '',
  parentCategoryName: '',
  customSubcategory: '',
});

export const CLEARED_CATEGORY_FORM_FIELDS = Object.freeze({
  categoryId: '',
  categoryName: '',
  parentCategoryId: '',
  parentCategoryName: '',
  customSubcategory: '',
});

/**
 * The v1 routing decision. THREE states, exactly as plan §2.2:
 *   confirmed + prefill      — "Listing on 101MACHINE — change", category pre-filled
 *   confirmed + no prefill   — marketplace stated, category reads "Not set"
 *   ask                      — a question; nothing pre-selected; Submit blocked
 *
 * ⛔ There is deliberately NO comparison against `siteTypeConfidence`. The
 * number IS on the wire now (S0-2, §0.4) but a threshold would still be
 * calibrated on ZERO logged agreement observations, which is exactly what plan
 * §2.1 rejects. It is carried for DISPLAY only. Step 6-8's last two tests fail
 * if anyone makes it change behaviour.
 */
export function deriveRoutingState(args: {
  current: MarketplaceKey;
  confirmed: boolean;
  signal: RoutingSignal;
  supported: MarketplaceKey[];
}): RoutingState {
  const { current, confirmed, signal, supported } = args;

  const suggested =
    signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace)
      ? signal.suggestedMarketplace
      : null;

  // ONE call into the shared trigger. `confirmed` is applied here, not inside
  // it, so the store can ask "was there a question?" without knowing whether
  // the seller has answered yet.
  const mustAsk = !confirmed && routingNeedsAsk({ signal, supported });

  const kind: RoutingState['kind'] = mustAsk ? 'ask' : 'confirmed';

  const prefillCategory =
    kind === 'confirmed' && shouldPrefillCategory({ marketplace: current, signal });

  return {
    kind,
    suggested,
    current,
    resolved: kind === 'confirmed',
    prefillCategory,
    confidence: signal.siteTypeConfidence,
    source: signal.siteTypeSource,
  };
}

/** Read a persisted draft's routing signal. Absent fields read as "nothing known". */
export function signalFromDraft(draft: DraftItem): RoutingSignal {
  return {
    suggestedMarketplace: draft.ai?.suggestedMarketplace ?? null,
    needsClearerPhoto: draft.needsClearerPhoto === true,
    siteTypeConfidence: draft.siteTypeConfidence ?? null,
    siteTypeSource: draft.siteTypeSource ?? null,
    categorySource: draft.categorySource ?? null,
  };
}

/**
 * The smart-detect mapper's output, as a signal. Used by
 * `scanDraftStore.draftFromSmartFields` so the store never re-derives the
 * trigger from raw fields.
 */
export function signalFromSmartFields(fields: SmartItemFields): RoutingSignal {
  return {
    suggestedMarketplace: fields.suggestedMarketplace ?? null,
    needsClearerPhoto: fields.needsClearerPhoto === true,
    siteTypeConfidence: fields.siteTypeConfidence ?? null,
    siteTypeSource: fields.siteTypeSource ?? null,
    categorySource: fields.categorySource ?? null,
  };
}

/**
 * The analyze path's mapper output, as a signal. Used by
 * `app/scan/processing.tsx` so lock 3 shares lock 2's trigger instead of
 * re-implementing it inline.
 */
export function signalFromAiResult(ai: AiResult): RoutingSignal {
  return {
    suggestedMarketplace: ai.suggestedMarketplace ?? null,
    needsClearerPhoto: ai.needsClearerPhoto === true,
    siteTypeConfidence: ai.siteTypeConfidence ?? null,
    siteTypeSource: ai.siteTypeSource ?? null,
    categorySource: ai.categorySource ?? null,
  };
}

/**
 * Submit gate. Used by `useDetailController.ts` (the C4 guard),
 * `app/scan/detail.tsx` (footer) and `app/scan/grouped-review.tsx` (per-row
 * ready + the pre-flight sweep). Deliberately does NOT take the supported list:
 * a draft that was confirmed stays confirmed even if the server list later
 * shrinks, so a mid-session config change can never orphan work the seller
 * already did.
 */
export function isRoutingResolved(draft: DraftItem): boolean {
  if (draft.marketplaceConfirmed !== false) return true;
  return false;
}

/**
 * The honest "why" line for the confirmed chip (Stitch 4a's WHY block). Built
 * ONLY from fields that are actually on the wire — brand/model come from the
 * nameplate read, `needsClearerPhoto` says the nameplate could not be read.
 * Returns null when we have nothing true to say; the chip then omits the row
 * rather than inventing a rationale.
 */
export function routingWhyLine(
  draft: DraftItem,
): { key: string; identity?: string } | null {
  const identity = [draft.brand, draft.model].filter((s) => !!s && s.trim()).join(' ').trim();
  if (identity) return { key: 'mobile.detail.routing.whyNameplate', identity };
  if (draft.needsClearerPhoto) return { key: 'mobile.detail.routing.whyNoNameplate' };
  return null;
}
```

**Import discipline — this is load-bearing for blocker (e).** `routingState.ts` must keep **zero value
imports**. All three of its imports above are `import type`, which Babel's TypeScript transform erases,
so the module compiles to a file that requires nothing. That is precisely why `scanDraftStore.ts`
(Step 8-2) and `app/scan/processing.tsx` (Step 8-3) may import it by value without pulling a graph into
`scanDraftStore.test.ts`. Verify after you write it:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
grep -n "^import" src/features/scanner/routing/routingState.ts
# EVERY line must start `import type`. If one does not, you have just created a
# runtime require cycle (scanDraftStore -> routingState -> scanDraftStore) AND
# undone the module-graph split.
```

### Step 6-8. Tests for `routingState`

Create `src/features/scanner/__tests__/routingState.test.ts`:

```ts
import { describe, it, expect } from '@jest/globals';

import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  isRoutingResolved,
  routingNeedsAsk,
  routingWhyLine,
  shouldPrefillCategory,
  signalFromAiResult,
  signalFromDraft,
  signalFromSmartFields,
  type RoutingSignal,
} from '../routing/routingState';
import type { AiResult, DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';
import type { SmartItemFields } from '@/features/scanner/smartDetectionTypes';

const ALL: MarketplaceKey[] = ['101lab', '101machine', '101it', '101recycle'];

const clean: RoutingSignal = {
  suggestedMarketplace: '101lab',
  needsClearerPhoto: false,
  siteTypeConfidence: null,
  siteTypeSource: null,
  categorySource: null,
};

describe('routingNeedsAsk — the ONE home for the trigger (blocker (d))', () => {
  it('does not ask on a clean signal', () => {
    expect(routingNeedsAsk({ signal: clean, supported: ALL })).toBe(false);
  });

  it('asks on needs_clearer_photo (the only live v1 trigger)', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, needsClearerPhoto: true }, supported: ALL }),
    ).toBe(true);
  });

  it('asks on an override or a low-confidence fallback source', () => {
    for (const src of ['regex_override', 'low_confidence_fallback'] as const) {
      expect(routingNeedsAsk({ signal: { ...clean, siteTypeSource: src }, supported: ALL })).toBe(
        true,
      );
    }
  });

  it('does NOT ask on hint or vision', () => {
    for (const src of ['hint', 'vision'] as const) {
      expect(routingNeedsAsk({ signal: { ...clean, siteTypeSource: src }, supported: ALL })).toBe(
        false,
      );
    }
  });

  it('asks when the AI named a marketplace the server list does not allow', () => {
    expect(
      routingNeedsAsk({
        signal: { ...clean, suggestedMarketplace: '101recycle' },
        supported: ['101lab', '101machine'],
      }),
    ).toBe(true);
  });

  it('asks when the AI named nothing at all', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, suggestedMarketplace: null }, supported: ALL }),
    ).toBe(true);
  });

  // Fail-closed: this is the V-8 / G15 path, and it must be reachable from the
  // pure function so it is testable without an emulator.
  it('never asks when only one marketplace is supported (1.0.3 behaviour)', () => {
    expect(
      routingNeedsAsk({ signal: { ...clean, needsClearerPhoto: true }, supported: ['101lab'] }),
    ).toBe(false);
    expect(routingNeedsAsk({ signal: clean, supported: [] })).toBe(false);
  });

  // PLAN §2.1 — no numeric threshold in v1.
  it('the confidence NUMBER alone never flips the trigger', () => {
    expect(routingNeedsAsk({ signal: { ...clean, siteTypeConfidence: 0.01 }, supported: ALL })).toBe(
      routingNeedsAsk({ signal: { ...clean, siteTypeConfidence: 0.99 }, supported: ALL }),
    );
  });
});

describe('shouldPrefillCategory — §0.5 owner decision', () => {
  it('pre-fills on a trusted tree', () => {
    expect(shouldPrefillCategory({ marketplace: '101lab', signal: clean })).toBe(true);
    expect(shouldPrefillCategory({ marketplace: '101it', signal: clean })).toBe(true);
  });

  // ⛔ OWNER DECISION — APPROVED 2026-08-18. If this test fails, someone has
  // re-enabled the silent "Boring & Drilling Machines" pre-fill.
  it('never pre-fills on machines or recycle', () => {
    for (const m of ['101machine', '101recycle'] as MarketplaceKey[]) {
      expect(shouldPrefillCategory({ marketplace: m, signal: clean })).toBe(false);
    }
  });

  it('never pre-fills when the backend says the category is unresolved', () => {
    expect(
      shouldPrefillCategory({ marketplace: '101lab', signal: { ...clean, categorySource: 'unresolved' } }),
    ).toBe(false);
  });

  it('still pre-fills for the other two server values (C6 enum)', () => {
    for (const src of ['ai', 'fuzzy'] as const) {
      expect(
        shouldPrefillCategory({ marketplace: '101lab', signal: { ...clean, categorySource: src } }),
      ).toBe(true);
    }
  });
});

describe('CLEARED_CATEGORY_* — all five fields, both shapes', () => {
  const FIVE = [
    'categoryId',
    'categoryName',
    'customSubcategory',
    'parentCategoryId',
    'parentCategoryName',
  ];

  // Clearing three of the five would leave a PREVIOUS marketplace's parent id in
  // the submit payload (buildFormData.ts:161 / :270) and its name at :164 / :271.
  it('covers all five marketplace-scoped fields in both shapes', () => {
    expect(Object.keys(CLEARED_CATEGORY_DRAFT_FIELDS).sort()).toEqual(FIVE);
    expect(Object.keys(CLEARED_CATEGORY_FORM_FIELDS).sort()).toEqual(FIVE);
  });

  // The draft shape must match `emptyDraft` (scanDraftStore.ts:223-227), so a
  // cleared draft is indistinguishable from a fresh one.
  it('uses null for the draft leaf and empty strings for the form', () => {
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.categoryId).toBeNull();
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.categoryName).toBeNull();
    expect(CLEARED_CATEGORY_DRAFT_FIELDS.parentCategoryId).toBe('');
    expect(Object.values(CLEARED_CATEGORY_FORM_FIELDS).every((v) => v === '')).toBe(true);
  });

  // Both must read as "missing" to the checklist / detailSchema.
  it('both shapes fail the required-category rule', () => {
    expect(String(CLEARED_CATEGORY_DRAFT_FIELDS.categoryId ?? '')).toHaveLength(0);
    expect(CLEARED_CATEGORY_FORM_FIELDS.categoryId).toHaveLength(0);
  });
});

describe('deriveRoutingState', () => {
  it('confirmed + prefill when the AI routed a legible item to a trusted tree', () => {
    const s = deriveRoutingState({
      current: '101lab', confirmed: false, signal: clean, supported: ALL,
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
    expect(s.prefillCategory).toBe(true);
  });

  it('asks when needs_clearer_photo is true (the v1 trigger)', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, needsClearerPhoto: true },
      supported: ALL,
    });
    expect(s.kind).toBe('ask');
    expect(s.resolved).toBe(false);
    expect(s.prefillCategory).toBe(false);
    // The guess is surfaced but NOT adopted.
    expect(s.suggested).toBe('101lab');
    expect(s.current).toBe('101lab');
  });

  it('stops asking once the seller has confirmed', () => {
    const s = deriveRoutingState({
      current: '101it',
      confirmed: true,
      signal: { ...clean, needsClearerPhoto: true, suggestedMarketplace: '101lab' },
      supported: ALL,
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
  });

  it('does not pre-fill the category on machines or recycle (§4.1 / §0.5)', () => {
    for (const m of ['101machine', '101recycle'] as MarketplaceKey[]) {
      const s = deriveRoutingState({
        current: m,
        confirmed: false,
        signal: { ...clean, suggestedMarketplace: m },
        supported: ALL,
      });
      expect(s.kind).toBe('confirmed');
      expect(s.prefillCategory).toBe(false);
    }
  });

  it('does not pre-fill the category when the backend says unresolved', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, categorySource: 'unresolved' },
      supported: ALL,
    });
    expect(s.prefillCategory).toBe(false);
  });

  it('asks when the source is an override or a low-confidence fallback', () => {
    for (const src of ['regex_override', 'low_confidence_fallback'] as const) {
      const s = deriveRoutingState({
        current: '101lab',
        confirmed: false,
        signal: { ...clean, siteTypeSource: src },
        supported: ALL,
      });
      expect(s.kind).toBe('ask');
    }
  });

  it('never asks when only one marketplace is supported (1.0.3 behaviour)', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, needsClearerPhoto: true },
      supported: ['101lab'],
    });
    expect(s.kind).toBe('confirmed');
    expect(s.resolved).toBe(true);
  });

  it('drops a suggestion the server list does not allow, and asks instead', () => {
    const s = deriveRoutingState({
      current: '101lab',
      confirmed: false,
      signal: { ...clean, suggestedMarketplace: '101recycle' },
      supported: ['101lab', '101machine'],
    });
    expect(s.suggested).toBeNull();
    expect(s.kind).toBe('ask');
  });

  // ⛔ blocker (d) — the deriver and the trigger must be ONE decision, not two
  // that happen to agree today. This is the test the old plan claimed to have.
  it('agrees with routingNeedsAsk on every combination it can reach', () => {
    const bools = [false, true];
    const sources = [null, 'hint', 'vision', 'regex_override', 'low_confidence_fallback'] as const;
    const suggestions = [null, '101lab', '101recycle'] as const;
    const lists: MarketplaceKey[][] = [['101lab'], ['101lab', '101machine'], ALL];
    for (const needsClearerPhoto of bools) {
      for (const siteTypeSource of sources) {
        for (const suggestedMarketplace of suggestions) {
          for (const supported of lists) {
            const signal: RoutingSignal = {
              ...clean,
              needsClearerPhoto,
              siteTypeSource,
              suggestedMarketplace,
            };
            const expected = routingNeedsAsk({ signal, supported });
            const derived = deriveRoutingState({
              current: '101lab', confirmed: false, signal, supported,
            });
            expect(derived.kind === 'ask').toBe(expected);
          }
        }
      }
    }
  });

  // ⛔ PLAN §2.1 — no numeric threshold in v1.
  it('the confidence NUMBER alone never changes the state', () => {
    const low  = deriveRoutingState({ current: '101lab', confirmed: false,
      signal: { ...clean, siteTypeConfidence: 0.01 }, supported: ALL });
    const high = deriveRoutingState({ current: '101lab', confirmed: false,
      signal: { ...clean, siteTypeConfidence: 0.99 }, supported: ALL });
    expect(low.kind).toBe(high.kind);
    expect(low.resolved).toBe(high.resolved);
    expect(low.prefillCategory).toBe(high.prefillCategory);
    expect(low.confidence).toBe(0.01);   // carried for display
    expect(high.confidence).toBe(0.99);
  });
});

const draft = (over: Partial<DraftItem>): DraftItem =>
  ({ brand: '', model: '', needsClearerPhoto: false, ...over } as DraftItem);

describe('signalFrom* adapters', () => {
  it('reads a draft, defaulting every absent field', () => {
    expect(signalFromDraft(draft({}))).toEqual({
      suggestedMarketplace: null,
      needsClearerPhoto: false,
      siteTypeConfidence: null,
      siteTypeSource: null,
      categorySource: null,
    });
  });

  it('reads the smart-detect mapper output verbatim', () => {
    const fields = {
      suggestedMarketplace: '101it',
      needsClearerPhoto: true,
      siteTypeConfidence: 0.31,
      siteTypeSource: 'low_confidence_fallback',
      categorySource: 'unresolved',
    } as unknown as SmartItemFields;
    expect(signalFromSmartFields(fields)).toEqual({
      suggestedMarketplace: '101it',
      needsClearerPhoto: true,
      siteTypeConfidence: 0.31,
      siteTypeSource: 'low_confidence_fallback',
      categorySource: 'unresolved',
    });
  });

  it('reads the analyze mapper output verbatim', () => {
    const ai = {
      suggestedMarketplace: '101machine',
      needsClearerPhoto: false,
      siteTypeConfidence: null,
      siteTypeSource: null,
      categorySource: 'fuzzy',
    } as unknown as AiResult;
    expect(signalFromAiResult(ai).suggestedMarketplace).toBe('101machine');
    expect(signalFromAiResult(ai).categorySource).toBe('fuzzy');
  });
});

describe('isRoutingResolved', () => {
  it('treats a persisted 1.0.3 draft (field absent) as resolved', () => {
    expect(isRoutingResolved(draft({}))).toBe(true);
  });
  it('blocks only an explicit false', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: false }))).toBe(false);
    expect(isRoutingResolved(draft({ marketplaceConfirmed: true }))).toBe(true);
  });
});

describe('routingWhyLine', () => {
  it('quotes the nameplate when brand/model were read', () => {
    expect(routingWhyLine(draft({ brand: 'Hsiangtai', model: 'CN-1050' })))
      .toEqual({ key: 'mobile.detail.routing.whyNameplate', identity: 'Hsiangtai CN-1050' });
  });
  it('says the nameplate was illegible when that is what happened', () => {
    expect(routingWhyLine(draft({ needsClearerPhoto: true })))
      .toEqual({ key: 'mobile.detail.routing.whyNoNameplate' });
  });
  it('invents nothing when there is nothing to say', () => {
    expect(routingWhyLine(draft({}))).toBeNull();
  });
});
```

```bash
npx jest src/features/scanner/__tests__/routingState.test.ts
```

Expected: **33 tests pass** — 8 `routingNeedsAsk` + 4 `shouldPrefillCategory` + 3
`CLEARED_CATEGORY_*` + 10 `deriveRoutingState` + 3 `signalFrom*` + 2 `isRoutingResolved` +
3 `routingWhyLine`.

> **Treat that number as indicative, not as a gate.** Phase test counts have been wrong five times in
> this programme (integration G12). The gate is: **zero pre-existing suites red**, and the two
> ⛔-marked tests present and passing.

### Step 6-9. Fix the `mergedSingleFields` guard (closes the Step-2 failure)

`src/features/scanner/mapSmartDetection.ts` — replace `:258-261`:

```ts
  // §6.4 — the backend sets `merged_single` to the FIRST product that has data
  // (controller/wordPressSmart.js:3451-3453), so on a MIXED batch its
  // `site_type` is product 0's marketplace, not the batch's. Anything that
  // falls back to `mergedSingleFields` ("it's actually one product") would
  // then silently adopt the wrong marketplace, wrong category tree and wrong
  // submit target. Strip the routing claim when the batch is mixed; the draft
  // then falls back to the deployment default and, because the routing signal
  // is gone, the chip asks.
  const distinctSiteTypes = new Set(
    rawProducts
      .map((p) => marketplaceFromSiteType(p?.data?.site_type))
      .filter((m): m is NonNullable<typeof m> => m != null),
  );
  const mergedIsMixed = distinctSiteTypes.size > 1;

  const mergedRaw = res.merged_single ?? rawProducts[0]?.data ?? {};
  const mergedSingleFields = mapProductData(
    mergedIsMixed ? { ...mergedRaw, site_type: undefined } : mergedRaw,
    deploymentSiteType,
  );
```

`marketplaceFromSiteType` is already imported in this file (used at `:188`).

### Step 6-10. Rerun

```bash
npx jest src/features/scanner/__tests__/marketplaceUnlock.test.ts
```

Expected: **all 5 pass** — including the `mergedSingleFields` test that failed in Step 2.

Reminder from Step 6-6: these five say **nothing** about lock 2. Step 8-8 is the store-level suite that
does, and Step 8-8's revert check is how you prove it bites.

---

## 7. M-12 — server-driven supported-marketplaces list

Design, and why: pulling a marketplace back must not require a store release. There is no remote
config today (Step 3). So: a **read-only GET on the Node API**, driven by a **server env var**, with
a **fail-closed** client that falls back to the build's own site type and caches the last good
answer. Pulling `101it` back becomes *edit one env line + `pm2 restart`*. No table, no migration.

> ## ⚠️ §7A (Steps 7-1 … 7-6) IS NOT YOUR WORK — integration C12
>
> The controller, the route, the `app.js` mount, the backend test, the local smoke and the dev deploy
> all belong to the **SERVER engineer**, on the single backend branch that already carries Phase 1 and
> Phase 2. Two engineers writing a tree that holds eight files of other people's uncommitted work is how
> that work gets lost.
>
> **You do not:** create either backend file, edit `app.js`, edit the dev host's `.env`, run
> `pm2 restart`, or ssh anywhere. Your `git status` in `101recycle-greenbidz-backend/` must be
> byte-identical before and after this phase (V-10 proves it).
>
> **§7A is reproduced verbatim below only as the contract you code against**, so §7B's parser matches
> the payload the server will actually send.
>
> **Your client must be correct while the route returns 404.** That is the state of the dev host on the
> day you start (re-confirmed today), and it is the fail-closed path: `readCachedSupported()` → `null`,
> `fallbackMarketplaces()` → `['101lab']`, `routingNeedsAsk` → `false`, no chip, behaviour identical to
> 1.0.3. Steps 7-7 … 7-11 and gate **V-8 / G15** are all reachable with no server change at all. The
> only step that needs §7A live is **V-4**, which is marked optional for exactly that reason.

### Step 7-1. The controller  *(server engineer)*

Create `controller/mobileConfigController.js`:

```js
/**
 * Mobile remote config (multi-marketplace unlock M-12).
 *
 * WHY THIS EXISTS: the app's marketplace set is baked at build time —
 * `getSiteType()` reads `Constants.expoConfig.extra.SITE_TYPE`
 * (GreenBridgeApp/src/services/scanner/buildFormData.ts:290-293) and eas.json
 * pins `SITE_TYPE` per profile. Without this endpoint, withdrawing one
 * marketplace means another App Store review cycle.
 *
 * Read-only. No DB, no migration. Driven by MOBILE_SUPPORTED_MARKETPLACES in
 * the server's .env so a rollback is one env edit + `pm2 restart`.
 *
 * FAIL-CLOSED: an unset / empty / entirely-invalid env yields ["101lab"] —
 * i.e. exactly what 1.0.3 already ships. Turning the unlock ON is an explicit
 * act per environment.
 */

// Must stay in lockstep with the app's MarketplaceKey union
// (GreenBridgeApp/src/stores/scanDraftStore.ts:108).
const KNOWN_MARKETPLACES = ["101lab", "101machine", "101it", "101recycle"];
const DEFAULT_MARKETPLACES = ["101lab"];

export function parseSupportedMarketplaces(raw) {
  const wanted = String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  // Preserve KNOWN order (the app renders in this order) and de-dupe.
  const picked = KNOWN_MARKETPLACES.filter((m) => wanted.includes(m));
  return picked.length ? picked : DEFAULT_MARKETPLACES;
}

export function getMobileConfigController(req, res) {
  const supported = parseSupportedMarketplaces(
    process.env.MOBILE_SUPPORTED_MARKETPLACES
  );
  res.set("Cache-Control", "public, max-age=300");
  return res.status(200).json({
    success: true,
    message: "Mobile config fetched successfully",
    data: { supported_marketplaces: supported },
  });
}
```

### Step 7-2. The route  *(server engineer)*

Create `routes/mobileConfigRoute.js`:

```js
import { Router } from "express";

import { getMobileConfigController } from "../controller/mobileConfigController.js";

const mobileConfigRouter = Router();

// GET /api/v1/mobile-config — public, read-only, no secrets. Same
// unauthenticated posture as the /wp/analyze-* endpoints the app already
// calls; the payload is a marketplace allow-list, nothing user-specific.
mobileConfigRouter.get("/", getMobileConfigController);

export default mobileConfigRouter;
```

### Step 7-3. Mount it  *(server engineer)*

`app.js` — add the import beside the other route imports (the block around `:80-110`):

```js
import mobileConfigRouter from "./routes/mobileConfigRoute.js";
```

and the mount next to `app.use("/api/v1/sites", siteRouter);` (`:411`):

```js
app.use("/api/v1/mobile-config", mobileConfigRouter);
```

Do not touch any other line in `app.js` — it has uncommitted work from other engineers.

### Step 7-4. Backend test  *(server engineer)*

Create `__tests__/mobileConfig.test.js`:

```js
import { describe, it, expect } from "@jest/globals";

import { parseSupportedMarketplaces } from "../controller/mobileConfigController.js";

describe("parseSupportedMarketplaces", () => {
  it("fails closed to 101lab when unset, empty, or all-invalid", () => {
    expect(parseSupportedMarketplaces(undefined)).toEqual(["101lab"]);
    expect(parseSupportedMarketplaces("")).toEqual(["101lab"]);
    expect(parseSupportedMarketplaces("   ")).toEqual(["101lab"]);
    expect(parseSupportedMarketplaces("101shoes,nonsense")).toEqual(["101lab"]);
  });

  it("accepts the full set and returns it in the app's render order", () => {
    expect(parseSupportedMarketplaces("101recycle,101it,101machine,101lab")).toEqual([
      "101lab",
      "101machine",
      "101it",
      "101recycle",
    ]);
  });

  it("tolerates whitespace, case and duplicates", () => {
    expect(parseSupportedMarketplaces(" 101LAB , 101it ,101it")).toEqual([
      "101lab",
      "101it",
    ]);
  });

  it("drops unknown values but keeps the valid ones", () => {
    expect(parseSupportedMarketplaces("101lab,101tractor,101machine")).toEqual([
      "101lab",
      "101machine",
    ]);
  });
});
```

```bash
cd /c/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/mobileConfig.test.js
```

Expected: **1 suite passed, 4 tests passed.**

### Step 7-5. Local dev smoke  *(server engineer)*

Run the backend locally against the **dev** DB (its local `.env` already points at `greenbidz_test`
per the workspace `CLAUDE.md`), then:

```bash
curl -s http://127.0.0.1:6000/api/v1/mobile-config
MOBILE_SUPPORTED_MARKETPLACES=101lab,101machine,101it npm run dev   # then re-curl
```

Expected, in order:

```json
{"success":true,"message":"Mobile config fetched successfully","data":{"supported_marketplaces":["101lab"]}}
{"success":true,"message":"Mobile config fetched successfully","data":{"supported_marketplaces":["101lab","101machine","101it"]}}
```

### Step 7-6. Deploying to the dev host  *(server engineer)*

This is a **dev** deploy and it is the only server-side action in this phase:

1. Copy `controller/mobileConfigController.js`, `routes/mobileConfigRoute.js` and the two `app.js`
   lines onto the dev backend (`testapi.greenbidz.com`, port **6000**, DB **`greenbidz_test`**).
2. Add to the dev backend's `.env`:
   `MOBILE_SUPPORTED_MARKETPLACES=101lab,101machine,101it`
   **`101recycle` stays out until M-1 lands** — see §2. Add it in the same edit that verifies M-1.
3. Restart the **dev** pm2 process only.
4. `curl -s https://testapi.greenbidz.com/api/v1/mobile-config` → the three-marketplace payload.

⚠️ Verify port ↔ DB before and after (`:4000` = prod DB `greenbidz`, `:6000` = dev DB
`greenbidz_test`). A `PORT` collision has previously made "prod" serve the test DB. **Do not touch
prod.** Prod rollout is a separate, owner-approved step.

## 7B. M-12 — the CLIENT half (this is your work)

Four modules, in this order, and the order is the fix for blocker (e) **and** blocker (a):

```
supportedMarketplacesCache.ts   MMKV + fallback. AXIOS-FREE. The store imports ONLY this.
supportedMarketplaces.ts        the axios GET. Imported by the hook and the prefetch. NEVER by the store.
useSupportedMarketplaces.ts     React Query, placeholderData (NOT initialData).
app/_layout.tsx                 prefetch at launch, so the cache is warm before any scan.
```

### Step 7-7. The axios-free cache module — blocker (e)

**Why this split exists.** The earlier draft had one module, `supportedMarketplaces.ts`, that imported
`@/api/greenbidzClient` *and* exported `readCachedSupported` / `fallbackMarketplaces`. The store needs
those two synchronously, so the store would have imported the axios module — and the real import chain,
which I opened end to end today, is:

```
supportedMarketplaces.ts
  → @/api/greenbidzClient          (greenbidzClient.ts:1  `import axios from 'axios'`)
      → ./interceptors             (greenbidzClient.ts:4, and :24 CALLS attachGreenbidzInterceptors
                                    at module load — a side effect, not just a type)
          → @/services/auth/logout (interceptors.ts:4)
              → @/features/lab/messages/socket   (logout.ts:1 → socket.ts:21 `socket.io-client`)
              → @/lib/marketplaceWebView         (logout.ts:2)
              → @/lib/secureStorage              (logout.ts:4 → expo-secure-store, AsyncStorage)
```

**Measured, not assumed** (2026-08-18, this machine):

- A probe suite that mocks `@/lib/mmkv` and imports `@/api/greenbidzClient` **passes** — the graph does
  load under `jest-expo`. So this is a **coupling and blast-radius** fix, not a "the suite is red today"
  fix, and the document now says so rather than claiming a failure it cannot demonstrate.
- The three suites blocker (e) names were run at baseline: `scanDraftStore.test.ts`,
  `scanDraftStore.hydrate.test.ts`, `scanResume.test.ts` → **3 suites passed, 27 tests passed, 1.1 s**.
- **Correction to the brief:** `scanResume.test.ts` would **not** have been affected either way. It
  imports `DraftItem` from the store as `import type` only (`src/lib/__tests__/scanResume.test.ts:5`),
  and so does `src/lib/scanResume.ts:6`, so the store module is never required at runtime. Proven with a
  probe that mocked `@/stores/scanDraftStore` with a throwing factory and still passed. The two suites
  genuinely at risk are `scanDraftStore.test.ts` and `scanDraftStore.hydrate.test.ts`.

**Why do the split anyway**, given nothing is red today. Three reasons, all cheap to state and expensive
to discover later: (1) `attachGreenbidzInterceptors` runs at import, so two pure store suites would start
constructing an axios instance and registering interceptors as a side effect of a marketplace list;
(2) `socket.io-client` and `expo-secure-store` are not in `jest.config.js`'s `transformIgnorePatterns`
allow-list (verified — the pattern covers react-native/expo/@expo-google-fonts/react-navigation/sentry/
nativewind/react-native-svg only), so the day one of them ships ESM, two suites that have nothing to do
with networking go red; (3) the store is the hot path of the scan flow and has no business owning a
transport dependency. Keeping the store's import surface to MMKV is a one-file decision now and a
multi-suite archaeology exercise later.

Create `src/features/scanner/routing/supportedMarketplacesCache.ts`:

```ts
import { marketplaceFromSiteType } from '@/features/scanner/constants';
import { mmkv } from '@/lib/mmkv';
import { getSiteType } from '@/services/scanner/buildFormData';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

/**
 * M-12, the AXIOS-FREE half.
 *
 * ⚠️ IMPORT RULE: `src/stores/scanDraftStore.ts` and `app/scan/processing.tsx`
 * import THIS module and never `./supportedMarketplaces`. That module imports
 * `@/api/greenbidzClient`, which at module load calls
 * `attachGreenbidzInterceptors` (greenbidzClient.ts:24) and pulls in
 * interceptors -> services/auth/logout -> features/lab/messages/socket
 * (socket.io-client) + lib/secureStorage. None of that belongs in the scan
 * store's graph, and `scanDraftStore.test.ts` /
 * `scanDraftStore.hydrate.test.ts` are the two suites that would inherit it.
 *
 * Everything here is safe in these three suites already: `@/lib/mmkv` is mocked
 * in both store suites (scanDraftStore.test.ts:23-33), `constants.ts` has ZERO
 * imports (verified), and `getSiteType` reads `Constants.expoConfig.extra`
 * (buildFormData.ts:290-293) which the store already imports at :10.
 */

const CACHE_KEY = 'scan.supportedMarketplaces';
export const SUPPORTED_CACHE_KEY = CACHE_KEY;

const KNOWN: readonly MarketplaceKey[] = ['101lab', '101machine', '101it', '101recycle'];

/**
 * The build's OWN marketplace — the fail-closed answer. Identical to 1.0.3
 * behaviour, so an offline seller, a 404, or a malformed payload can never
 * make the app worse than the version already in the store.
 */
export function fallbackMarketplaces(): MarketplaceKey[] {
  return [marketplaceFromSiteType(getSiteType()) ?? '101lab'];
}

/** Keep KNOWN order (the app renders in it) and drop anything unrecognised. */
export function normalizeSupported(value: unknown): MarketplaceKey[] {
  if (!Array.isArray(value)) return [];
  const wanted = new Set(
    value.filter((v): v is string => typeof v === 'string').map((v) => v.trim().toLowerCase()),
  );
  return KNOWN.filter((m) => wanted.has(m));
}

export function readCachedSupported(): MarketplaceKey[] | null {
  const raw = mmkv.getString(CACHE_KEY);
  if (!raw) return null;
  try {
    const list = normalizeSupported(JSON.parse(raw));
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export function writeCachedSupported(list: MarketplaceKey[]): void {
  if (!list.length) return;      // never cache an empty list over a good one
  mmkv.set(CACHE_KEY, JSON.stringify(list));
}

/**
 * The synchronous answer for the two non-React call sites (the store's lock 2
 * and the analyze path's lock 3). Cache first, build's own site type second.
 *
 * ⚠️ blocker (a): on a FRESH INSTALL the cache is empty, so this returns ONE
 * marketplace and `routingNeedsAsk` returns false — the first scan would behave
 * exactly like 1.0.3 and stamp `marketplaceConfirmed: true`. Step 7-10's
 * prefetch is what makes that not happen; do not ship one without the other.
 */
export function supportedNow(): MarketplaceKey[] {
  const cached = readCachedSupported();
  return cached && cached.length ? cached : fallbackMarketplaces();
}
```

### Step 7-8. The transport module

Create `src/features/scanner/routing/supportedMarketplaces.ts`:

```ts
import { greenbidz } from '@/api/greenbidzClient';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

import {
  fallbackMarketplaces,
  normalizeSupported,
  readCachedSupported,
  writeCachedSupported,
} from './supportedMarketplacesCache';

/** One key, shared by the hook and by the `_layout.tsx` prefetch (Step 7-10). */
export const SUPPORTED_QUERY_KEY = ['supportedMarketplaces'] as const;

/**
 * GET /mobile-config. On any failure returns the last good cached list, and
 * failing that the build's own marketplace. Never throws — the marketplace
 * picker must not be able to break a scan.
 *
 * NOTE the resolve-on-failure contract: because this never rejects, React
 * Query's `retry` never sees an error and the prefetch in `_layout.tsx` always
 * resolves. That is deliberate; the 404 case (the state of the dev host until
 * the server engineer ships §7A) is a normal outcome, not an error.
 *
 * ⚠️ Do NOT re-export the cache helpers from here. The store must not be able
 * to reach axios through this file — see supportedMarketplacesCache.ts's
 * import rule.
 */
export async function fetchSupportedMarketplaces(): Promise<MarketplaceKey[]> {
  try {
    const res = await greenbidz.get('/mobile-config', { timeout: 8_000 });
    const list = normalizeSupported(res.data?.data?.supported_marketplaces);
    if (list.length) {
      writeCachedSupported(list);
      return list;
    }
  } catch {
    // fall through — 404 / offline / malformed all land here
  }
  return readCachedSupported() ?? fallbackMarketplaces();
}
```

### Step 7-9. The hook — blocker (b), and it is a one-word fix

**The bug, proven at source.** The earlier draft used `initialData` with `staleTime: 30 * 60_000`.
In React Query v5, `initialData` without `initialDataUpdatedAt` is stamped **fresh as of now**, so with
a 30-minute `staleTime` the query is never stale, `fetchSupportedMarketplaces` never runs, and the whole
M-12 lever is **inert on device while every unit test passes**. Verified in the installed package
(`@tanstack/react-query` **5.100.14**, `package.json:26`), in
`node_modules/@tanstack/query-core/build/modern/query.js`:

```js
:434  const initialDataUpdatedAt = hasData ? (typeof options.initialDataUpdatedAt === "function"
                                    ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt) : 0;
:438  dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
```

**The fix: `placeholderData`.** It is applied in the observer's result computation while the query is
still `pending` (`node_modules/@tanstack/query-core/build/modern/queryObserver.js:265-280`) and never
writes `dataUpdatedAt` into the cache — so the value is available **synchronously on the first render**
*and* the query is stale, so `queryFn` runs. Both halves, no trade-off.
(`initialDataUpdatedAt: 0` also works and is noted below, but `placeholderData` is the idiomatic v5
answer and it keeps `isPlaceholderData` available if a later phase wants to dim the chip while loading.)

Create `src/features/scanner/routing/useSupportedMarketplaces.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import type { MarketplaceKey } from '@/stores/scanDraftStore';

import { fallbackMarketplaces, readCachedSupported } from './supportedMarketplacesCache';
import { fetchSupportedMarketplaces, SUPPORTED_QUERY_KEY } from './supportedMarketplaces';

/**
 * The marketplaces this install may route to. Synchronous by design: the first
 * render already has the cached-or-fallback list, so no scan screen ever shows
 * a loading state or an empty picker while the config is in flight.
 *
 * ⚠️ `placeholderData`, NEVER `initialData` — blocker (b). React Query v5 stamps
 * `initialData` with `dataUpdatedAt = Date.now()`
 * (query-core/build/modern/query.js:434,:438), so `initialData` + a 30-minute
 * `staleTime` means the query is fresh on mount and `queryFn` NEVER RUNS. The
 * server-driven list would be dead on device and every unit test would still
 * pass. `placeholderData` is resolved in the observer while the query is
 * `pending` (queryObserver.js:265-280) and does not touch `dataUpdatedAt`, so
 * we get the synchronous first value AND the fetch.
 *
 * If you ever must go back to `initialData`, it MUST carry
 * `initialDataUpdatedAt: 0`. There is a test for this — Step 7-11.
 */
export function useSupportedMarketplaces(): MarketplaceKey[] {
  const q = useQuery({
    queryKey: SUPPORTED_QUERY_KEY,
    queryFn: fetchSupportedMarketplaces,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
    placeholderData: () => readCachedSupported() ?? fallbackMarketplaces(),
  });
  return q.data?.length ? q.data : fallbackMarketplaces();
}
```

> Note the `q.data?.length` — with `placeholderData` the type is `MarketplaceKey[] | undefined`, unlike
> `initialData` which narrows it to `MarketplaceKey[]`. Leaving the old `q.data.length` there is a `tsc`
> error, which is a useful tripwire: if it compiles, you did not make the change.

### Step 7-10. Warm the cache at launch — blocker (a), the release-day silent failure

**The bug.** Step 8-2's `supportedNow()` and Step 8-3's lock both read `readCachedSupported()`, which is
only ever written by `fetchSupportedMarketplaces()`, which only ran inside `useSupportedMarketplaces()`,
which was mounted only by `RoutingChip` on `app/scan/detail.tsx`. Verified call order:
`applySmartDetection` builds every draft at `scanDraftStore.ts:850` (queued items) and `:862`
(merged-single), and it is invoked from `processing-v2.tsx:353` — i.e. **before `detail.tsx` exists**.
So on a fresh install the FIRST scan runs with `supported = ['101lab']`:
`pickAppliedMarketplace` discards the AI's `101it`/`101machine` verdict, `routingNeedsAsk` returns
`false` at its `supported.length <= 1` line, and the draft is stamped `marketplaceConfirmed: true`.
**Every user's first scan silently behaves like 1.0.3** — and it is indistinguishable from the intended
V-8 fail-closed behaviour, so nothing in §11 as previously written could catch it.

**The fix, and why this one.** Two options were on the table:

| Option | Verdict |
|---|---|
| **(A) Prefetch at app launch** in `app/_layout.tsx` | **CHOSEN.** One call, runs once per launch, off the critical path, and it warms the cache for *both* apply paths (smart + analyze) and for background recognition, which finishes with no screen mounted at all (`BackgroundRecognitionWatcher`, `_layout.tsx:186`). Costs nothing on the scan path. |
| (B) `await fetchSupportedMarketplaces()` inside `applySmartDetection` | Rejected. It puts an 8-second-timeout network call **in front of the draft build**, on the screen the seller is already staring at, after the SSE has finished — the worst possible place for a spinner. It also does not help `processing.tsx`'s analyze path unless duplicated, and `draftFromSmartFields` is a pure synchronous function today (`scanDraftStore.ts:369`); making the marketplace list async would force it to become async too. |

`app/_layout.tsx` — add the import, then one line inside the **existing** mount-once effect at
`:149-158` (the one that calls `hydrate()`, `setUnauthorizedHandler(...)` and `initOneSignal()`):

```tsx
import {
  fetchSupportedMarketplaces,
  SUPPORTED_QUERY_KEY,
} from '@/features/scanner/routing/supportedMarketplaces';
```

```tsx
  useEffect(() => {
    hydrate();
    setUnauthorizedHandler(() => {
      reset();
      router.replace('/(auth)/login');
    });
    // Init only — the permission ask is deliberately NOT here (it fired on the
    // login screen). PushPermissionGate owns it, post-auth.
    initOneSignal();
    // M-12 / blocker (a) — warm the supported-marketplaces cache BEFORE any
    // scan can build a draft. `draftFromSmartFields` (scanDraftStore.ts:369)
    // reads the MMKV cache SYNCHRONOUSLY, and it runs from
    // `applySmartDetection` (:850, :862) which processing-v2.tsx invokes at
    // :353 — long before RoutingChip mounts on detail.tsx. Without this, a
    // fresh install's FIRST scan sees one marketplace, throws away the AI's
    // verdict and stamps `marketplaceConfirmed: true`. Fire-and-forget:
    // `fetchSupportedMarketplaces` never rejects (it resolves to the cached or
    // fallback list), so there is nothing to catch and nothing to block on.
    void queryClient.prefetchQuery({
      queryKey: SUPPORTED_QUERY_KEY,
      queryFn: fetchSupportedMarketplaces,
      staleTime: 30 * 60_000,
    });
  }, [hydrate, reset, router]);
```

Notes that keep this from being subtly wrong:

- `queryClient` is a **module singleton** (`src/lib/queryClient.ts:3`) already imported by this file at
  `:44`, so `prefetchQuery` works here even though this effect is **outside** the
  `QueryClientProvider` (`:179`). Do not "fix" that by moving the effect.
- Adding this import does **not** widen `_layout.tsx`'s graph: it already imports
  `@/api/interceptors` at `:32`, so axios is present regardless.
- `staleTime` must match the hook's, or `RoutingChip`'s mount immediately refetches what you just
  fetched.
- The effect body already runs exactly once (its deps are three stable store/router refs), so there is
  no need for a ref-guard.
- **This does not make the cache warm on a cold FIRST LAUNCH before the network answers.** It makes it
  warm within a few hundred ms of launch, which is many seconds before a scan can complete. The genuine
  cold-and-offline case still falls back to one marketplace, which is the correct fail-closed answer —
  and V-0 vs V-8 is how you tell those two apart.

### Step 7-11. Tests

Create `src/features/scanner/routing/__tests__/supportedMarketplacesCache.test.ts` — note it imports
**only** the cache module, which is what keeps it axios-free:

```ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// In-memory MMKV, same shape as the store suites use (scanDraftStore.test.ts:23-33).
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      __store: store,
    },
  };
});

import { mmkv } from '@/lib/mmkv';
import {
  fallbackMarketplaces,
  normalizeSupported,
  readCachedSupported,
  supportedNow,
  writeCachedSupported,
  SUPPORTED_CACHE_KEY,
} from '../supportedMarketplacesCache';

beforeEach(() => {
  (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
});

describe('normalizeSupported', () => {
  it('keeps the app render order regardless of server order', () => {
    expect(normalizeSupported(['101recycle', '101it', '101lab'])).toEqual([
      '101lab',
      '101it',
      '101recycle',
    ]);
  });
  it('drops unknown entries and non-strings', () => {
    expect(normalizeSupported(['101lab', '101tractor', 7, null])).toEqual(['101lab']);
  });
  it('tolerates whitespace and case', () => {
    expect(normalizeSupported([' 101LAB ', '101Machine'])).toEqual(['101lab', '101machine']);
  });
  it('returns [] for a non-array so the caller can fall back', () => {
    expect(normalizeSupported(undefined)).toEqual([]);
    expect(normalizeSupported('101lab')).toEqual([]);
    expect(normalizeSupported({})).toEqual([]);
  });
});

describe('the MMKV cache', () => {
  it('round-trips a written list', () => {
    writeCachedSupported(['101lab', '101machine']);
    expect(readCachedSupported()).toEqual(['101lab', '101machine']);
  });
  it('reads null when nothing was ever written', () => {
    expect(readCachedSupported()).toBeNull();
  });
  it('reads null on malformed JSON instead of throwing', () => {
    mmkv.set(SUPPORTED_CACHE_KEY, '{not json');
    expect(readCachedSupported()).toBeNull();
  });
  it('reads null when the cached list normalises to empty', () => {
    mmkv.set(SUPPORTED_CACHE_KEY, JSON.stringify(['101tractor']));
    expect(readCachedSupported()).toBeNull();
  });
  it('refuses to cache an empty list over a good one', () => {
    writeCachedSupported(['101lab', '101it']);
    writeCachedSupported([]);
    expect(readCachedSupported()).toEqual(['101lab', '101it']);
  });
});

describe('fail-closed', () => {
  // The test env has no expoConfig.extra.SITE_TYPE, so getSiteType() returns
  // its own default 'LabGreenbidz' (buildFormData.ts:290-293).
  it('falls back to exactly one marketplace', () => {
    expect(fallbackMarketplaces()).toEqual(['101lab']);
  });

  // ⛔ blocker (a) — this is the COLD-CACHE state, and it is the reason
  // Step 7-10's prefetch exists. If this returns more than one entry, the
  // prefetch has leaked into a unit test and V-0 will not mean anything.
  it('supportedNow() is one marketplace on a cold cache', () => {
    expect(supportedNow()).toEqual(['101lab']);
  });

  it('supportedNow() prefers the cache once it is warm', () => {
    writeCachedSupported(['101lab', '101machine', '101it']);
    expect(supportedNow()).toEqual(['101lab', '101machine', '101it']);
  });
});
```

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/features/scanner/routing/__tests__/supportedMarketplacesCache.test.ts
```

Expected: **1 suite, 12 tests passed.**

Now the test that would have caught blocker (b). Create
`src/features/scanner/routing/__tests__/useSupportedMarketplaces.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';

jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      __store: store,
    },
  };
});

// Mock the TRANSPORT module, not axios: that keeps this suite off the
// greenbidzClient -> interceptors -> logout -> socket graph entirely.
const fetchSpy = jest.fn(async () => ['101lab', '101machine', '101it']);
jest.mock('../supportedMarketplaces', () => ({
  SUPPORTED_QUERY_KEY: ['supportedMarketplaces'] as const,
  fetchSupportedMarketplaces: () => fetchSpy(),
}));

import { useSupportedMarketplaces } from '../useSupportedMarketplaces';

const wrap = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

beforeEach(() => {
  fetchSpy.mockClear();
});

describe('useSupportedMarketplaces', () => {
  // ⛔ blocker (b). With `initialData` + staleTime 30min this assertion FAILS:
  // React Query v5 stamps initialData `dataUpdatedAt = Date.now()`
  // (query-core query.js:434/:438), the query is fresh on mount and queryFn is
  // never called. If someone reverts to `initialData`, this test goes red.
  it('FETCHES on mount even though it has a synchronous first value', async () => {
    const { result } = renderHook(() => useSupportedMarketplaces(), { wrapper: wrap() });
    // Synchronous first render: the fail-closed list, no loading state.
    expect(result.current).toEqual(['101lab']);
    // ...and the fetch really fires.
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toEqual(['101lab', '101machine', '101it']));
  });

  it('never returns an empty list', async () => {
    fetchSpy.mockImplementationOnce(async () => []);
    const { result } = renderHook(() => useSupportedMarketplaces(), { wrapper: wrap() });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(result.current.length).toBeGreaterThan(0);
  });
});
```

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/features/scanner/routing/__tests__/useSupportedMarketplaces.test.tsx
```

Expected: **1 suite, 2 tests passed.**

`@testing-library/react-native` is present — **verified today at `package.json:85`, `^13.3.3`** — so
`renderHook` / `waitFor` are available with no new dependency. If that ever changes, do **not** add it
back: assert the same thing without React by calling `queryClient.fetchQuery` with the hook's options
object. The assertion that matters is "`queryFn` was called".

### Step 7-12. Prove the module-graph split — blocker (e), and RUN it

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
# 1. The store must not be able to reach axios through the routing folder.
grep -rn "supportedMarketplaces'" src/stores/scanDraftStore.ts app/scan/processing.tsx
#    EXPECT: zero hits. Both must import '.../supportedMarketplacesCache' only.
grep -rn "supportedMarketplacesCache" src/stores/scanDraftStore.ts app/scan/processing.tsx
#    EXPECT: one hit each.
grep -n "^import" src/features/scanner/routing/routingState.ts
#    EXPECT: every line starts `import type`.

# 2. The three suites blocker (e) named. Baseline measured 2026-08-18:
#    3 suites passed, 27 tests passed, ~1.1 s.
npx jest src/stores/__tests__/scanDraftStore.test.ts \
         src/stores/__tests__/scanDraftStore.hydrate.test.ts \
         src/lib/__tests__/scanResume.test.ts 2>&1 | tail -8
```

Expected after Steps 8-2 / 8-3 / 8-8 land: **3 suites passed**, tests **27 + however many you added in
Step 8-8** (Step 8-8 adds 5, so **32**), and the runtime still around a second. A jump to several
seconds, or any `Cannot use import statement outside a module` from `socket.io-client` /
`expo-secure-store`, means the axios graph got in — re-check grep #1.

## 8. M-4 — the three locks, the two guards, the category clear and the submit guard

**Step order in this section** — the compile step is deliberately last, and four of these steps did not
exist in the pre-review draft:

```
8-1   lock 1   MarketplaceCard -> return null
8-2   lock 2   the store adopts the AI marketplace + clears an untrusted category   (blockers a/d/e, §0.5)
8-3   lock 3   the analyze path, same decision functions                             (blocker d, §0.5)
8-4   guard 1  currency stays USD
8-5   guard 2  mixed-batch mergedSingleFields  (already done in Step 6-9)
8-6            form-vs-store marketplace mismatch
8-8   TEST     store-level lock-2 tests + the revert check                           ← blocker (d) NEW
8-8b  TEST     lock-3 tests: move routingPatchFromAi to src/ + unit + seam + reverts ← 2026-08-19 NEW
8-9   FIX+TEST onConfirm must clear the category in the SAME patch                   ← blocker (c) NEW
8-10  FIX+TEST C4's missingRouting() single-mode submit guard                        ← C4 NEW
8-11           tsc + the full jest run
```


### Step 8-1. Lock 1 — `MARKETPLACE_LOCKED`

`src/features/scanner/components/detail/MarketplaceCard.tsx`. The card stops being a card: its pill
row moves into `MarketplaceSheet` (Step 8-6) and the card itself renders nothing. Replace the whole
file:

```tsx
/**
 * MULTI-MARKETPLACE UNLOCK (M-3/M-4).
 *
 * This card is intentionally EMPTY. Before the unlock it hid a four-pill
 * marketplace picker behind `MARKETPLACE_LOCKED = true`; that picker now lives
 * in `MarketplaceSheet`, opened from `RoutingChip` at the top of the review
 * screen — the marketplace is a routing DECISION to confirm, not the tenth
 * form field on a ~3,200 px scroll (plan §6.1).
 *
 * The component is kept (rather than deleted) because it is mounted from two
 * screens — app/scan/detail.tsx and app/scan/grouped-edit.tsx — and rendering
 * a picker in either would be the DUPLICATE CONTROL that UX_DESIGN_RULES.md
 * ("Remove duplication") forbids: two controls writing `marketplace` also
 * re-opens the hydration race documented in useDetailController.ts:78-82.
 *
 * Delete this file and its two mount sites in the §6.3 review-screen
 * restructure, not here.
 */
export function MarketplaceCard() {
  return null;
}
```

Because the file no longer imports `MARKETPLACE_OPTIONS`, `Sheet`-free, `haptics`-free etc., `tsc`
will flag nothing; run `npm run lint` to confirm no unused-import warnings remain.

### Step 8-2. Lock 2 — the apply path takes the AI's marketplace

`src/stores/scanDraftStore.ts`. Add near the top of the file, beside the existing
`@/features/scanner/*` imports (`:3-16`):

```ts
import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  routingNeedsAsk,
  shouldPrefillCategory,
  signalFromSmartFields,
} from '@/features/scanner/routing/routingState';
import { supportedNow } from '@/features/scanner/routing/supportedMarketplacesCache';
import type { CategorySource, RoutingSource } from '@/features/scanner/routing/routingState';
```

> ⚠️ **`supportedMarketplacesCache`, never `supportedMarketplaces`.** The latter imports
> `@/api/greenbidzClient`, which calls `attachGreenbidzInterceptors` at module load
> (`greenbidzClient.ts:24`) and pulls axios + `services/auth/logout` + `features/lab/messages/socket`
> into this store's graph — and therefore into `scanDraftStore.test.ts` and
> `scanDraftStore.hydrate.test.ts`. Step 7-12's first grep is the guard.
>
> ⚠️ `routingState.ts` is imported **by value** here. That is safe **only** because every import in
> `routingState.ts` is `import type` (Step 6-7's verification grep). A value import added there would
> create a genuine runtime require cycle `scanDraftStore → routingState → scanDraftStore`.

Add this one helper immediately above `draftFromSmartFields` (`:369`). Note that the earlier draft added
**three** local functions here — `supportedNow`, `routingNeedsAsk` and `pickAppliedMarketplace`. The first
two are now imported: `supportedNow` from the axios-free cache module (blocker (e)) and `routingNeedsAsk`
from `routingState.ts` (blocker (d), the one home). Only the marketplace pick is store-local, because it is
the only one that needs `getSiteType()`:

```ts
/**
 * M-4 lock 2. Adopt the AI's marketplace only when the server list allows it;
 * otherwise keep the deployment default (`routingNeedsAsk` then makes the chip
 * ask, so an unsupported suggestion is never silently swallowed).
 */
function pickAppliedMarketplace(
  suggested: MarketplaceKey | null,
  supported: MarketplaceKey[],
): MarketplaceKey {
  if (suggested && supported.includes(suggested)) return suggested;
  return marketplaceFromSiteType(getSiteType());
}
```

Then replace `:408-413` (the `// Marketplace is LOCKED…` comment plus the `marketplace:` line) inside
`draftFromSmartFields` with the block below. **Order matters**: the cleared category fields must come
*after* `categoryId: fields.categoryId` (`:390`) and `categoryName: fields.categoryName` (`:391`) in the
same object literal, or the spread does nothing. It does, at `:408-413` — verified.

```ts
    // ── M-4 lock 2 + §0.5 owner decision ─────────────────────────────────
    //
    // The AI's detected marketplace now REACHES the draft.
    //
    // `supportedNow()` reads the M-12 MMKV cache SYNCHRONOUSLY (this function is
    // pure and runs inside `applySmartDetection`, :850 and :862). The cache is
    // warmed at app launch by `app/_layout.tsx`'s prefetch — Step 7-10. Without
    // that prefetch this reads ONE marketplace on a fresh install and the whole
    // unlock is a no-op on the first scan; the two ship together.
    //
    // ⚠️ This is the ONLY place the AI may write `marketplace`, and it happens
    // ONCE at draft construction. Never write it from a `watch` effect —
    // MarketplaceCard.tsx (pre-unlock) and useDetailController.ts:78-82 both
    // document the hydration race that caused: the form's default flips to the
    // AI's value, a marketplace watch-effect reads that as a user switch, and
    // the AI's auto-filled category is wiped before the tree even loads.
    marketplace: appliedMarketplace,
    marketplaceConfirmed: !mustAsk,
    needsClearerPhoto: fields.needsClearerPhoto,
    siteTypeConfidence: fields.siteTypeConfidence,
    siteTypeSource: fields.siteTypeSource,
    categorySource: fields.categorySource,
    // §0.5 OWNER DECISION — APPROVED 2026-08-18. When the routed marketplace's
    // tree cannot produce a trustworthy default (machines: `pickDefaultParent`
    // returns tree[0] = 5300 "Boring & Drilling Machines"; recycle: zero id
    // overlap) or the server itself says `category_source: 'unresolved'`, the
    // AI's category is NOT presented as an answer. It must be CLEARED here, in
    // the write — CategoryConditionCard only clears ids that are absent from
    // the loaded tree (:124 validity check → :157 clear), and a machines id
    // under a machines marketplace IS present, so nothing downstream would ever
    // drop it. `RoutingChip`'s `categoryNotSet` line is the explanation; this
    // spread is the mechanism.
    //
    // DRAFT shape (categoryId/categoryName -> null), matching emptyDraft
    // (:223-224). The FORM shape is a different constant — see Step 9-5.
    ...(prefill ? {} : CLEARED_CATEGORY_DRAFT_FIELDS),
```

and compute the five locals at the top of `draftFromSmartFields`, right after
`const base = emptyDraft(photos);` (`:374` — verified):

```ts
  // One read of the supported list, shared by all three decisions below, so a
  // mid-function cache write cannot make them disagree with each other.
  const supported = supportedNow();
  const signal = signalFromSmartFields(fields);
  const appliedMarketplace = pickAppliedMarketplace(fields.suggestedMarketplace, supported);
  const mustAsk = routingNeedsAsk({ signal, supported });
  const prefill = shouldPrefillCategory({ marketplace: appliedMarketplace, signal });
```

**Note what is NOT here any more.** The earlier draft defined a local `supportedNow()` *and* a local
`routingNeedsAsk(fields)` inside this file — a second hand-written copy of the trigger, with a comment
claiming `routingState.test.ts` asserted the two identical. It did not, and could not: that suite never
imports the store. Both now come from `routingState.ts` (Step 6-7), and Step 6-8's
`agrees with routingNeedsAsk on every combination it can reach` is the test that keeps the deriver and
the persisted answer as one decision.

**`prefill` is computed from `appliedMarketplace`, not from `fields.suggestedMarketplace`.** If the AI
said `101machine` but the server list withholds it, the draft lands on `101lab` and the *lab* tree's
category is the one being judged — so it may legitimately pre-fill. Judging the AI's rejected verdict
would clear a category that was fine.

### Step 8-3. Lock 3 — patch the marketplace on the analyze path

`app/scan/processing.tsx`. **⚠️ Read this before you paste — the obvious placement is wrong.**

The `patchRef.current({ … })` object literal in the analyze `onSuccess` (`:489`) assigns the AI's
category **after** `:504-508`:

```tsx
:512              ...(ai.prices ? { aiPrices: ai.prices } : {}),
:513-517          // Category — single-product analyze path was previously dropping …
:518              ...(ai.categoryId
:519                ? { categoryId: ai.categoryId, categoryName: ai.categoryName ?? null }
:520                : {}),
:521-526          ...(ai.locations && …),
:527              lastStep: 'detail',
:528            });
```

(All line numbers opened and confirmed 2026-08-18.) A later key in an object literal **wins**, so a
`...routingPatchFromAi(ai)` spread placed at `:504-508` would have its category clear silently undone by
`:518-520` two lines later — the exact bug class §0.5 exists to prevent, reintroduced by placement.

**So: leave a pointer comment where the old dead comment was, and put the spread LAST**, immediately
before `lastStep: 'detail',` (`:527`).

Replace the comment block at `:504-508` with:

```tsx
              grade:        ai.grade ?? 'A',
              // M-4 lock 3 — the marketplace/routing patch is NOT here. It is
              // the LAST spread in this object (just above `lastStep`), because
              // it may CLEAR the category and the `ai.categoryId` spread below
              // would otherwise overwrite the clear. See routingPatchFromAi.
```

and insert, immediately before `lastStep: 'detail',`:

```tsx
              // ── M-4 lock 3 + §0.5 owner decision ───────────────────────
              // The analyze path (`/wp/analyze-process-images`, reached when
              // `useSmart === false`, i.e. manual GROUPED mode — see :113) now
              // applies the AI's detected marketplace too.
              //
              // LAST on purpose: when the routed tree is untrusted this spread
              // clears the five category fields, and it must therefore come
              // AFTER the `ai.categoryId` spread above.
              //
              // Shares lock 2's decision functions rather than re-deriving the
              // trigger inline: `routingNeedsAsk` and `shouldPrefillCategory`
              // live in routingState.ts and have ONE implementation
              // (blocker (d)). The earlier draft's inline IIFE was a third
              // hand-written copy.
              ...routingPatchFromAi(ai),
              lastStep: 'detail',
```

and add this helper above the component in `app/scan/processing.tsx` (module scope, so it is not
re-created per render):

```tsx
import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  routingNeedsAsk,
  shouldPrefillCategory,
  signalFromAiResult,
} from '@/features/scanner/routing/routingState';
import { supportedNow } from '@/features/scanner/routing/supportedMarketplacesCache';
import { marketplaceFromSiteType } from '@/features/scanner/constants';
import { getSiteType } from '@/services/scanner/buildFormData';
import type { AiResult, DraftItem } from '@/stores/scanDraftStore';

/**
 * M-4 lock 3. The analyze path's half of lock 2, expressed with the SAME two
 * decision functions so the two paths cannot drift.
 *
 * `marketplace` is patched ONLY when the AI named a supported marketplace, so an
 * absent or off-list verdict leaves `emptyDraft`'s env default in place rather
 * than clobbering it with a guess. `marketplaceConfirmed` records whether the
 * chip must ask, and the category is cleared when the routed tree cannot be
 * trusted (§0.5).
 */
function routingPatchFromAi(ai: AiResult): Partial<DraftItem> {
  const supported = supportedNow();
  const signal = signalFromAiResult(ai);
  const usable =
    signal.suggestedMarketplace && supported.includes(signal.suggestedMarketplace)
      ? signal.suggestedMarketplace
      : null;
  const marketplace = usable ?? marketplaceFromSiteType(getSiteType());
  const prefill = shouldPrefillCategory({ marketplace, signal });
  return {
    ...(usable ? { marketplace: usable } : {}),
    marketplaceConfirmed: !routingNeedsAsk({ signal, supported }),
    needsClearerPhoto: signal.needsClearerPhoto,
    siteTypeConfidence: signal.siteTypeConfidence,
    siteTypeSource: signal.siteTypeSource,
    categorySource: signal.categorySource,
    ...(prefill ? {} : CLEARED_CATEGORY_DRAFT_FIELDS),
  };
}
```

> ⚠️ `supportedMarketplacesCache`, not `supportedMarketplaces` — same import rule as the store
> (Step 7-12 grep #1).
>
> ⚠️ `marketplace` for the prefill judgement is `usable ?? env default`, i.e. **what the draft will
> actually hold**, which is the same rule Step 8-2 uses. Judging `signal.suggestedMarketplace` when the
> server withheld it would clear a category for a marketplace the draft is not going to.
>
Prove the ordering after you edit — this is a two-line check that catches the whole failure mode:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
grep -n "ai.categoryId\|routingPatchFromAi(ai)\|lastStep: 'detail'" app/scan/processing.tsx
# The `ai.categoryId` line number MUST be SMALLER than the `routingPatchFromAi(ai)` line number,
# and `routingPatchFromAi(ai)` MUST be immediately above `lastStep: 'detail'`.
```

### Step 8-4. Guard 1 — the currency stays USD (§6.4)

`src/features/scanner/mapSmartDetection.ts`. This is a **lock, not a behaviour change** — verified:
every call site already passes `getSiteType()` (the deployment's site), namely
`smartDetect.ts:56`, `:147`, `smartDetectStream.ts:241`, `recognitionJobClient.ts:307`,
`pendingAiResume.ts:84`, so `mapProductData` returns USD today on a `LabGreenbidz` build. The risk is
that a future implementer, having just made the marketplace follow the AI, makes the currency follow
too — a **31.5×** mispricing for `101it` (`defaultCurrencyForSite` → `'TWD'`, `constants.ts:80-82`;
`FX_RATE_TWD_PER_USD = 31.5`, `currencyFx.ts:11`) with no conversion between `:153` and `:157`.

Make that impossible to do by accident: rename the parameter so a detected site type cannot be
passed in silently. In `mapProductData` (`:152`) and `mapSmartDetection` (`:231-234`):

```ts
export function mapProductData(
  data: SmartProductData,
  /**
   * ⚠️ THE DEPLOYMENT'S site type (`getSiteType()`), NEVER `data.site_type`.
   * Plan §6.4: the marketplace does NOT drive the currency on the AI path. The
   * backend always returns USD (prompt at controller/wordPressSmart.js:374/:386/:398/:409)
   * and nothing between `pickPrice` (:153) and `defaultCurrencyForSite` (:157)
   * converts, so relabelling a USD number as TWD for 101it is a 31.5×
   * under-price written straight to `_product_currency`. TWD-native pricing is
   * a BACKEND change (return TWD prices), not an app-side relabel.
   */
  deploymentSiteType: string,
): SmartItemFields {
```

and replace the two body uses:

```ts
  const currency = defaultCurrencyForSite(deploymentSiteType);
```

```ts
export function mapSmartDetection(
  res: SmartDetectionResponse,
  deploymentSiteType: string,
): MappedSmartDetection {
```

with `fields: mapProductData(p.data ?? {}, deploymentSiteType)` at `:250` and the merged call from
Step 6-9. **Do not change any call site** — the argument they pass is already correct.

Keep the existing test at `src/features/scanner/__tests__/mapSmartDetection.test.ts:118-122`
(`mapProductData(…, '101it') → TWD`) exactly as it is. It asserts `defaultCurrencyForSite`'s
contract for the **deployment** path (a hypothetical 101it *build*), which §6.4 preserves. The new
test in Step 2 asserts the other half: a **detected** 101it item on a lab build stays USD.

### Step 8-5. Guard 2 — the mixed-batch `mergedSingleFields` fallback

Already done in Step 6-9 (it had to precede the test rerun). No further work.

### Step 8-6. Fix the form-vs-store marketplace mismatch this unlock activates

Found while verifying, **not in the parent plan**:

- `CategoryConditionCard.tsx:46-47` renders its tree from the **form**: `watch('marketplace')` →
  `useLabCategories(marketplace)`.
- `useDetailController.ts:55-56` builds the option list `buildDraftPatch` uses for the
  `categoryName` lookup from the **store**: `useScanDraft((s) => s.current?.marketplace)`.
- `grouped-edit.tsx:67` does the same from `item?.marketplace`.

Today these are always equal because the picker is hidden. The moment the chip can change the form
value before the next store patch, `buildDraftPatch`'s
`categoryOptions?.find((o) => o.id === values.categoryId)` (`formMapping.ts:133`) misses and
`categoryName` lands `null`. **Corrected impact (re-checked 2026-08-18): NOT cosmetic.** `categoryName` is
rendered nowhere in the scan flow (grepped), but it **is submitted**: `getSubmittedCategory`
(`buildFormData.ts:34-38`) returns `{id, name}` and both submit builders append the name —
`fd.append('category_name', submittedCategory.name)` at **`:164`** on the single path and
`meta.category_name = submittedCategory.name` at **`:271`** on the grouped path (the ids are the
`:161` / `:270` lines the plan cited). So a `null` `categoryName` silently drops `category_name`
from the payload. Fix it; it is one line each.

`useDetailController.ts:55-56`:

```ts
  const createListing = useCreateListing();
  // Read the marketplace from the FORM, not the store: CategoryConditionCard
  // renders its tree from `watch('marketplace')` (:46-47), so reading the
  // store here would resolve `categoryName` against the PREVIOUS
  // marketplace's tree after the RoutingChip changes the form value.
  const currentMarketplace = form.watch('marketplace');
  const categories = useLabCategories(currentMarketplace);
```

⚠️ `form` is created at `:51`. Move the `form = useForm(...)` block (`:51-55`) **above** this pair, or
`form` is used before initialisation. Order after the edit: `useForm` → `form.watch` →
`useLabCategories`.

`grouped-edit.tsx:67` — same substitution, using the form created at `:70-73` (again, move the
`useForm` block above it):

```ts
  const categories = useLabCategories(form.watch('marketplace'));
```

### Step 8-8. Store-level tests for lock 2 — blocker (d), the missing test

**What was wrong.** §1's table claimed `marketplaceUnlock.test.ts` covers "apply path takes the AI
marketplace". It does not and cannot: every test in it calls `mapProductData` / `mapSmartDetection`, so
reverting Step 8-2 to `marketplace: marketplaceFromSiteType(getSiteType())` leaves the whole suite green.
The headline behaviour of this phase had **no test at all**.

**Where it goes.** `src/stores/__tests__/scanDraftStore.test.ts` already drives `applySmartDetection`
with an in-memory MMKV mock — the mock is at **`:23-33`** (the brief said `:181`; corrected) and the
`applySmartDetection forceMode override` describe is **`:150-238`** with calls at `:184`, `:201`, `:218`
and `:231`. Extend that file rather than creating a new one: the mocks, the `beforeEach` reset (`:44-46`)
and the `photo()` helper (`:41`) are already there.

Add to the top of the file, beside the existing mocks — this is what makes the supported list
controllable from a test:

```ts
import { writeCachedSupported } from '@/features/scanner/routing/supportedMarketplacesCache';
import type { MarketplaceKey } from '../scanDraftStore';
```

and append this describe block:

```ts
describe('M-4 lock 2 — applySmartDetection adopts the AI marketplace', () => {
  // A minimal two-product response where product 0 is 101it and product 1 is lab,
  // so we can watch the queue take TWO different marketplaces.
  const MIXED: SmartDetectionResponse = {
    success: true,
    language: 'en',
    detection: { suggested_mode: 'multiple', confidence: 0.9, summary: '2 items' },
    merged_single: {
      name: 'ASUS PA279CV', equipment_description: 'monitor', condition: 'used',
      price: '450', site_type: '101it',
    },
    products: [
      {
        id: 'p-0', image_indexes: [0], document_indexes: [],
        data: {
          name: 'ASUS PA279CV', equipment_description: 'monitor', condition: 'used',
          price: '450', site_type: '101it',
          product_cat: { id: '5501', name: 'Monitors' },
        },
      },
      {
        id: 'p-1', image_indexes: [1], document_indexes: [],
        data: {
          name: 'Hsiangtai CN-1050', equipment_description: 'centrifuge', condition: 'used',
          price: '1200', site_type: 'LabGreenbidz',
          product_cat: { id: '5375', name: 'Lab Infrastructure & Essentials' },
        },
      },
    ],
    suggested_terms: {},
  } as unknown as SmartDetectionResponse;

  const machinesItem = (over: Record<string, unknown> = {}) =>
    ({
      success: true,
      language: 'en',
      detection: { suggested_mode: 'single', confidence: 0.9, summary: '1 item' },
      merged_single: {
        name: 'Lincoln welding fixture', equipment_description: 'fixture',
        condition: 'used', price: '900', site_type: 'machines',
        product_cat: { id: '5300', name: 'Boring & Drilling Machines' },
        ...over,
      },
      products: [
        {
          id: 'p-0', image_indexes: [0], document_indexes: [],
          data: {
            name: 'Lincoln welding fixture', equipment_description: 'fixture',
            condition: 'used', price: '900', site_type: 'machines',
            product_cat: { id: '5300', name: 'Boring & Drilling Machines' },
            ...over,
          },
        },
      ],
      suggested_terms: {},
    }) as unknown as SmartDetectionResponse;

  const warm = (list: MarketplaceKey[]) => writeCachedSupported(list);

  // ⛔ THE TEST THIS PHASE EXISTS FOR. Revert Step 8-2 to
  // `marketplace: marketplaceFromSiteType(getSiteType())` and this goes RED.
  it('takes the AI marketplace per product when the server list allows it', async () => {
    warm(['101lab', '101machine', '101it']);
    const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
    await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

    const q = useScanDraft.getState().queuedItems;
    expect(q).toHaveLength(2);
    expect(q[0].marketplace).toBe('101it');
    expect(q[1].marketplace).toBe('101lab');
  });

  // ⛔ blocker (a) — the COLD-CACHE hole, as a unit test. With no cache warmed,
  // `supportedNow()` is ['101lab'], so the AI's 101it verdict is discarded AND
  // the draft is stamped confirmed. This test PINS that as the fail-closed
  // contract, which is why V-0 (a warm first scan) has to be an on-device check:
  // this is what the release-day bug looks like, and it is indistinguishable
  // from correct fail-closed behaviour from inside a unit test.
  it('falls back to the deployment marketplace and does NOT ask when the cache is cold', async () => {
    const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
    await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

    const q = useScanDraft.getState().queuedItems;
    expect(q[0].marketplace).toBe('101lab');       // 101it discarded
    expect(q[0].marketplaceConfirmed).toBe(true);  // 1.0.3 behaviour, no chip
  });

  it('keeps the deployment marketplace and ASKS when the AI names a withheld one', async () => {
    warm(['101lab', '101machine']);                // 101it withheld
    const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
    await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');

    const q = useScanDraft.getState().queuedItems;
    expect(q[0].marketplace).toBe('101lab');
    expect(q[0].marketplaceConfirmed).toBe(false); // the chip must ask
    expect(q[1].marketplaceConfirmed).toBe(true);  // lab item is fine
  });

  it('asks when needs_clearer_photo is true, and persists that on the draft', async () => {
    warm(['101lab', '101machine', '101it']);
    const mapped = mapSmartDetection(
      machinesItem({ needs_clearer_photo: true }),
      'LabGreenbidz',
    );
    await useScanDraft.getState().applySmartDetection(mapped, [photo(0)], 'single');

    const cur = useScanDraft.getState().current!;
    expect(cur.needsClearerPhoto).toBe(true);
    expect(cur.marketplaceConfirmed).toBe(false);
  });

  // ⛔ §0.5 OWNER DECISION — APPROVED 2026-08-18. A machines-routed item must
  // NOT arrive carrying "Boring & Drilling Machines" as though the seller had
  // picked it. Note the AI's id IS valid for the machines tree, so
  // CategoryConditionCard would never clear it — the clear has to happen here.
  it('clears the AI category on a machines-routed item', async () => {
    warm(['101lab', '101machine', '101it']);
    const mapped = mapSmartDetection(machinesItem(), 'LabGreenbidz');
    expect(mapped.products[0].fields.categoryId).toBe('5300');   // the AI DID send one

    await useScanDraft.getState().applySmartDetection(mapped, [photo(0)], 'single');

    const cur = useScanDraft.getState().current!;
    expect(cur.marketplace).toBe('101machine');
    expect(cur.categoryId ?? '').toBe('');
    expect(cur.categoryName ?? '').toBe('');
    expect(cur.parentCategoryId ?? '').toBe('');
    expect(cur.customSubcategory ?? '').toBe('');
  });

  it('keeps the AI category on a lab-routed item', async () => {
    warm(['101lab', '101machine', '101it']);
    const mapped = mapSmartDetection(MIXED, 'LabGreenbidz');
    await useScanDraft.getState().applySmartDetection(mapped, [photo(0), photo(1)], 'grouped');
    expect(useScanDraft.getState().queuedItems[1].categoryId).toBe('5375');
  });
});
```

Two things to get right when you paste:

1. **Clear the MMKV mock between tests, or `warm()` leaks.** The existing `beforeEach` (`:44-46`) only
   calls `useScanDraft.getState().reset()`. Extend the mmkv mock to expose its `Map` (as in Step 7-11's
   test) and clear it in the same `beforeEach`:
   ```ts
   beforeEach(() => {
     (mmkv as unknown as { __store: Map<string, string> }).__store.clear();
     useScanDraft.getState().reset();
   });
   ```
   Without this, the cold-cache test passes or fails depending on file order — the worst kind of flake.
2. **`emptyDraft`'s marketplace comes from `getSiteType()`**, which returns `'LabGreenbidz'` → `'101lab'`
   in the test env (`buildFormData.ts:290-293`, no `expoConfig.extra`). That is what makes `'101lab'` the
   expected fallback above.

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx jest src/stores/__tests__/scanDraftStore.test.ts
```

Expected: the file's existing tests plus **6 new** ones, all passing. Baseline for this one file was
measured today as part of the three-suite run; the three suites together were **27 tests**, so Step 7-12's
re-run should now report **33**.

**Then prove the test bites** (60 seconds, and it is the only thing that proves blocker (d) is closed):

```bash
# Temporarily revert lock 2 and watch the suite go red.
#   scanDraftStore.ts: marketplace: pickAppliedMarketplace(...)  ->  marketplaceFromSiteType(getSiteType())
npx jest src/stores/__tests__/scanDraftStore.test.ts   # EXPECT: FAIL on "takes the AI marketplace per product"
# Put it back.
npx jest src/stores/__tests__/scanDraftStore.test.ts   # EXPECT: PASS
```

If the suite stays green with lock 2 reverted, you have written the same non-test the old plan had.

### Step 8-8b. Tests for **lock 3** — the gap Step 8-8 left open  *(added 2026-08-19, post-device review)*

**What was wrong — the same shape as Step 8-8, one step further along.** Step 8-8 closed the store
half of the routing patch (lock 2) and its revert check bites. It never asked for the equivalent on
the ANALYZE half (Step 8-3, lock 3), and nothing else did either. Measured on
`feat/app-store-account-deletion` @ 003b1d6: deleting the single spread `...routingPatchFromAi(ai)`
from `app/scan/processing.tsx` (~`:568`) removed **all** of lock 3 —

- the marketplace adoption,
- `marketplaceConfirmed`,
- all four carried routing fields (`needsClearerPhoto`, `siteTypeConfidence`, `siteTypeSource`,
  `categorySource`),
- and the approved §0.5 "do not pre-fill a machines/recycle category" clear

— and the full suite stayed **123 suites / 1147 tests green with `tsc` at exit 0**. Nothing noticed.
GROUPED scans always take that branch (`useSmart === false`), so this is the most travelled path in
the feature and it was the least guarded. That is the **third** time on this project that a phase's
headline behaviour was free to delete (Step 8-8 was the first, Step 8-10's call site the second), so
the rule below is now the standing one.

> **STANDING RULE for every future phase.** A behaviour that lives in a route file under `app/` has
> no test until it has BOTH halves. Route files are not renderable under jest (expo-router, React
> Query, MMKV, the SSE client), so a unit test of the decision passes happily while the call site is
> gone, and a source assertion on the call site passes happily while the decision is wrong. Write:
>   1. the DECISION as a pure function in `src/`, unit-tested directly; and
>   2. the CALL SITE as a source assertion in the matching `*Wiring.test.ts`.
>
> If the decision is currently a module-scope helper INSIDE the route file, it is not testable at
> all — move it to `src/` first. That move is part of the test work, not a refactor to defer.

**What was done.**

1. `routingPatchFromAi` moved from `app/scan/processing.tsx` to
   `src/features/scanner/routing/routingState.ts`, beside the two decision functions it composes.
   It is PURE: `supported` and `fallbackMarketplace` are arguments, the same trick `routingNeedsAsk`
   uses, so `routingState.ts` stays import-type-only and blocker (d) stays satisfied. The two impure
   reads (`supportedNow()`, `marketplaceFromSiteType(getSiteType())`) moved to the call site — which
   also keeps `processing.tsx` importing `supportedMarketplacesCache`, as
   `routing/__tests__/importDiscipline.test.ts` requires.

   ```ts
   ...routingPatchFromAi({
     ai,
     supported: supportedNow(),
     fallbackMarketplace: marketplaceFromSiteType(getSiteType()) ?? '101lab',
   }),
   ```

2. **17 unit tests** appended to `src/features/scanner/__tests__/routingState.test.ts`, in four
   describes: marketplace adoption (including that the key is OMITTED, not set to `undefined`, when
   the verdict is absent or off-list), the confirmed/ask answer (all four ask triggers plus the
   single-marketplace fail-closed case), the four carried fields, and the §0.5 clear. Two of them pin
   the subtlety the call site's comment describes and that no other test reached: the prefill is
   judged against the marketplace the draft will **actually hold**, so a REJECTED machines verdict
   must not clear a perfectly good lab category, and a build whose OWN marketplace is untrusted must
   still clear when the AI named nothing.

3. **5 source-seam assertions** appended to `src/features/scanner/__tests__/routingWiring.test.ts`
   (new `PROCESSING` constant), following the pattern already used for the other three screens: the
   spread is present; it is imported from routingState and defined nowhere locally; it is passed the
   live supported list and the build fallback rather than hardcoded values; and it is still the LAST
   spread in the patch — after `...(ai.categoryId` and before `lastStep` — which is the ordering the
   §0.5 clear depends on. All assertions are single-line fragments: `processing.tsx` has MIXED line
   endings (1183 CRLF + 5 LF-only lines), so anything spanning a newline would pin bytes that have
   already drifted once.

4. `importDiscipline.test.ts`'s "exactly ONE definition" sweep now also covers
   `routingPatchFromAi`, so a copy cannot drift back into a route file.

**Revert checks (both run, both bite).**

| deletion | suite | result |
|---|---|---|
| the `...routingPatchFromAi({…})` spread in `processing.tsx` | routingWiring | **3 failed** / 69 passed |
| `...(prefill ? {} : CLEARED_CATEGORY_DRAFT_FIELDS)` inside the function | routingState | **4 failed** / 45 passed |

Each half is restored byte-exact and SHA256-verified. Note that the first deletion leaves the 17 unit
tests green and the second leaves the 5 seam assertions green — which is precisely why both halves
are required.

**Expected after Step 8-8b:** `routingState.test.ts` 49 tests, `routingWiring.test.ts` 20 tests,
`src/features/scanner` 36 suites / 340 tests, `tsc` exit 0.

---

### Step 8-9. Fix `onConfirm` restoring the old category — blocker (c)

**The bug, verified end to end today.**

1. `useDetailController.ts:69-76`:
   ```ts
   const draft = useScanDraft((s) => s.current);
   useEffect(() => {
     if (!draft) { router.replace(routes.scanHome); return; }
     reset(draftToFormValues(draft));
   }, [draft, reset]);
   ```
   The effect depends on the **draft object identity**.
2. `scanDraftStore.ts:711-719` — `patch()` builds `const next = { ...cur, ...partial }` and
   `set({ current: next })`, i.e. **a new object every time**.
3. `formMapping.ts:78` — `draftToFormValues` maps `categoryId: draft.categoryId ?? ''`.

So the sequence the old Step 9-5 produced was: chip's `setValue('categoryId','')` → `onConfirm` →
`patch({ marketplace, marketplaceConfirmed })` → new `current` identity → effect fires →
`reset(draftToFormValues(draft))` → **the OLD categoryId is written back into the form**, now paired with
the NEW marketplace. Submit then sends `product_category_ids` from the previous tree
(`buildFormData.ts:161`) with `allowed_sites[]` from the new one (`:223-224`) — precisely the wrong-tree
failure §5 exists to prevent. On the grouped path the same thing happens differently: `patchQueuedItem`
(`scanDraftStore.ts:795-809`) merges immediately, so the stored item carries the new marketplace with the
old categoryId, and if the seller leaves via the app bar / hardware back instead of Save, that pair
persists and `grouped-review` counts the row **ready**.

**The fix.** `onConfirm` must write the cleared category fields into the **same store patch**. The
`setValue` calls stay too — they are what updates the form on the grouped-edit screen, which has **no**
reset effect (`grouped-edit.tsx:70-73` sets `defaultValues` once and never resets) — but the store patch
is the source of truth on the single path. Both call sites are written out in Steps 9-5 and 9-6.

Add the test. Create `src/features/scanner/components/detail/__tests__/onConfirmPatch.test.ts`:

```ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('@/services/upload/persistPhotos', () => ({
  persistPhotosForDraft: jest.fn(async (p: unknown[]) => p),
  persistDocumentsForDraft: jest.fn(async (d: unknown[]) => d),
  verifyDraftPhotos: jest.fn(async () => true),
  verifyDraftDocuments: jest.fn(async () => true),
  verifyScanSessionFiles: jest.fn(async () => true),
}));
jest.mock('@/lib/mmkv', () => {
  const store = new Map<string, string>();
  return {
    mmkv: {
      set: (k: string, v: string) => store.set(k, v),
      getString: (k: string) => store.get(k),
      remove: (k: string) => store.delete(k),
      __store: store,
    },
  };
});

import { CLEARED_CATEGORY_DRAFT_FIELDS } from '@/features/scanner/routing/routingState';
import { useScanDraft } from '@/stores/scanDraftStore';

/**
 * The EXACT patch both onConfirm call sites build (detail.tsx Step 9-5,
 * grouped-edit.tsx Step 9-6). Kept here as the shared shape so the test and the
 * screens cannot disagree; if you extract it to a helper, import that instead.
 */
const confirmPatch = (marketplace: '101lab' | '101machine' | '101it' | '101recycle') => ({
  marketplace,
  marketplaceConfirmed: true,
  ...CLEARED_CATEGORY_DRAFT_FIELDS,
});

beforeEach(() => {
  (require('@/lib/mmkv').mmkv as { __store: Map<string, string> }).__store.clear();
  useScanDraft.getState().reset();
});

describe('blocker (c) — changing the marketplace must not restore the old category', () => {
  it('clears all five category fields in the SAME patch as the marketplace', async () => {
    await useScanDraft.getState().start([{ uri: 'file://0.jpg', width: 1, height: 1 }]);
    useScanDraft.getState().patch({
      marketplace: '101lab',
      categoryId: '5375',
      categoryName: 'Lab Infrastructure & Essentials',
      parentCategoryId: '5371',
      parentCategoryName: 'Lab',
      customSubcategory: 'Acme',
      marketplaceConfirmed: false,
    });
    expect(useScanDraft.getState().current?.categoryId).toBe('5375');

    useScanDraft.getState().patch(confirmPatch('101machine'));

    const cur = useScanDraft.getState().current!;
    expect(cur.marketplace).toBe('101machine');
    expect(cur.marketplaceConfirmed).toBe(true);
    // ⛔ The whole point. A patch carrying only `marketplace` leaves these set,
    // and useDetailController.ts:69-76's reset then writes them back into the
    // form — a lab category id submitted with allowed_sites:['machines'].
    expect(cur.categoryId ?? '').toBe('');
    expect(cur.categoryName ?? '').toBe('');
    expect(cur.parentCategoryId ?? '').toBe('');
    expect(cur.parentCategoryName ?? '').toBe('');
    expect(cur.customSubcategory ?? '').toBe('');
  });

  it('the same patch shape works on the grouped queue (back-out safety)', async () => {
    await useScanDraft.getState().start([{ uri: 'file://0.jpg', width: 1, height: 1 }]);
    useScanDraft.getState().patch({ marketplace: '101lab', categoryId: '5375' });
    useScanDraft.getState().enqueueCurrentItem();

    useScanDraft.getState().patchQueuedItem(0, confirmPatch('101machine'));

    const item = useScanDraft.getState().queuedItems[0];
    expect(item.marketplace).toBe('101machine');
    expect(item.categoryId ?? '').toBe('');
  });
});
```

Signatures verified today so this compiles as written: `start: (photos: Photo[]) => Promise<void>`
(`scanDraftStore.ts:555`, impl `:681`), `enqueueCurrentItem: () => void` (`:562`),
`patch: (partial: Partial<DraftItem>) => void` (`:558`), `patchQueuedItem: (index: number, patch:
Partial<DraftItem>) => void` (`:573`, impl `:795-809`).

```bash
npx jest src/features/scanner/components/detail/__tests__/onConfirmPatch.test.ts
```

Expected: **1 suite, 2 tests passed.**

### Step 8-10. C4 — the single-mode Submit guard in `useDetailController.ts`

**Why this step exists, and why it is not optional.** Integration **C4** — and it is **already true in
the tree**, because Phase 5 landed at `45abb39`:

- `DetailFooter.tsx:110` is now `disabled={!!submitting}` for the single-mode Submit. `allRequired` still
  gates the three **grouped** buttons (`:74`, `:85`, `:91`), so Step 9-5's footer gate is not useless —
  it is **inert on the single-item path**.
- `marketplaceConfirmed` is a **`DraftItem`** field, not a `detailSchema` field — verified: `detailSchema`
  (`schema.ts:20-61`) has no such key — so `handleSubmit` cannot see it and `onInvalid` can never fire
  for it.
- Result without this step: **an item with `marketplaceConfirmed: false` submits.**

The "express it as a visible required row" alternative does not work as written either:
`getRequiredStatus(values, photoCount)` is called with **form values only** (`detail.tsx:114`, verified),
and `marketplaceConfirmed` is not in the form. Phase 5's implementer reached the same conclusion and left
the seam comment at `useDetailController.ts:187-200` naming this fix by name.

The minimum correct fix, from integration §2 C4. In `useDetailController.ts`, immediately after
`missingPhotos` (`:180-185`) and **replacing the seam comment at `:187-200`**:

```ts
import { isRoutingResolved } from '@/features/scanner/routing/routingState';

  /**
   * C4 — after Phase 5 the single-mode Submit is no longer disabled on state
   * (DetailFooter: `disabled={!!submitting}`), and `marketplaceConfirmed` is a DRAFT
   * field, not a `detailSchema` field — so `handleSubmit` cannot see it and
   * `onInvalid` can never fire for it. Without this guard Phase 4's routing gate is
   * bypassed on the single-item path. Mirrors `missingPhotos()` exactly.
   */
  const missingRouting = (): boolean => {
    const draftNow = useScanDraft.getState().current;
    if (!draftNow || isRoutingResolved(draftNow)) return false;
    haptics.error();
    Alert.alert(
      t('mobile.groupedEdit.missingTitle', { defaultValue: 'Some fields are missing' }),
      t('mobile.detail.routing.askCta', { defaultValue: 'Choose a marketplace to continue' }),
    );
    return true;
  };
```

and in `submitSingleValidated` (`:202`), directly after the existing `missingPhotos()` line (`:203`):

```ts
  const submitSingleValidated = handleSubmit((values) => {
    if (missingPhotos()) return;
    if (missingRouting()) return;      // <- new
    const updated = buildUpdated(values);
```

Verified prerequisites, so this compiles with **one** new import: `Alert` is imported at
`useDetailController.ts:2`, `haptics` at `:22`, `haptics.error` exists (`src/lib/haptics.ts:75`), `t`
comes from `useTranslation()` at `:48`, and `useScanDraft` is imported at `:24`. Only `isRoutingResolved`
is new.

**Style note — match Phase 5, do not fight it.** Phase 5 factored the alert into `alertMissing(rows)`
(`useDetailController.ts:130`), which maps `RequiredRowKey`s through `useRequiredRowLabel` and builds
*"Please add: {{fields}}"*. `missingRouting()` deliberately does **not** use it, because routing is **not**
a `RequiredRowKey` — `requiredStatus.ts`'s `REQUIRED_ROWS` has seven entries and `marketplace` is not one
of them, and making it one is M-7's file and integration C4's explicitly deferred "fuller option". So
`missingRouting()` calls `Alert.alert` directly with the routing copy. If a later phase adds the eighth
row, delete `missingRouting()` and route it through `alertMissing(['marketplace'])` instead.

**Also delete the seam comment.** `useDetailController.ts:187-200` is Phase 5's instruction block for
this exact step. Leaving it after implementing the guard tells the next reader the work is outstanding.

**Do NOT take the fuller option here.** Making routing an eighth `REQUIRED_ROWS` entry changes
`getRequiredStatus`'s signature, which `grouped-review.tsx` also calls, and `requiredStatus.ts` belongs to
M-7 (§13). Integration C4 defers it explicitly.

Add the test. Create `src/features/scanner/components/detail/__tests__/missingRouting.test.ts`:

```ts
import { describe, it, expect } from '@jest/globals';

import { isRoutingResolved } from '@/features/scanner/routing/routingState';
import type { DraftItem } from '@/stores/scanDraftStore';

/**
 * The guard's predicate, in isolation. `missingRouting()` itself needs the RHF
 * + i18n + store harness that this repo does not fund for hooks, so what is
 * pinned here is the decision it makes — and the fact that the DRAFT field is
 * invisible to `detailSchema`, which is C4's entire point.
 */
const draft = (over: Partial<DraftItem>): DraftItem => ({ ...over } as DraftItem);

describe('C4 — the single-mode submit guard', () => {
  it('refuses an unconfirmed draft', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: false }))).toBe(false);
  });

  it('allows a confirmed draft and a legacy 1.0.3 draft', () => {
    expect(isRoutingResolved(draft({ marketplaceConfirmed: true }))).toBe(true);
    expect(isRoutingResolved(draft({}))).toBe(true);
  });

  // ⛔ C4 — this is WHY the guard must exist. If `marketplace_confirmed` ever
  // becomes a schema field, delete the guard and use `onInvalid` instead.
  it('marketplaceConfirmed is NOT a detailSchema field', async () => {
    const { detailSchema } = await import('@/features/scanner/schema');
    expect(Object.keys((detailSchema as unknown as { shape: object }).shape))
      .not.toContain('marketplaceConfirmed');
  });
});
```

```bash
npx jest src/features/scanner/components/detail/__tests__/missingRouting.test.ts
```

Expected: **1 suite, 3 tests passed.** If the third test fails because `detailSchema` is wrapped in a
`superRefine` (it is — `schema.ts:75-89`), read `.shape` off the inner object or assert
`detailSchema.safeParse({...validValues, marketplaceConfirmed: false}).success === true` instead, which
demonstrates the same thing: the schema does not care about the field.

**Gate: G17** — single-mode Submit with `marketplaceConfirmed: false` is refused with a **named reason**:
haptic + alert, no navigation, no network call.

### Step 8-11. Compile and run the whole suite  *(was "Step 8-7" — renumbered so it stays LAST)*

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx tsc --noEmit; echo "exit=$?"
npx jest --silent 2>&1 | tail -6
```

Expected: `exit=0`, and **every suite green**.

Arithmetic, from the baseline **96 suites / 862 tests / 22 snapshots** re-measured today at `45abb39`:

| New suite | Step | Tests |
|---|---|---|
| `routingState.test.ts` | 6-8 | 33 |
| `marketplaceUnlock.test.ts` | 2 / 6-6 | 5 |
| `supportedMarketplacesCache.test.ts` | 7-11 | 12 |
| `useSupportedMarketplaces.test.tsx` | 7-11 | 2 |
| `onConfirmPatch.test.ts` | 8-9 | 2 |
| `missingRouting.test.ts` | 8-10 | 3 |
| **+ 6 tests added to** `scanDraftStore.test.ts` | 8-8 | 6 |

→ **102 suites / 925 tests / 22 snapshots.**

**⚠️ Treat those totals as indicative and "zero pre-existing suites red" as the gate** (integration G12 —
phase test counts have been wrong five times in this programme). What is NOT negotiable is that the two
⛔-marked bite-tests are present and that Step 8-8's revert check turns the store suite red.

The `A worker process has failed to exit gracefully` line is pre-existing. Ignore it.

---

## 9. M-3 — the routing chip and the marketplace sheet

Design decisions, and the evidence for each:

- **A chip above `IdentityCard`, not a screen and not an eleventh card.** `detail.tsx` already
  renders ten cards in one scroll (`:121-139`). And the common single-item case **never reaches**
  `detection.tsx`: `shouldSkipDetectionChoice` returns true when `productCount <= 1 || imageCount <= 1`
  (`smartDetectionRouting.ts:24-25`), routed at `processing-v2.tsx:351-357`. So the confirmation
  cannot live on the one screen that already looks like a confirmation step.
- **Stitch product logic, not Stitch styling.** From `4a`
  (`projects/13503762192488530299/screens/9a852b6b56b4441ab9c29c4173b548da`) and `4b`
  (`…/20fb6f62b31f45d18d9e912092504cc5`), read today, we take: the "WE'LL LIST THIS ON" statement, the
  one-line marketplace description, the **WHY** line, **nothing pre-selected when unsure**, a
  **disabled CTA with an instructive label** ("Choose a marketplace to continue"), and *"Category and
  currency are set once you choose — we won't guess them."* We do **not** take their nine font sizes
  and twelve off-palette colours: every value below comes from `src/constants/theme.ts` via the
  `brand-*` Tailwind aliases (`tailwind.config.js:22-56`).
- **The loading copy does NOT name the marketplace — decided, not deferred.** Parent plan §6.1's fifth
  design bullet asks for "Loading 101MACHINE categories…". **It is on §13's not-doing list**, for two
  reasons I checked rather than assumed. (1) On the smart path the marketplace is not known until the
  **terminal** SSE frame: `smartDetectStream.ts:225-245` parses the `result` event, maps it and resolves
  the promise, and `site_type` lives inside that payload — while the labels the seller reads come from
  earlier `stage` frames, whose only field is a phase (`processing-v2.tsx:72-77`, the five-row
  `TIMELINE`; `normalizePhase` at `:85-87`). There is nothing to name at label time, and inventing a name
  from the deployment default would be a *wrong* name on exactly the 37.5% of items that get re-routed.
  (2) The one place it **is** implementable is the category tree's own spinner —
  `CategoryConditionCard.tsx:204-206`, the `categories.isLoading` `<ActivityIndicator>` that fires right
  after the chip's pick, when the marketplace is definitely known. That file is **not this phase's**:
  Phase 3's M-2 rewrites ~190 lines of it and Phase 5 edits `:203` (integration §3). Doing it here would
  create a three-phase conflict in a file this phase otherwise never touches. **Recorded as a follow-up
  for Phase 3's M-2 sheet**, with the exact anchor above.
- **The percentages are built but do not render yet.** `4a` shows "High · 94%" and `4b` shows
  "Best guess · 52%" / "Close second · 44%". **Update: S0-2 has landed** (§0.4), so a single confidence
  number IS on the wire and the `word · N%` line **renders in v1**. `RoutingChip` still takes
  `confidence: number | null` and still renders that line **only when it is non-null**, which keeps a
  persisted pre-S0-2 draft honest rather than showing it a made-up 75%. What we still do **not** take from
  `4b` is its **ranked second guess** ("Close second · 44%"): the wire carries one site type and one
  confidence, not a ranked list, so the sheet shows the AI's single guess badged "Best guess" and leaves
  the rest unranked. Inventing a runner-up percentage is the one thing `UX_DESIGN_RULES.md` and plan §2.1
  both forbid.

### Step 9-1. Marketplace descriptions — **PRE-CHECK ONLY, do not edit `constants.ts`**

Integration **C7 / Decision 3**: `MARKETPLACE_OPTIONS`' third field belongs to **Phase 5 S16 step 1**,
as `description`, with the i18n key `mobile.detail.marketplaceOption.<value>.description` and all six
translations shipped by Phase 5's text-mode locale editor. **This phase's `hintKey` / `hint` fields and
its four `marketplaceHint.*` keys are DELETED** — they were a second field name, a second key namespace
and a second copy of the same sentence, ×6 locales, on the same screen.

So Step 9-1 is a **check**, not an edit:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
sed -n '40,52p' src/features/scanner/constants.ts
node -e "const j=require('./src/i18n/locales/en.json');console.log(JSON.stringify(j.mobile.detail.marketplaceOption,null,1))"
```

Expected **after Phase 5**:

```ts
export const MARKETPLACE_OPTIONS: {
  value: '101lab' | '101machine' | '101recycle' | '101it';
  label: string;
  description: string;   // the i18n key is
                         // `mobile.detail.marketplaceOption.<value>.description`
}[] = [
  { value: '101lab',     label: '101LAB',     description: 'Lab & scientific equipment' },
  { value: '101machine', label: '101MACHINE', description: 'Industrial & production machinery' },
  { value: '101it',      label: '101IT',      description: 'IT hardware & electronics' },
  { value: '101recycle', label: '101RECYCLE', description: 'Scrap, surplus & recyclable materials' },
];
```

**Measured today at `45abb39`: this already passes.** `constants.ts:49-58` types `description: string`,
the four entries are at `:53-56`, and all six locales carry
`mobile.detail.marketplaceOption.<value>.description`. Phase 5's own comment above the constant
(`constants.ts:41-48`) says it in writing: *"this is the ONE home for marketplace description copy
(integration doc C7), so do not add a second `hint`/`hintKey` field beside it."* Take that literally.

If some other checkout ever shows `{value; label}[]` with no third field, **stop and go back to
Step 1-5** — do not add the field yourself.

One consequence worth stating: Phase 5's copy is **short** ("Lab & scientific equipment") where this
phase's deleted `hint` was long ("Lab and analytical equipment — buyers are labs, universities and
research sites"). Integration C7's ruling: if the short copy reads too terse in the ask state, **lengthen
that one key** in `en.json` + the five translations. Do not add a second string.

### Step 9-2. `MarketplaceSheet`

Create `src/features/scanner/components/detail/MarketplaceSheet.tsx`:

```tsx
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/ui';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { haptics } from '@/lib/haptics';
import type { MarketplaceKey } from '@/stores/scanDraftStore';

interface Props {
  visible: boolean;
  /** The marketplaces this install may route to (M-12). */
  supported: MarketplaceKey[];
  /**
   * The value to show as SELECTED. Pass `null` in the ask state — plan §2.2:
   * nothing is pre-selected when the AI is unsure, so the seller cannot
   * confirm a guess by reflex.
   */
  value: MarketplaceKey | null;
  /** The AI's guess, badged "Best guess". Highlighted, never selected. */
  suggested: MarketplaceKey | null;
  onSelect: (marketplace: MarketplaceKey) => void;
  onClose: () => void;
}

/**
 * The marketplace picker, as a bottom sheet (plan §6.1). This is where
 * `MarketplaceCard`'s four-pill row went: same options, same "clear the
 * category on a real user switch" contract, but with the one-line
 * descriptions the pills had no room for.
 *
 * Pattern copied from `CountryPicker.tsx:37-91` so every dropdown in the flow
 * reads as one system (`Sheet` + `Sheet.Option`, `Sheet.tsx:152-213`).
 * `Sheet.Option` already supports `description` (`Sheet.tsx:141` declaration,
 * `:202-206` render, `numberOfLines={2}`) and `Sheet` already handles the
 * Android 48 dp nav-bar inset (`Sheet.tsx:53`, `:110`), so there is no new
 * safe-area work.
 *
 * The description string is Phase 5's (integration C7): field `description` on
 * MARKETPLACE_OPTIONS, key `mobile.detail.marketplaceOption.<value>.description`,
 * translated ×6 by Phase 5. This phase adds NO marketplace-description keys.
 */
export function MarketplaceSheet({
  visible,
  supported,
  value,
  suggested,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const options = MARKETPLACE_OPTIONS.filter((o) => supported.includes(o.value));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('mobile.detail.routing.sheetTitle', { defaultValue: 'Choose a marketplace' })}
      subtitle={t('mobile.detail.routing.sheetSubtitle', {
        defaultValue:
          "Category and currency are set once you choose — we won't guess them.",
      })}
      maxHeight={440}
    >
      {options.map((opt) => (
        <Sheet.Option
          key={opt.value}
          label={
            opt.value === suggested
              ? `${opt.label}  ·  ${t('mobile.detail.routing.bestGuess', {
                  defaultValue: 'Best guess',
                })}`
              : opt.label
          }
          description={t(`mobile.detail.marketplaceOption.${opt.value}.description`, {
            defaultValue: opt.description,
          })}
          active={opt.value === value}
          onPress={() => {
            haptics.tap();
            onSelect(opt.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
```

### Step 9-3. `RoutingChip`

Create `src/features/scanner/components/detail/RoutingChip.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { brand } from '@/constants/theme';
import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import {
  CLEARED_CATEGORY_FORM_FIELDS,
  deriveRoutingState,
  routingWhyLine,
  signalFromDraft,
} from '@/features/scanner/routing/routingState';
import { useSupportedMarketplaces } from '@/features/scanner/routing/useSupportedMarketplaces';
import type { DetailFormInput } from '@/features/scanner/schema';
import { haptics } from '@/lib/haptics';
import type { DraftItem, MarketplaceKey } from '@/stores/scanDraftStore';

import { FieldLabel } from './FieldLabel';
import { MarketplaceSheet } from './MarketplaceSheet';

interface Props {
  draft: DraftItem;
  /**
   * Persist the seller's answer. `detail.tsx` passes
   * `(m) => patch({ marketplace: m, marketplaceConfirmed: true, … })`;
   * `grouped-edit.tsx` passes the `patchQueuedItem(index, …)` equivalent.
   * The chip does NOT reach into the store itself — one write path per screen.
   */
  onConfirm: (marketplace: MarketplaceKey) => void;
}

/**
 * The routing confirmation, as a chip above IdentityCard (plan §6.1).
 *
 * THREE states, per plan §2.2:
 *   confirmed + prefill    — "WE'LL LIST THIS ON · 101LAB", quiet "Change"
 *   confirmed + no prefill — same, plus "Category: Not set — pick a category"
 *   ask                    — a question, NOTHING pre-selected, and an
 *                            instructive disabled CTA
 *
 * Stitch 4a/4b supply the product logic (the statement, the WHY line, the
 * "we won't guess" promise, the disabled instructive CTA). The confidence
 * PERCENTAGE renders only when `state.confidence != null` — it is not on the
 * wire until S0-2, and a fabricated number is worse than no number.
 *
 * ⚠️ This component writes `marketplace` ONLY from `onPress` inside the sheet.
 * Never move that into a `watch` effect: see useDetailController.ts:78-82.
 */
export function RoutingChip({ draft, onConfirm }: Props) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<DetailFormInput>();
  const supported = useSupportedMarketplaces();
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = watch('marketplace');
  const state = deriveRoutingState({
    current,
    confirmed: draft.marketplaceConfirmed !== false,
    signal: signalFromDraft(draft),
    supported,
  });

  // One marketplace on offer ⇒ nothing to confirm, nothing to change.
  // The chip disappears entirely and the screen is 1.0.3.
  if (supported.length <= 1) return null;

  const labelFor = (m: MarketplaceKey) =>
    MARKETPLACE_OPTIONS.find((o) => o.value === m)?.label ?? m;
  // Integration C7 — Phase 5's ONE description string, ONE key, ONE home.
  const descriptionFor = (m: MarketplaceKey) => {
    const o = MARKETPLACE_OPTIONS.find((x) => x.value === m);
    if (!o) return '';
    return t(`mobile.detail.marketplaceOption.${m}.description`, {
      defaultValue: o.description,
    });
  };

  const pick = (m: MarketplaceKey) => {
    // Identical contract to the pre-unlock MarketplaceCard onPress
    // (MarketplaceCard.tsx:50-63 before this phase): a REAL user switch
    // invalidates the marketplace-specific category/subcategory and any
    // "Other" brand. Done here, on the tap — NOT in a watch-effect.
    //
    // ⚠️ blocker (c): these setValue calls are NOT sufficient on the single
    // path. `onConfirm` -> `patch()` gives `current` a new object identity
    // (scanDraftStore.ts:711-719), which re-fires useDetailController's
    // `reset(draftToFormValues(draft))` (:57-64) and writes the STORE's
    // categoryId back over whatever we set here (formMapping.ts:78). The store
    // patch in `onConfirm` is what actually clears it — see Steps 8-9 / 9-5.
    // These calls still matter on `grouped-edit.tsx`, which has NO reset effect
    // (its useForm sets `defaultValues` once, :70-73), so the form there would
    // otherwise keep showing the old category until Save.
    setValue('marketplace', m, { shouldValidate: false });
    if (m !== current) {
      for (const [k, v] of Object.entries(CLEARED_CATEGORY_FORM_FIELDS)) {
        setValue(k as keyof DetailFormInput, v as never, { shouldValidate: false });
      }
    }
    onConfirm(m);
  };

  const sheet = (
    <MarketplaceSheet
      visible={sheetOpen}
      supported={supported}
      value={state.kind === 'ask' ? null : current}
      suggested={state.suggested}
      onSelect={pick}
      onClose={() => setSheetOpen(false)}
    />
  );

  // ── ASK ──────────────────────────────────────────────────────────────────
  if (state.kind === 'ask') {
    return (
      <View
        className="bg-brand-warning-bg border border-brand-warning-border rounded-sm p-2xl gap-sm"
        accessibilityRole="summary"
      >
        <View className="flex-row items-center gap-1.5">
          <MaterialIcons name="help-outline" size={16} color={brand.warningText} />
          <Text className="font-heading-semi text-3xl text-brand-foreground">
            {t('mobile.detail.routing.askTitle', {
              defaultValue: "We're not sure where this belongs",
            })}
          </Text>
        </View>

        <Text className="font-sans text-lg text-brand-text-muted">
          {t('mobile.detail.routing.askBody', {
            defaultValue: "Pick a marketplace and we'll load the right categories.",
          })}
        </Text>

        {state.suggested ? (
          <Text className="font-sans text-md text-brand-text-muted">
            {t('mobile.detail.routing.askGuess', {
              defaultValue: 'Our best guess is {{marketplace}}.',
              marketplace: labelFor(state.suggested),
            })}
          </Text>
        ) : null}

        {/* Instructive, DISABLED-looking primary — Stitch 4b's
            "Choose a marketplace to continue". It is a Pressable (not a real
            disabled button) because tapping it must DO the thing it names:
            a dead control is the one thing UX_DESIGN_RULES.md's
            "every action provides feedback" rules out. */}
        <Pressable
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.detail.routing.askCta', {
            defaultValue: 'Choose a marketplace to continue',
          })}
          style={({ pressed }) => ({
            marginTop: 4,
            minHeight: 48,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? brand.primaryDim : brand.primary,
          })}
        >
          <Text className="font-semi text-2xl" style={{ color: brand.primaryForeground }}>
            {t('mobile.detail.routing.askCta', {
              defaultValue: 'Choose a marketplace to continue',
            })}
          </Text>
        </Pressable>

        <Text className="font-sans text-md text-brand-text-muted">
          {t('mobile.detail.routing.setOnce', {
            defaultValue:
              "Category and currency are set once you choose — we won't guess them.",
          })}
        </Text>

        {sheet}
      </View>
    );
  }

  // ── CONFIRMED ────────────────────────────────────────────────────────────
  const why = routingWhyLine(draft);

  return (
    <View className="bg-brand-surface border border-brand-border-strong rounded-sm p-2xl gap-sm">
      <View className="flex-row items-center justify-between gap-sm">
        <View style={{ flex: 1, minWidth: 0 }}>
          <FieldLabel
            text={t('mobile.detail.routing.willListOn', { defaultValue: "WE'LL LIST THIS ON" })}
            ai
          />
          <Text
            className="font-heading text-4xl text-brand-foreground"
            numberOfLines={1}
            style={{ marginTop: 2 }}
          >
            {labelFor(current)}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          accessibilityRole="button"
          hitSlop={12}
          accessibilityLabel={t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
        >
          <Text className="font-semi text-lg" style={{ color: brand.primaryDim }}>
            {t('mobile.detail.routing.change', { defaultValue: 'Change' })}
          </Text>
        </Pressable>
      </View>

      <Text className="font-sans text-md text-brand-text-muted">{descriptionFor(current)}</Text>

      {/* Confidence: word AND number, so the word translates and the number
          still reads in TH/VI/ZH/JA. Renders ONLY when S0-2 has supplied it —
          `state.confidence` is null on today's wire and a made-up percentage
          is worse than none. */}
      {state.confidence != null ? (
        <Text className="font-sans text-md text-brand-text-muted">
          {t('mobile.detail.routing.confidence', {
            defaultValue: 'AI confidence: {{word}} · {{pct}}%',
            word: t(
              state.confidence >= 0.85
                ? 'mobile.detail.routing.confHigh'
                : state.confidence >= 0.6
                  ? 'mobile.detail.routing.confMedium'
                  : 'mobile.detail.routing.confLow',
              { defaultValue: 'High' },
            ),
            pct: Math.round(state.confidence * 100),
          })}
        </Text>
      ) : null}

      {why ? (
        <View className="gap-1.5" style={{ marginTop: 2 }}>
          <FieldLabel text={t('mobile.detail.routing.why', { defaultValue: 'WHY' })} />
          <Text className="font-sans text-md text-brand-text-muted">
            {t(why.key, {
              defaultValue:
                why.key === 'mobile.detail.routing.whyNameplate'
                  ? 'Nameplate reads "{{identity}}".'
                  : 'No brand or model was legible in the photos.',
              identity: why.identity,
            })}
          </Text>
        </View>
      ) : null}

      {/* "Not set" instead of a guess — plan §2.2 row 3 / §4.1. Says WHY the
          field is empty so an empty required field reads as a decision, not
          a bug. */}
      {!state.prefillCategory && !watch('categoryId') ? (
        <Text className="font-sans text-md" style={{ color: brand.warningText, marginTop: 2 }}>
          {t('mobile.detail.routing.categoryNotSet', {
            defaultValue: 'Category: not set — pick one below. We would rather ask than guess.',
          })}
        </Text>
      ) : null}

      {sheet}
    </View>
  );
}
```

**Note the one comparison in this file, and be precise about what it is.** The confidence branch does
compare `state.confidence` to 0.85 / 0.6 — and since S0-2 landed (§0.4) that branch is **reachable and
will run on the first scan**, unlike when this was written. It is still not a threshold: it picks a
**display word** for a number the server sent, changes no state, blocks nothing and routes nothing. The
behavioural decision stays in `deriveRoutingState`, which never reads the number.

This is the exact place a future reader is most likely to break plan §2.1 — the numbers are right there,
already compared, one line away from `if (state.confidence > 0.8) return confirmed`. Three tests exist to
catch that: Step 6-6's `a low confidence number alone does NOT change any mapped field`, and Step 6-8's
`the confidence NUMBER alone never flips the trigger` and `the confidence NUMBER alone never changes the
state`. If you touch this branch, run `routingState.test.ts` before you commit.

### Step 9-4. Export both

`src/features/scanner/components/detail/index.ts` — add, keeping alphabetical order:

```ts
export { MarketplaceSheet } from './MarketplaceSheet';
export { RoutingChip } from './RoutingChip';
```

### Step 9-5. Mount on `detail.tsx` — and the `onConfirm` patch that closes blocker (c)

`app/scan/detail.tsx`:

1. Add `RoutingChip` to the barrel import (`:10-25`).
2. Add the two routing imports:

```tsx
import {
  CLEARED_CATEGORY_DRAFT_FIELDS,
  isRoutingResolved,
} from '@/features/scanner/routing/routingState';
```

3. Add above `<IdentityCard />` at `:127`:

```tsx
          <RoutingChip
            draft={draft}
            onConfirm={(marketplace) =>
              useScanDraft.getState().patch({
                marketplace,
                marketplaceConfirmed: true,
                // ⛔ blocker (c) — THE SAME PATCH. Verified mechanism:
                // `patch()` builds `{ ...cur, ...partial }` and sets a NEW
                // `current` object (scanDraftStore.ts:711-719), which re-fires
                // `useEffect(..., [draft, reset])` in useDetailController
                // (:57-64) and runs `reset(draftToFormValues(draft))`.
                // `draftToFormValues` maps `categoryId: draft.categoryId ?? ''`
                // (formMapping.ts:78). So a patch carrying only `marketplace`
                // RESTORES the old category into the form — and submit then
                // sends `product_category_ids` from the PREVIOUS tree
                // (buildFormData.ts:161) with `allowed_sites[]` from the NEW
                // one (:223-224). The chip's `setValue` calls cannot win that
                // race; the store patch has to carry the clear.
                //
                // Unconditional: `pick()` only calls `onConfirm` from a tap, and
                // re-confirming the SAME marketplace still means the seller has
                // just been shown "we won't guess the category" — clearing is
                // the honest outcome either way, and `RoutingChip.pick` already
                // guards the form-side clear on `m !== current` so the visible
                // behaviour of a no-op re-tap is unchanged.
                ...CLEARED_CATEGORY_DRAFT_FIELDS,
              })
            }
          />
          <IdentityCard />
```

4. Gate the footer (`:148`). Replace:

```tsx
          allRequired={required.allComplete}
```

with:

```tsx
          // M-3 — an unanswered routing question blocks Submit for the same
          // reason a missing category does: `marketplace` drives
          // `allowed_sites[]` (buildFormData.ts:223-224) and therefore the
          // product's site_id. Kept HERE rather than inside
          // `getRequiredStatus` so this phase does not collide with M-7,
          // which owns requiredStatus.ts.
          //
          // ⚠️ AFTER PHASE 5 THIS IS NOT ENOUGH ON ITS OWN (integration C4).
          // Phase 5 changes the single-mode Submit to `disabled={!!submitting}`,
          // so `allRequired` then feeds only the GROUPED buttons. Step 8-10's
          // `missingRouting()` guard in useDetailController is what actually
          // stops a single-mode submit. Keep both: this one keeps the button
          // visibly disabled in grouped mode, that one is the correctness fix.
          allRequired={required.allComplete && isRoutingResolved(draft)}
```

> ⚠️ **`prefillCategory` is now enforced, not merely computed** (blocker (d), §0.5). The chip's
> `categoryNotSet` line remains, but it is the *explanation*; the clear happens in three places, all
> using the same two functions from `routingState.ts`: the store (Step 8-2), the analyze path (Step 8-3)
> and this `onConfirm`. If you find yourself rendering the message without clearing the field, you have
> rebuilt the exact defect the reviewer flagged.

### Step 9-6. Mount on `grouped-edit.tsx`

Per plan §9, retargeting a per-item marketplace happens **in the item editor**, not on the hub. Add above
`<IdentityCard />` at `:217`:

```tsx
          <RoutingChip
            draft={item}
            onConfirm={(marketplace) =>
              patchQueuedItem(index, {
                marketplace,
                marketplaceConfirmed: true,
                // ⛔ blocker (c), grouped variant — and here the failure mode is
                // WORSE than a stale form. `patchQueuedItem` merges immediately
                // (scanDraftStore.ts:795-809), so without this the STORED item
                // carries the new marketplace with the OLD categoryId. This
                // screen's `useForm` sets `defaultValues` once (:70-73) and has
                // no reset effect, so nothing re-syncs it; and `onValid`
                // (:118-119) is the only thing that writes the form back. If
                // the seller leaves via the app bar or the Android hardware
                // back instead of Save, that mismatched pair PERSISTS —
                // `grouped-review` then counts the row ready (`:100`) and the
                // pre-flight sweep (`:157-158`) passes it, and submit sends the
                // old tree's id with the new allowed_sites (buildFormData.ts
                // :270 / the grouped path's meta).
                ...CLEARED_CATEGORY_DRAFT_FIELDS,
              })
            }
          />
          <IdentityCard />
```

and add to the imports:

```tsx
import { CLEARED_CATEGORY_DRAFT_FIELDS } from '@/features/scanner/routing/routingState';
```

plus `RoutingChip` in the barrel import (`:15-17` area). `patchQueuedItem` and `index` are already in
scope — verified: `const index = Number(indexParam)` at `grouped-edit.tsx:58` and
`const patchQueuedItem = useScanDraft((s) => s.patchQueuedItem)` at `:61`.

### Step 9-7. Per-row marketplace on `HubRow`

`app/scan/grouped-review.tsx`.

1. Fold routing into readiness at `:100`:

```ts
        const hasPhotos = (item.photos?.length ?? 0) > 0;
        const routingResolved = isRoutingResolved(item);
        const ready = status.allComplete && hasPhotos && routingResolved;
        const missingKeys = (Object.keys(status.rows) as RequiredRowKey[]).filter(
          (k) => !status.rows[k],
        );
        const missingCount = missingKeys.length + (routingResolved ? 0 : 1);
        return { ready, missingCount, missingKeys, routingResolved };
```

2. Same in the pre-flight sweep at `:157-158`:

```ts
      const ok =
        getDraftRequiredStatus(it).allComplete &&
        (it.photos?.length ?? 0) > 0 &&
        isRoutingResolved(it);
```

3. Pass the two new values through at `:316-325`:

```tsx
              <HubRow
                key={item.id}
                index={index}
                item={item}
                ready={ready}
                missingCount={missingCount}
                missingKeys={missingKeys}
                routingResolved={routingResolved}
                onPress={() => onRowTap(index)}
                disabled={submitGrouped.isPending}
              />
```

and widen the destructure at `:310-314`:

```tsx
            const { ready, missingCount, missingKeys, routingResolved } =
              rowStatuses[index] ?? {
                ready: false,
                missingCount: 1,
                missingKeys: [] as RequiredRowKey[],
                routingResolved: true,
              };
```

4. `HubRow` — add the prop (`:498-514`):

```tsx
function HubRow({
  index,
  item,
  ready,
  missingCount,
  missingKeys,
  routingResolved,
  onPress,
  disabled,
}: {
  index: number;
  item: DraftItem;
  ready: boolean;
  missingCount: number;
  missingKeys: RequiredRowKey[];
  /** M-3 — false when this item's routing question is still unanswered. */
  routingResolved: boolean;
  onPress: () => void;
  disabled: boolean;
}) {
```

5. Render the marketplace in the middle column. Insert **immediately after** the title `<Text>`
   (which closes at `:650`), before the status-chip block at `:656`:

```tsx
        {/* M-3 / plan §6.2 — the destination, per row, so a mixed upload is
            legible BEFORE submit ("3 to 101LAB, 1 to 101IT"). READ-ONLY here;
            retargeting is in the item editor (plan §9) — a second write path
            to `marketplace` re-opens the documented hydration race. */}
        <View className="flex-row items-center self-start gap-xs">
          <MaterialIcons
            name="storefront"
            size={13}
            color={routingResolved ? brand.textMuted : brand.warningText}
          />
          <Text
            className="font-medium"
            style={{
              fontSize: 11,
              letterSpacing: 0.5,
              color: routingResolved ? brand.textMuted : brand.warningText,
            }}
            numberOfLines={1}
          >
            {routingResolved
              ? (MARKETPLACE_OPTIONS.find((o) => o.value === item.marketplace)?.label ??
                 item.marketplace)
              : t('mobile.reviewHub.pickMarketplace', {
                  defaultValue: 'Marketplace not chosen',
                })}
          </Text>
        </View>
```

6. Make the missing-fields chip name the routing gap first — replace the `missingLabel` IIFE's final
   `return` (`:572-575`):

```ts
    if (!routingResolved) {
      return t('mobile.reviewHub.statusMissingMarketplace', {
        defaultValue: 'Pick a marketplace',
      });
    }
    return t('mobile.reviewHub.statusMissing', {
      defaultValue: 'Missing: {{preview}}',
      preview: preview || 'details',
    });
```

7. Imports at the top of `grouped-review.tsx`:

```tsx
import { MaterialIcons } from '@expo/vector-icons';

import { MARKETPLACE_OPTIONS } from '@/features/scanner/constants';
import { isRoutingResolved } from '@/features/scanner/routing/routingState';
```

(`brand` and `t` are already in scope — `brand` is used at `:357` and `t` throughout.)

### Step 9-8. UX checklist — `UX_DESIGN_RULES.md`, run before calling this done

| Question | Answer |
|---|---|
| Can a first-time user finish without guidance? | Yes. Confirmed = a statement, zero taps. Ask = a titled question, a body sentence, one CTA that names the action. |
| Is the next action obvious? | Yes — one button, labelled with what it does ("Choose a marketplace to continue"). |
| Only one primary CTA? | Yes. The chip's CTA exists **only** in the ask state, when the footer's Submit is disabled — they are never both live. In the confirmed state the chip's affordance is a quiet text "Change" and Submit is the only primary. |
| Can anything be removed? | Yes, and it was: `MarketplaceCard` renders nothing, so no card was added — a chip replaced a card. |
| Can scrolling be reduced? | Yes. The routing answer is at the **top** of the scroll, not behind ~3,200 px. |
| Any duplicate controls? | No. `MarketplaceCard` → `return null` is precisely to prevent two controls writing `marketplace`. |
| Adapted to progress? | Yes — three states, driven by what the AI actually returned; and the chip **vanishes** when only one marketplace is supported. |
| Feedback on every action? | Yes: `haptics.tap()` on the chip and on each option, the sheet's check mark, and the statement re-renders with the new marketplace. |
| Error recovery? | Yes: the ask state *is* the recovery for a bad route, and "Change" is the recovery for a wrong confirmed one. The `categoryNotSet` line explains an empty required field and points at the picker below it. |
| Polished? | Reuses `Sheet` / `Sheet.Option` / `FieldLabel` verbatim, so it is visually identical to the language, country and category pickers. `Sheet.Option`'s `description` row is where the marketplace explanation lives — **one** string, **one** key (`mobile.detail.marketplaceOption.<value>.description`), shipped by Phase 5 (C7). |
| Any duplicate STRINGS? | No — and this was a real risk. Phase 4 originally added `marketplaceHint.*` while Phase 5 added `marketplaceOption.*.description`: the same sentence twice on one screen, ×6 locales. C7 resolved it to Phase 5's key; this phase adds none. |
| Empty state explained? | Yes. When the routed tree is untrusted the category is **cleared** (§0.5, Steps 8-2/8-3/9-5) and the chip says *"Category: not set — pick one below. We would rather ask than guess."* An empty required field that says why is a decision; one that says nothing is a bug. |
| Status visible? | Yes — the marketplace on every hub row means the seller sees the split before submitting. |
| Sticky primary on long forms? | Unchanged: `DetailFooter` is already pinned outside the scroll (`detail.tsx:182-196`). |

---

## 10. Step 10 — i18n

**20 new keys: 18 under `mobile.detail.routing`, 2 under `mobile.reviewHub`. ZERO
`marketplaceHint.*` keys** — integration C7 deleted them, and the marketplace description string is
Phase 5's `mobile.detail.marketplaceOption.<value>.description`, already shipped in all six locales.

> **Count correction.** The earlier draft said "18 new keys" while listing 18 `routing.*` keys **plus** 4
> `marketplaceHint.*` **plus** 2 `reviewHub.*` = 24. Integration C7 said the step "drops from 18+2 to
> 14+2", arithmetic that assumed 14 routing keys + 4 hints. The real numbers, counted key by key: **18
> routing + 2 reviewHub = 20 after dropping the 4 hint keys.** C7's *substance* (delete
> `marketplaceHint.*`, use Phase 5's key) is what has been applied; only its arithmetic was off.

`t(key, { defaultValue })` is used everywhere above, so the app is functional in `en` before any locale
file is edited — but shipping without translations means five locales silently render English. Add all of
them.

### ⚠️ Step 10-0. Read this before you touch a locale file — integration C11

These six files carry two hazards I re-measured today, **after** Phase 5's own locale edit:

```
en.json      crlf=5307  lf=5307  dups=['close']
zh-Hans.json crlf=5279  lf=5279  dups=['close']
zh-Hant.json crlf=5279  lf=5279  dups=['close']
ja.json      crlf=5212  lf=5212  dups=['close']
th.json      crlf=5196  lf=5196  dups=['close']
vi.json      crlf=5297  lf=5297  dups=['close']
```

- **Every file is 100% CRLF.** `json.dump` / `JSON.stringify` rewrites all ~5,300 line endings.
- **Every file carries a duplicate `mobile.labCommon.close` key.** Any `json.load` → `json.dump`
  round-trip silently deletes it. Two earlier attempts in this programme corrupted the files exactly that
  way.

**So: text-mode insertion after a unique anchor line, in binary mode, never a parser round-trip.** Phase 5
shipped the pattern at `src/i18n/_phase5_keys.py` (and there is an older precedent, `_seed_keys.py`).
Copy its shape. Two anchors, both re-measured today as **unique in all six files**:

| Anchor | Object it sits in | Line, per file |
|---|---|---|
| `"profitIntelligence":` | `mobile.detail` | en 3805 · zh-Hans 3791 · zh-Hant 3791 · ja 3726 · th 3710 · vi 3807 |
| `"finalValidationTitle":` | `mobile.reviewHub` | en 4222 · zh-Hans 4197 · zh-Hant 4197 · ja 4132 · th 4116 · vi 4217 |

(For orientation: `mobile.detail` opens at `en.json:3702` and `mobile.reviewHub` at `en.json:4221`.)

### Step 10-1. The editor script

Create `src/i18n/_phase4_keys.py`. It is deliberately the same shape as `_phase5_keys.py` — two anchors
instead of one, and it asserts the two hazards before and after every write:

```python
# Phase 4 (M-3): insert 18 keys into `mobile.detail.routing` and 2 into
# `mobile.reviewHub`, in all six locales.
#
# TEXT MODE ONLY. Do NOT round-trip these files through json.load/json.dump:
#   * each file carries a DUPLICATE "close" key inside `mobile.labCommon`
#     that a dict round-trip silently deletes;
#   * every line ends CRLF, which json.dump would rewrite to LF.
# This only INSERTS whole lines after a unique anchor line, in binary mode, then
# re-parses and re-checks the duplicate key to prove nothing broke.
#
# Idempotent: a file that already has the keys is skipped.
# Run from this directory:  python _phase4_keys.py
#
# NOTE: no `marketplaceHint` keys. Integration C7 gives the marketplace
# description to Phase 5's `mobile.detail.marketplaceOption.<value>.description`,
# which already ships in all six files.

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOCALES = os.path.join(HERE, 'locales')

DETAIL_ANCHOR = b'"profitIntelligence":'   # inside mobile.detail, unique x6
HUB_ANCHOR = b'"finalValidationTitle":'    # inside mobile.reviewHub, unique x6

FILES = {
    'en': 'en.json', 'zh-Hans': 'zh-Hans.json', 'zh-Hant': 'zh-Hant.json',
    'ja': 'ja.json', 'th': 'th.json', 'vi': 'vi.json',
}

# 18 routing keys, in a fixed order so every file's diff is identical in shape.
ROUTING_ORDER = [
    'willListOn', 'change', 'why', 'whyNameplate', 'whyNoNameplate',
    'askTitle', 'askBody', 'askGuess', 'askCta', 'bestGuess', 'setOnce',
    'sheetTitle', 'sheetSubtitle', 'categoryNotSet',
    'confidence', 'confHigh', 'confMedium', 'confLow',
]
HUB_ORDER = ['pickMarketplace', 'statusMissingMarketplace']

ROUTING = {}   # ROUTING[locale][key] = str   <- paste the six blocks from Step 10-2
HUB = {}       # HUB[locale][key]     = str


def esc(v):
    """JSON-escape one string value. No dict round-trip."""
    return json.dumps(v, ensure_ascii=False)


def routing_block(loc):
    v = ROUTING[loc]
    out = ['      "routing": {']
    for i, k in enumerate(ROUTING_ORDER):
        comma = '' if i == len(ROUTING_ORDER) - 1 else ','
        out.append('        "%s": %s%s' % (k, esc(v[k]), comma))
    out.append('      },')
    return out


def hub_block(loc):
    v = HUB[loc]
    return ['      "%s": %s,' % (k, esc(v[k])) for k in HUB_ORDER]


def dup_keys(raw):
    """Which keys are duplicated at any depth. Must be ['close'] before and after."""
    hits = []

    def hook(pairs):
        seen = {}
        for k, val in pairs:
            if k in seen:
                hits.append(k)
            seen[k] = val
        return seen

    json.loads(raw.decode('utf-8'), object_pairs_hook=hook)
    return hits


def insert_after(lines, anchor, block, fname):
    idx = [n for n, ln in enumerate(lines) if anchor in ln]
    assert len(idx) == 1, '%s: expected exactly 1 %r, found %d' % (fname, anchor, len(idx))
    at = idx[0]
    return lines[: at + 1] + block + lines[at + 1 :]


for loc, fname in FILES.items():
    path = os.path.join(LOCALES, fname)
    raw = open(path, 'rb').read()
    before_dups = dup_keys(raw)
    before_crlf = raw.count(b'\r\n')
    assert before_dups == ['close'], '%s: unexpected dup set %r' % (fname, before_dups)
    assert raw.count(b'\n') == before_crlf, '%s: a bare LF is already present' % fname

    if b'"willListOn":' in raw:
        print('%-12s already has the keys - skipped' % loc)
        continue

    lines = raw.split(b'\r\n')
    lines = insert_after(lines, DETAIL_ANCHOR,
                         [l.encode('utf-8') for l in routing_block(loc)], fname)
    lines = insert_after(lines, HUB_ANCHOR,
                         [l.encode('utf-8') for l in hub_block(loc)], fname)
    out = b'\r\n'.join(lines)

    json.loads(out.decode('utf-8'))          # prove it parses BEFORE writing
    open(path, 'wb').write(out)

    after = open(path, 'rb').read()
    assert dup_keys(after) == before_dups, '%s: duplicate-key set changed' % fname
    # 18 routing values + 2 wrapper lines ("routing": { and },) + 2 hub lines = 22
    assert after.count(b'\r\n') == before_crlf + 22, '%s: unexpected line count' % fname
    assert after.count(b'\n') == after.count(b'\r\n'), '%s: a bare LF appeared' % fname
    print('%-12s +20 keys (22 lines), still valid, CRLF intact' % loc)
```

#### This script was dry-run during the revision — here are the real numbers

The script above, spliced with Step 10-2's six string blocks, was executed on **2026-08-18 against copies
of all six locale files** (the real files were **not** touched — `git diff --stat src/i18n/locales/` came
back empty afterwards, and their CRLF counts are still 5307/5279/5279/5212/5196/5297). Result:

```
en           +20 keys (22 lines), still valid, CRLF intact
zh-Hans      +20 keys (22 lines), still valid, CRLF intact
zh-Hant      +20 keys (22 lines), still valid, CRLF intact
ja           +20 keys (22 lines), still valid, CRLF intact
th           +20 keys (22 lines), still valid, CRLF intact
vi           +20 keys (22 lines), still valid, CRLF intact
```

and, re-parsed from the copies:

```
en       crlf=5329 lf=5329 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
zh-Hans  crlf=5301 lf=5301 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
zh-Hant  crlf=5301 lf=5301 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
ja       crlf=5234 lf=5234 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
th       crlf=5218 lf=5218 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
vi       crlf=5319 lf=5319 dups=['close'] routing=18 hub=2 marketplaceHint=absent marketplaceOption=present
```

So the `+ 22` line assertion, the `dups == ['close']` preservation, the `crlf == lf` property, all 18+2
keys, C7 compliance (**no** `marketplaceHint`) and Phase 5's `marketplaceOption` all hold. The script is
paste-and-run, not paste-and-hope.

⚠️ **Still dry-run it yourself on copies before touching the real files.** The tree moves — Phase 3 also
edits these six files (integration C11 serialises locale edits one phase at a time), and if it lands
first the line counts and the `+22` assertion shift. The sandbox recipe:

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp/src/i18n
mkdir -p /c/Users/Pc/AppData/Local/Temp/claude/p4locale/locales
cp locales/*.json /c/Users/Pc/AppData/Local/Temp/claude/p4locale/locales/
cp _phase4_keys.py /c/Users/Pc/AppData/Local/Temp/claude/p4locale/
cd /c/Users/Pc/AppData/Local/Temp/claude/p4locale && python _phase4_keys.py
```

Only then run it for real.

### Step 10-2. The strings

`ROUTING['en']` / `HUB['en']`:

```python
ROUTING['en'] = {
    'willListOn': "WE'LL LIST THIS ON",
    'change': 'Change',
    'why': 'WHY',
    'whyNameplate': 'Nameplate reads "{{identity}}".',
    'whyNoNameplate': 'No brand or model was legible in the photos.',
    'askTitle': "We're not sure where this belongs",
    'askBody': "Pick a marketplace and we'll load the right categories.",
    'askGuess': 'Our best guess is {{marketplace}}.',
    'askCta': 'Choose a marketplace to continue',
    'bestGuess': 'Best guess',
    'setOnce': "Category and currency are set once you choose \u2014 we won't guess them.",
    'sheetTitle': 'Choose a marketplace',
    'sheetSubtitle': "Category and currency are set once you choose \u2014 we won't guess them.",
    'categoryNotSet': 'Category: not set \u2014 pick one below. We would rather ask than guess.',
    'confidence': 'AI confidence: {{word}} \u00b7 {{pct}}%',
    'confHigh': 'High',
    'confMedium': 'Medium',
    'confLow': 'Low',
}
HUB['en'] = {
    'pickMarketplace': 'Marketplace not chosen',
    'statusMissingMarketplace': 'Pick a marketplace',
}
```

`zh-Hant`:

```python
ROUTING['zh-Hant'] = {
    'willListOn': '我們會刊登在',
    'change': '變更',
    'why': '判斷依據',
    'whyNameplate': '銘牌顯示「{{identity}}」。',
    'whyNoNameplate': '照片中看不清品牌或型號。',
    'askTitle': '我們不確定這台設備屬於哪個平台',
    'askBody': '請選擇一個平台，我們就會載入對應的分類。',
    'askGuess': '我們推測是 {{marketplace}}。',
    'askCta': '選擇平台以繼續',
    'bestGuess': '最可能',
    'setOnce': '分類與幣別會在您選擇後設定 — 我們不會亂猜。',
    'sheetTitle': '選擇平台',
    'sheetSubtitle': '分類與幣別會在您選擇後設定 — 我們不會亂猜。',
    'categoryNotSet': '分類：未設定 — 請在下方選擇。我們寧願詢問也不亂猜。',
    'confidence': 'AI 信心度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['zh-Hant'] = {'pickMarketplace': '尚未選擇平台', 'statusMissingMarketplace': '請選擇平台'}
```

`zh-Hans`:

```python
ROUTING['zh-Hans'] = {
    'willListOn': '我们会刊登在',
    'change': '更改',
    'why': '判断依据',
    'whyNameplate': '铭牌显示“{{identity}}”。',
    'whyNoNameplate': '照片中看不清品牌或型号。',
    'askTitle': '我们不确定这台设备属于哪个平台',
    'askBody': '请选择一个平台，我们就会加载对应的分类。',
    'askGuess': '我们推测是 {{marketplace}}。',
    'askCta': '选择平台以继续',
    'bestGuess': '最可能',
    'setOnce': '分类与币别会在您选择后设定 — 我们不会乱猜。',
    'sheetTitle': '选择平台',
    'sheetSubtitle': '分类与币别会在您选择后设定 — 我们不会乱猜。',
    'categoryNotSet': '分类：未设定 — 请在下方选择。我们宁愿询问也不乱猜。',
    'confidence': 'AI 置信度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['zh-Hans'] = {'pickMarketplace': '尚未选择平台', 'statusMissingMarketplace': '请选择平台'}
```

`ja`:

```python
ROUTING['ja'] = {
    'willListOn': '出品先',
    'change': '変更',
    'why': '判断の根拠',
    'whyNameplate': '銘板に「{{identity}}」と記載されています。',
    'whyNoNameplate': '写真からブランドと型番を読み取れませんでした。',
    'askTitle': 'どのマーケットプレイスか判断できません',
    'askBody': 'マーケットプレイスを選ぶと、対応するカテゴリを読み込みます。',
    'askGuess': '推定は {{marketplace}} です。',
    'askCta': 'マーケットプレイスを選択して続行',
    'bestGuess': '最有力',
    'setOnce': 'カテゴリと通貨は選択後に設定されます。推測はしません。',
    'sheetTitle': 'マーケットプレイスを選択',
    'sheetSubtitle': 'カテゴリと通貨は選択後に設定されます。推測はしません。',
    'categoryNotSet': 'カテゴリ：未設定 — 下で選択してください。推測せずにお尋ねします。',
    'confidence': 'AI 信頼度：{{word}} · {{pct}}%',
    'confHigh': '高',
    'confMedium': '中',
    'confLow': '低',
}
HUB['ja'] = {'pickMarketplace': 'マーケットプレイス未選択',
             'statusMissingMarketplace': 'マーケットプレイスを選択'}
```

`th`:

```python
ROUTING['th'] = {
    'willListOn': 'เราจะลงประกาศที่',
    'change': 'เปลี่ยน',
    'why': 'เหตุผล',
    'whyNameplate': 'ป้ายเครื่องระบุว่า "{{identity}}"',
    'whyNoNameplate': 'อ่านแบรนด์หรือรุ่นจากรูปไม่ได้',
    'askTitle': 'เรายังไม่แน่ใจว่าเครื่องนี้อยู่ตลาดไหน',
    'askBody': 'เลือกตลาดหนึ่งแห่ง แล้วเราจะโหลดหมวดหมู่ที่ถูกต้อง',
    'askGuess': 'เราคาดว่าเป็น {{marketplace}}',
    'askCta': 'เลือกตลาดเพื่อดำเนินการต่อ',
    'bestGuess': 'น่าจะเป็น',
    'setOnce': 'หมวดหมู่และสกุลเงินจะถูกตั้งค่าเมื่อคุณเลือก — เราไม่เดา',
    'sheetTitle': 'เลือกตลาด',
    'sheetSubtitle': 'หมวดหมู่และสกุลเงินจะถูกตั้งค่าเมื่อคุณเลือก — เราไม่เดา',
    'categoryNotSet': 'หมวดหมู่: ยังไม่ได้ตั้ง — เลือกด้านล่าง เราขอถามดีกว่าเดา',
    'confidence': 'ความมั่นใจของ AI: {{word}} · {{pct}}%',
    'confHigh': 'สูง',
    'confMedium': 'กลาง',
    'confLow': 'ต่ำ',
}
HUB['th'] = {'pickMarketplace': 'ยังไม่ได้เลือกตลาด', 'statusMissingMarketplace': 'เลือกตลาด'}
```

`vi`:

```python
ROUTING['vi'] = {
    'willListOn': 'CHÚNG TÔI SẼ ĐĂNG TẠI',
    'change': 'Đổi',
    'why': 'LÝ DO',
    'whyNameplate': 'Nhãn máy ghi "{{identity}}".',
    'whyNoNameplate': 'Không đọc được thương hiệu hoặc model trong ảnh.',
    'askTitle': 'Chúng tôi chưa chắc thiết bị này thuộc sàn nào',
    'askBody': 'Hãy chọn một sàn, chúng tôi sẽ tải đúng danh mục.',
    'askGuess': 'Phỏng đoán của chúng tôi là {{marketplace}}.',
    'askCta': 'Chọn một sàn để tiếp tục',
    'bestGuess': 'Khả năng cao nhất',
    'setOnce': 'Danh mục và tiền tệ được đặt sau khi bạn chọn — chúng tôi không đoán.',
    'sheetTitle': 'Chọn sàn',
    'sheetSubtitle': 'Danh mục và tiền tệ được đặt sau khi bạn chọn — chúng tôi không đoán.',
    'categoryNotSet': 'Danh mục: chưa đặt — hãy chọn bên dưới. Chúng tôi thà hỏi hơn là đoán.',
    'confidence': 'Độ tin cậy AI: {{word}} · {{pct}}%',
    'confHigh': 'Cao',
    'confMedium': 'Trung bình',
    'confLow': 'Thấp',
}
HUB['vi'] = {'pickMarketplace': 'Chưa chọn sàn', 'statusMissingMarketplace': 'Chọn một sàn'}
```

> **`confidence` / `confHigh` / `confMedium` / `confLow` are user-visible in v1**, not dormant — S0-2 has
> landed and `site_type_confidence` is on the wire (§0.4). Proofread those four in all six locales as
> carefully as the rest; they will render on the first scan.
>
> The Thai and Vietnamese `whyNameplate` use plain `"` around `{{identity}}` rather than escaped
> typographic quotes, because `esc()` escapes them for you. Do not hand-escape.

### Step 10-3. Run it, then run the canary — integration G13

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp/src/i18n && python _phase4_keys.py
```

Expected: six lines, `<locale>  +20 keys (22 lines), still valid, CRLF intact`.

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
git diff --stat src/i18n/locales/
```

Expected: **`6 files changed, 132 insertions(+)`** (22 each) and **0 deletions**. **Any deletion means a
round-trip happened** — revert those six files (`git checkout -- src/i18n/locales/` is forbidden by the
operating rules, so restore from `git stash`-free means: re-run nothing, tell the owner, and restore the
six files individually from `git show HEAD:src/i18n/locales/<f>.json`) and redo as text.

Then the canary — all three properties, all six files:

```bash
node -e "
const fs=require('fs');
for (const f of ['en','ja','th','vi','zh-Hans','zh-Hant']) {
  const b=fs.readFileSync('src/i18n/locales/'+f+'.json');
  const s=b.toString('utf8');
  const crlf=(s.match(/\r\n/g)||[]).length, lf=(s.match(/\n/g)||[]).length;
  JSON.parse(s);
  console.log(f, 'crlf='+crlf, 'lf='+lf, crlf===lf ? 'OK' : 'BARE-LF!!');
}"
```

Expected: `crlf === lf` in all six, and the counts are the baselines **+22**:
**en 5329 · zh-Hans 5301 · zh-Hant 5301 · ja 5234 · th 5218 · vi 5319.**

And the duplicate-key check, which `JSON.parse` cannot do:

```bash
python -c "
import json
for f in ['en','zh-Hans','zh-Hant','ja','th','vi']:
    raw=open('src/i18n/locales/%s.json'%f,'rb').read()
    hits=[]
    def hook(p):
        seen={}
        for k,v in p:
            if k in seen: hits.append(k)
            seen[k]=v
        return seen
    json.loads(raw.decode('utf-8'), object_pairs_hook=hook)
    print(f, hits)
"
```

Expected: `['close']` for every file. Anything else means the duplicate key was destroyed.

### Step 10-4. Prove every new key resolves in every locale

```bash
node -e "
const ks=['routing.willListOn','routing.change','routing.why','routing.whyNameplate','routing.whyNoNameplate','routing.askTitle','routing.askBody','routing.askGuess','routing.askCta','routing.bestGuess','routing.setOnce','routing.sheetTitle','routing.sheetSubtitle','routing.categoryNotSet','routing.confidence','routing.confHigh','routing.confMedium','routing.confLow'];
for (const f of ['en','ja','th','vi','zh-Hans','zh-Hant']) {
  const j=JSON.parse(require('fs').readFileSync('src/i18n/locales/'+f+'.json','utf8'));
  const d=j.mobile.detail, h=j.mobile.reviewHub;
  const miss=ks.filter(k=>k.split('.').reduce((o,p)=>o&&o[p],d)===undefined)
    .concat(['pickMarketplace','statusMissingMarketplace'].filter(k=>h[k]===undefined));
  // C7 — Phase 5's key must be there and Phase 4 must NOT have added a hint namespace.
  const desc=['101lab','101machine','101it','101recycle']
    .filter(m=>typeof d.marketplaceOption?.[m]?.description!=='string');
  console.log(f,
    miss.length?('MISSING '+miss.join(',')):'keys OK',
    desc.length?('NO DESCRIPTION for '+desc.join(',')):'description OK',
    d.marketplaceHint?'⛔ marketplaceHint PRESENT — C7 violated':'no marketplaceHint OK');
}"
```

Expected: six lines reading `keys OK   description OK   no marketplaceHint OK`.

## 11. Verification

Gate ids in **bold** are integration §4's, so a reviewer can tick them off against that document.

### V-1. Types and lint

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx tsc --noEmit; echo "tsc exit=$?"
npm run lint
```

Expected: `tsc exit=0` with no output (**G11** — baseline re-verified today at `45abb39`). Lint: no **new**
errors vs. the pre-change run; capture that output in Step 1-3 if you want a diff.

Two `tsc` tripwires worth knowing, both deliberate:
- If `useSupportedMarketplaces` still compiles with `q.data.length`, you did not switch to
  `placeholderData` (Step 7-9) — `placeholderData` widens the type to `| undefined`.
- If `CLEARED_CATEGORY_FORM_FIELDS` type-checks where `CLEARED_CATEGORY_DRAFT_FIELDS` belongs (or the
  reverse), one of them is wrong: the draft's `categoryId` is `string | null` and the form's is `string`.

### V-2. App test suite — **G12**

```bash
npx jest --silent 2>&1 | tail -6
```

- Baseline, re-measured today at `45abb39`: **96 suites / 862 tests / 22 snapshots**, all passing.
- Expected after: **102 suites / 925 tests / 22 snapshots** (Step 8-11 has the per-suite arithmetic).
- **The gate is "zero pre-existing suites red", not the totals** (integration G12 — phase test counts have
  been wrong five times in this programme).
- The `A worker process has failed to exit gracefully` line is pre-existing. Ignore it.

If `mapSmartDetection.test.ts` fails, you changed the currency behaviour instead of locking it — re-read
Step 8-4.

### V-3. The module-graph split — **blocker (e)**

```bash
grep -rn "routing/supportedMarketplaces'" src/stores/scanDraftStore.ts app/scan/processing.tsx   # 0 hits
grep -rn "supportedMarketplacesCache"     src/stores/scanDraftStore.ts app/scan/processing.tsx   # 1 each
grep -n  "^import" src/features/scanner/routing/routingState.ts                                  # all `import type`
npx jest src/stores/__tests__/scanDraftStore.test.ts \
         src/stores/__tests__/scanDraftStore.hydrate.test.ts \
         src/lib/__tests__/scanResume.test.ts 2>&1 | tail -8
```

Baseline for those three suites, measured today (twice — before and after Phase 5 landed, identical both
times): **3 suites passed, 27 tests passed, ~1.1 s**. After Step 8-8 adds 6 store tests: **33 tests**, and
the runtime should still be around a second. A jump to several seconds, or any
`Cannot use import statement outside a module` naming `socket.io-client` or `expo-secure-store`, means the
axios graph got in.

### V-4. Dev endpoint — **OPTIONAL, and not your deploy**

Integration C12: §7A is the server engineer's. Run this only once they say the route is live.

```bash
curl -s https://testapi.greenbidz.com/api/v1/mobile-config
```

Expected once §7A ships:
`{"success":true,"message":"Mobile config fetched successfully","data":{"supported_marketplaces":["101lab","101machine","101it"]}}`

**Until then it returns 404** (re-confirmed today) and that is fine — V-8 is the gate that matters, and
every other step in this phase works against the 404. **Do not edit the dev host's `.env` and do not
`pm2 restart` anything** to make this pass; ask the server engineer.

### V-0. Cold-install FIRST scan — **G14**, blocker (a). RUN THIS BEFORE V-5.

This is the release-day silent failure, and it is **numbered zero because you must run it before you have
built up an MMKV cache by testing everything else**. Once the cache is warm you cannot observe the bug
without clearing storage again.

```bash
# Clear the app's storage completely (MMKV included). Verified package id: com.greenbidz.bridge.
adb shell pm clear com.greenbidz.bridge
```

1. Network **ON**. Launch the app and sign in.
2. **Wait for the launch prefetch.** Step 7-10 fires `queryClient.prefetchQuery` in `_layout.tsx`'s mount
   effect (`:149-158`). It resolves in a few hundred ms; give it two seconds before starting a scan.
3. Scan **one photo of an IT item** (a monitor or a server — something the AI routes to `101it`).
4. **Expected: the draft either ADOPTS `101it` or ASKS.** The chip shows `WE'LL LIST THIS ON · 101IT`, or
   the amber ask card.
5. **FAIL looks like this:** the chip shows `101LAB`, or there is no chip at all, with the network on and
   the item obviously IT. That means `supportedNow()` read an empty cache — the prefetch is missing,
   pointed at a different `queryKey` than the hook, or `staleTime` mismatched — and **every user's first
   scan silently behaves like 1.0.3**.
6. Confirm it in the store, not just on screen — the chip is the symptom, the draft is the fact:
   ```
   The draft must NOT be `{ marketplace: '101lab', marketplaceConfirmed: true }`
   for an item the AI routed to 101it.
   ```
   Read it via the React Native debugger, or temporarily log
   `useScanDraft.getState().current?.marketplace` + `.marketplaceConfirmed` in `detail.tsx` and remove the
   log afterwards.

**V-0 and V-8 must be distinguishable.** They differ in exactly one variable — the network — and a build
with the cold-cache bug passes V-8 perfectly. Run both, in this order, and write down both results.

### V-5. On-device — the confirmed path

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
npx expo start --clear
```

Emulator notes: boot with `-dns-server 8.8.8.8` or DNS resolution fails inside the AVD; `CI=1` in the
Metro environment disables hot reload, so unset it. `EXPO_PUBLIC_*` values are inlined at bundle time — a
Metro restart applies `.env` changes, a reload does not.

1. Scan one photo of a **lab** item with a legible nameplate → `/scan/detail`.
2. Expect the chip at the top of the scroll: `WE'LL LIST THIS ON` + `101LAB` + the AI badge + the lab
   description (`Lab & scientific equipment`, Phase 5's copy) + a `WHY` block quoting the nameplate + a
   quiet `Change`.
3. **Expect a confidence line — this changed.** S0-2 has landed (§0.4), so
   `AI confidence: High · 94%` (or Medium/Low with the real number) **should** render. If you see **no**
   percentage, either the backend you are pointed at predates `8383b62` or `mapProductData` is dropping
   `site_type_confidence` — check Step 6-3. The earlier draft of this document told you to expect no
   number; that instruction is obsolete.
4. Tap `Change` → the sheet lists exactly `101LAB / 101MACHINE / 101IT` (three, because `101recycle` is
   withheld until M-1) each with its one-line description, `101LAB` check-marked, `101LAB` badged
   `Best guess`. **Known issue:** if a keyboard is up when the sheet opens, the first tap is swallowed —
   Phase 3 has not landed, so `Sheet.tsx:120` still has no `keyboardShouldPersistTaps` (integration G19).
   Dismiss the keyboard first; do not fix it here.
5. Pick `101MACHINE`. Expect: the statement re-renders as `101MACHINE`; the category field is **cleared
   and stays cleared** (this is blocker (c) — if the old lab category reappears after a beat, the
   `onConfirm` patch is not carrying `CLEARED_CATEGORY_DRAFT_FIELDS`); the category picker reloads the
   machines tree; the chip shows `Category: not set — pick one below…`.
6. Submit stays disabled until a category is picked — the pre-existing required gate, now honest.

### V-6. On-device — the ask path

Scan a photo with **no legible nameplate** (`../SCAN_FLOW_BACKEND.md:552`; `needs_clearer_photo` is true
on 37.5% of products, integration C8).

1. Expect the amber ask card: `We're not sure where this belongs` + the body line + `Our best guess is
   101LAB.` + the primary `Choose a marketplace to continue` + the `we won't guess them` line.
2. Expect **nothing check-marked** in the sheet when you open it.
3. Expect the footer's Submit **disabled** before you choose, and enabled (subject to the other required
   fields) after.
4. Kill and relaunch the app mid-draft. Expect the ask state to persist — `marketplaceConfirmed: false` is
   on the draft and drafts are persisted to MMKV.
5. **Also try to force a `regex_override` / `low_confidence_fallback` ask** now that S0-2 emits sources:
   scan something the vision pass and `inferSiteTypeFromProduct` disagree about. If you cannot construct
   one, say so — integration **G4** owns measuring how often those two fire, and it is a dev run, not an
   on-device guess.

### V-7. On-device — the mixed grouped path

Scan four photos spanning marketplaces → `/scan/grouped-review`.

1. Each `HubRow` shows its own marketplace under the title.
2. Any row whose routing is unanswered shows `Marketplace not chosen` in amber and `Pick a marketplace` in
   its status chip, and is excluded from the `n of m products ready` count.
3. Tap that row → `grouped-edit` → the chip's ask state → pick → back → the row now shows the marketplace
   and counts as ready.
4. **The back-out case, blocker (c)'s grouped half.** Tap a row, change its marketplace in the chip, then
   leave via the **app-bar back / Android hardware back**, NOT Save. Return to the row. Expected: the row
   shows the **new** marketplace and its category is **empty** (so the row is *not* ready). A row that
   shows the new marketplace and is still marked ready means `patchQueuedItem` is not carrying
   `CLEARED_CATEGORY_DRAFT_FIELDS` and the submit would send the old tree's id.
5. Tap `It's actually one product` on a genuinely **mixed** batch. Expect the merged draft to show the
   **ask** state, not product 0's marketplace silently applied — that is Step 6-9's guard on screen.

### V-8. On-device — fail-closed — **G15**

1. Turn off the emulator's network, `adb shell pm clear com.greenbidz.bridge`, relaunch, start a scan.
2. Expect **no chip at all** and pre-unlock behaviour: `fallbackMarketplaces()` returns `['101lab']`,
   `supported.length <= 1`, `routingNeedsAsk` returns `false` at its first line, `RoutingChip` returns
   `null`. Nothing is broken; the seller sees exactly 1.0.3.
3. Now turn the network **on**, relaunch, and scan again. The chip must **appear**. If it does not, the
   MMKV cache is not being written — check `writeCachedSupported` (Step 7-7) and the prefetch (Step 7-10).

**Compare V-0 and V-8 side by side and write both down.** Identical-looking results with the network in
different states is the whole point of running two gates.

### V-9. C4's guard — **G17**

On the single-item path, with `marketplaceConfirmed: false` (i.e. in the ask state), tap **Submit**.

Expected: an error haptic + an alert naming the reason (`Choose a marketplace to continue`), **no
navigation, and no network request**. Watch the Metro / network log to confirm nothing was sent — a
submit that fails server-side is not the same as a submit that never happened.

If Submit goes through, `missingRouting()` is missing or is not called inside
`submitSingleValidated`'s `handleSubmit` callback (Step 8-10). Note that the footer gate alone cannot do
this after Phase 5.

### V-10. Restore `.env` — **do not skip**

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp
cp "/c/Users/Pc/AppData/Local/Temp/claude/.env.backup.phase4" .env
head -1 .env
diff "/c/Users/Pc/AppData/Local/Temp/claude/.env.backup.phase4" .env && echo "ENV RESTORED IDENTICAL"
git diff --stat -- .env; echo "git diff --stat exit=$? (output above must be EMPTY)"
```

Expected: `GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1`, `ENV RESTORED IDENTICAL`, and
**empty** output from `git diff --stat -- .env`.

Note that `git diff -- .env` is empty **whether or not** you restored it, because `.gitignore:34` ignores
`.env` — so the `diff` against the backup is the load-bearing check, not the git one. Paste both into your
hand-off note. An earlier session left this file on a `localhost` URL and nobody could tell from
`git status`.

**Do not delete either backup.** `.env.backup.phase4` is yours; `GreenBridgeApp.env.PROD.canonical` is the
programme's (integration C9) and another phase may still need it.

### V-11. Confirm nothing was committed, pushed, deployed, or OTA'd

```bash
cd /c/Users/Pc/Desktop/greenBridge/GreenBridgeApp && git status --short && git log --oneline -1
cd /c/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend && git status --porcelain | wc -l && git log --oneline -1
```

Expected:

- **App:** your changes are working-tree edits on your feature branch, HEAD unchanged from the `45abb39`
  you branched at. When you do commit, commit **by explicit path** — `git add path/one path/two` — never
  `git add -A`, `git add .` or `git commit -a`. Compare `git status --porcelain | wc -l` against the **1**
  you recorded in Step 1-2 plus exactly the files you created.
- **Backend:** unchanged. HEAD still `8383b62` on `fix/seller-gate-existing-sellers`, and
  `git status --porcelain | wc -l` still **27**. If either moved, you edited a tree that is not yours
  (integration C12).
- **No `eas update`, no `eas build`, no `eas submit`, no push, no ssh, no `pm2`, no migration.** iOS 1.0.3
  is in App Review and `runtimeVersion: { policy: 'appVersion' }` (`app.config.ts:90-92`) means an OTA for
  1.0.3 would reach the binary Apple is testing.
- **`greenbidz-ai-assistant/` untouched.**

## 12. Drift found while verifying

The parent plan's citations were correct when written; these had moved or were imprecise.

| Claim in the plan / brief | Correct today |
|---|---|
| `resolveSiteTypeForGroup` drops the confidence at `wordPressSmart.js:1663` / `:1684` (parent plan), corrected to `:1664` / `:1687` by the earlier draft of this document | **Both are now obsolete — S0-2 landed.** `resolveSiteTypeForGroup` is at **`:1687`** and its returns (**`:1694`** hint-skip, **`:1733`** contest) now carry `confidence` **and** `source`; `processProductGroup` stamps `site_type` at **`:2054`** and `site_type_confidence` / `site_type_source` at **`:2125-2126`**, via the pure `buildRoutingSignal` (**`:1987-2013`**). The file is now **3550** lines (was 3411). See §0.4. |
| `needs_clearer_photo` stamped at `wordPressSmart.js:818-819`, reached via `:1869`, run by `processProductGroup` `:1922` | **`:828-829`**, via `normalizeIdentityAndConfidence` (`:820`) reached at **`:1915`**, run by `processProductGroup` **`:2016`**. The upload-level OR moved to **`:2519-2521`** (non-streaming) and **`:3506-3508`** (streaming). |
| `pickDefaultParent` at `wordPressSmart.js:677-682` | **`:687-692`**. Behaviour unchanged: `tree[0]` for a flat tree, which is why machines yields 5300 "Boring & Drilling Machines" (§0.5). |
| `merged_single` = the first product with data, `wordPressSmart.js:3317-3320` | **`:3451`** / **`:3453`** (streaming) and **`:2488`** / **`:2490`** (non-streaming). Behaviour unchanged, so Step 6-9's mixed-batch guard is still required. |
| The backend prompt returns USD, `wordPressSmart.js:421` | The `- currency: "USD"` line appears once per locale prompt: **`:374`**, **`:386`**, **`:398`**, **`:409`**. Guard 1 (§6.4 / Step 8-4) is unaffected. |
| App tree at `11ef609`, backend at `aabac85` | **App `45abb39`** (Phase 5 landed: `c490428` M-7, `dbe6c4f` M-8/M-9/M-11, `45abb39` M-5/M-10). **Backend `8383b62`** (Phase 1 landed: `eb073fb` S0-1, `8383b62` S0-2), 27 dirty entries. Both re-verified line-by-line — see §0.1. |
| App jest baseline `92 suites / 825 tests / 22 snapshots` | **96 suites / 862 tests / 22 snapshots**, all passing, 12.8 s — re-run today after Phase 5. `npx tsc --noEmit` still exit 0. |
| Six locale files at 5290/5262/5262/5195/5179/5280 lines | **5307/5279/5279/5212/5196/5297** — Phase 5's `_phase5_keys.py` added exactly 17 lines to each. `crlf == lf` and `dups == ['close']` still hold in all six (re-measured). |
| `marketplaceFromSiteType (constants.ts:126-128)` | The function is **`:116-130`**; `:116-118` is only the signature. Behaviour as described (`null` for off-list). |
| `Sheet.tsx:24-37` = the Android inset fix | The **comment** is `:19-33`; `SHEET_PADDING_BOTTOM` is `:37`; the live code is `useSafeAreaInsets()` at **`:53`** and `Math.max(insets.bottom, SHEET_PADDING_BOTTOM)` at **`:110`**. |
| `MarketplaceCard.tsx:22-76` becomes the sheet body | `MARKETPLACE_LOCKED` is at **`:22`** and `return null` at **`:29`** (confirmed — the plan's own §10 row 9 had already logged that ":21" was the comment). The pill row that becomes the sheet body is **`:39-76`**; the component spans `:24-82`. |
| `processing.tsx:504-508` is "the single-photo path" | It is the **legacy / manual-grouped `analyze-process-images`** path. It runs only when `useSmart === false`, i.e. `mode !== 'single'` (`:113`; the `else` itself is at **`:481`**); single-mode smart scans hand off to `processing-v2.tsx` at `:372-374` because `.env` sets `EXPO_PUBLIC_SMART_DETECT_V2=1` (`flags.ts:30`, read at `:120`). The patch is still needed there. |
| `detail.tsx:136` is the chip's slot | Correct — `:127` is `<IdentityCard />`. For completeness: `<MarketplaceCard />` is at **`:129`** and the footer's `allRequired` at **`:148`**. |
| `mapSmartDetection.ts:186-190` / `smartDetectionTypes.ts:35-37`, `:122-125` | Ranges contain the code claimed; the exact lines are `mapSmartDetection.ts:188`, `smartDetectionTypes.ts:37` and `:125`. |
| **Not in the plan** — currency | `src/features/scanner/__tests__/mapSmartDetection.test.ts:118-122` already asserts `mapProductData(…, '101it') → TWD`. §6.4's currency item is therefore a **lock + regression test**, not a behaviour change: all six call sites (`smartDetect.ts:56`, `:147`, `smartDetectStream.ts:241`, `recognitionJobClient.ts:307`, `pendingAiResume.ts:84`) already pass `getSiteType()`. Do not delete that test. |
| **Not in the plan** — form vs store | `CategoryConditionCard.tsx:46-47` reads `watch('marketplace')` (form) while `useDetailController.ts:55-56` and `grouped-edit.tsx:67` read the **store**. Latent while the picker is hidden; activated by the chip. Impact **re-checked and corrected**: not cosmetic. `category_name` IS submitted (`buildFormData.ts:164` single, `:271` grouped; ids at `:161` / `:270`), so a null `categoryName` drops that field from the payload. `categoryName` is rendered nowhere in the scan flow. Fixed in Step 8-6. |
| **Not in the plan** — `grouped-edit.tsx` | It renders `MarketplaceCard` at `:219` and `IdentityCard` at `:217` too, so the chip must be mounted on **both** editors (Step 9-6), not just `detail.tsx`. |
| Backend tree | Not on `main`. HEAD `aabac85`, branch `fix/seller-gate-existing-sellers`, 8 modified files. |

Not verified, and labelled as such:

- **`needs_clearer_photo`'s live per-product value** is read from source
  (`wordPressSmart.js:828-829` → `:1915` → `processProductGroup` `:2016`) and from the integration
  doc's 27/72 = 37.5% re-measurement of the recorded DEV runs. No smart-detect call was run during this
  revision. The repo's fixture
  `src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt` predates the field, so it
  cannot corroborate it either. V-6 is where you observe it.
- **The mixed-marketplace grouped submit** is code-read only (plan §6.5). This phase does not submit
  a listing; release gate 3 owns that.
- **Keyboard coverage of the chip's ask-state CTA** is not assessed — the chip sits at the *top* of
  the scroll so it is unlikely, and M-11 owns the footer keyboard fix.
- **Prod accuracy** is unverified for the whole programme (plan §8.3 gate 1). Nothing here changes
  that.

---

## 13. What this phase does NOT do

- **No confidence THRESHOLD.** The number itself now renders — S0-2 landed, so `siteTypeConfidence` is a
  real value on every product (§0.4) and the chip's `AI confidence: High · 94%` line is live in v1. What
  this phase does **not** do is let that number change any behaviour: no branch, no gate, no routing
  decision reads it. The bands in plan §2.3 are v1.1, after S0-2's output has been logged against ground
  truth for a while. Three tests fail if anyone gates on it — Step 6-6's
  `a low confidence number alone does NOT change any mapped field`, and Step 6-8's
  `the confidence NUMBER alone never flips the trigger` / `never changes the state`.
- **The loading copy does not name the marketplace.** Parent plan §6.1's fifth design bullet
  ("Loading 101MACHINE categories…") is **deliberately not implemented here**, decided rather than
  deferred. Two verified reasons: (1) on the smart path the marketplace is unknown until the terminal SSE
  `result` frame (`smartDetectStream.ts:225-245`), while the labels the seller reads come from earlier
  `stage` frames whose only field is a phase (`processing-v2.tsx:72-77`) — there is nothing true to name
  at label time, and naming the deployment default would be *wrong* on the ~37.5% of items that get
  re-routed; (2) the one place it IS implementable is `CategoryConditionCard.tsx:204-206`'s
  `categories.isLoading` spinner, which fires after the chip's pick when the marketplace is known — and
  that file belongs to Phase 3's M-2 (~190-line rewrite) and Phase 5's `:203` edit, so touching it here
  would create a three-phase conflict in a file this phase otherwise never opens. **Handed to Phase 3's
  M-2**, with that anchor.
- **No `MARKETPLACE_OPTIONS` change, and no marketplace-description keys.** Integration C7: the third
  field is Phase 5's `description` and the string lives at
  `mobile.detail.marketplaceOption.<value>.description`. This phase deleted its `hintKey`/`hint` and its
  four `marketplaceHint.*` keys. If the copy reads thin in the ask state, lengthen **that one key**.
- **No backend edit of any kind.** Integration C12 gives §7A — the controller, the route, the `app.js`
  mount, the backend test and the dev deploy — to the **server** engineer, on the branch that already
  carries Phase 1 and Phase 2. This phase's client is correct against a 404 (V-8).
- **No `101recycle` in the supported list.** It stays out of `MOBILE_SUPPORTED_MARKETPLACES` until
  M-1 fixes the tree; otherwise a routed recycle item has its `categoryId` cleared and cannot be
  submitted (`schema.ts:23`).
- **No backend routing changes.** S0-1 and S0-2 have **already landed** (backend `8383b62`, §0.4) and this
  phase consumes them. S0-3a/S0-3b (blank category, stop the `recycle` bucket) and S0-4/5 are Phase 2 and
  have **not** landed; this phase reads `category_source` as `null` and degrades cleanly without it.
- **No category-picker work.** M-2's searchable sheet is what makes "we won't guess the category"
  humane; this phase only stops presenting a guess as an answer.
- **No profit-card change.** M-5.
- **No `requiredStatus.ts` change.** M-7 owns it; the routing gate is applied at the two call sites
  (`detail.tsx:186`, `grouped-review.tsx:101`/`:158`) precisely to avoid a collision.
- **No footer / checklist restructure.** M-8, M-9, M-11.
- **No per-item marketplace editing from `grouped-review`.** Read-only there (plan §9); retargeting is in
  `grouped-edit`. A second write path re-opens the hydration race.
- **No eighth `REQUIRED_ROWS` entry for routing.** Integration C4's "fuller option" — a visible checklist
  row for the marketplace — needs `getRequiredStatus` to take the draft, which changes a signature
  `grouped-review.tsx` also calls, in a file M-7 owns. Step 8-10's guard is the correctness fix; the
  checklist row is a product call (integration Decision 4 territory), not this phase's.
- **No fix for `Sheet.tsx`'s swallowed first tap.** Phase 3 has not landed; `Sheet.tsx:120` still has no
  `keyboardShouldPersistTaps` (verified today). It is Phase 3's file and integration **G19**'s gate.
  Recorded in Step 1-5 and V-5 step 4.
- **No FX / TWD-native pricing.** Plan §6.4.
- **No OTA, no store submission, no prod deploy, no prod DB write, no migration.**
- **`greenbidz-ai-assistant/` untouched.**

---

## 14. What must land before and after

**Before this phase can be *merged* (not before it can be *built*):**

| Dependency | Why | Status today (`45abb39` app / `8383b62` backend) |
|---|---|---|
| **M-7** — a checklist row or a guaranteed-valid default for every schema-required field (Phase 5) | **Integration C3 / parent plan §7, and it is the hardest one to see.** M-4 is what lets the AI write `marketplace` into a `z.enum([...])` field (`schema.ts:57`). `requiredStatus.ts`'s `rowForPath` returns `null` for `marketplace`, so an unrecognised value fails `detailSchema` on a field with **no checklist row and therefore no on-screen explanation** — a Submit button that refuses with nothing to fix. Parent plan §7 requires this **before** marketplace starts taking AI input; the earlier draft of this document waved it off as "M-7 owns requiredStatus.ts". It does, and that is exactly why the ordering is a merge gate rather than a note. | ✅ **LANDED** — `c490428`, `rowForPath` exported at `requiredStatus.ts:47`, `useRequiredRowLabel` at `src/features/scanner/requiredRowLabels.ts`. Verified. Re-check with Step 1-5 (c) before merging; if a rebase ever drops it, **this phase must not merge**. |
| **C4's `missingRouting()` guard** (this phase, Step 8-10) | Phase 5 has already un-disabled the single-mode Submit (`DetailFooter.tsx:110`), so without the guard an item with `marketplaceConfirmed: false` submits. This is not a dependency on another phase — it is a **self-check**: the guard is in scope here and merging without it ships the defect. | ⚠️ **YOURS.** Gate **G17** / V-9. |
| **M-1** — 101recycle category endpoint + shape (Phase 3) | Until it lands, `101recycle` must be withheld from `MOBILE_SUPPORTED_MARKETPLACES`. This phase works without it; shipping all four does not. Recycle ids are 1147–5366 and lab ids 5371–5849 with **zero** overlap, so every AI recycle id is cleared on arrival and `schema.ts:23` then blocks Submit permanently. | ❌ **NOT LANDED** — Phase 3 has not run (`Sheet.tsx` has no `keyboardShouldPersistTaps`). Keep recycle out. |
| **M-2** — searchable category sheet (Phase 3) | The `prefillCategory: false` states hand the seller a category to pick **by hand**, and after §0.5 that now happens on **every** machines- and recycle-routed item — which integration C8 measured as where the 37.5% ask rate concentrates. Today the picker is two stacked 240 px nested scrollers with no search (`CategoryConditionCard.tsx:212`, `:268` — both `maxHeight: 240` + `nestedScrollEnabled`, verified), with 38 of 101lab's 62 leaves under one parent. Plan §4.2 calls it a v1 blocker for exactly this reason, and §0.5 makes it more binding, not less. | ❌ **NOT LANDED.** |

**Already landed upstream, and this phase consumes them:**

| Task | Status | What it turns on here |
|---|---|---|
| **S0-1** — narrow `inferSiteTypeFromProduct` | ✅ `eb073fb` | Removes the centrifuge-as-GPU class of misroute, so the chip is right more often. |
| **S0-2** — emit `site_type_confidence` + `site_type_source` | ✅ `8383b62` | The confidence line in the confirmed chip **renders in v1**, and `regex_override` / `low_confidence_fallback` are **live** ask-triggers. §0.4 has the three consequences, including the one that matters: the no-threshold rule is now breakable. |

**Can still land in any order relative to this phase (it degrades to `null` without them):**

| Task | What it turns on here |
|---|---|
| **S0-3a** — `category_source: 'ai' \| 'fuzzy' \| 'unresolved'` (integration C6) | The "Not set" state starts firing on genuinely unresolved categories, not just on machines/recycle — i.e. `CATEGORY_UNTRUSTED` becomes the belt and `category_source` the braces. Grepped today: not on the wire yet. |
| **S0-3b** — stop the `recycle` bucket meaning "unsure" | While it is absent, an unsure item arrives as `101recycle` + a `low_confidence_fallback` source; since recycle is withheld from the server list, `pickAppliedMarketplace` discards it and the chip asks. Correct behaviour, reached the long way round. |

**One number the owner must see before the locks flip in a shipped build — integration G4.** S0-2 is now
emitting `site_type_source`, so the ask rate is measurable and is no longer just
`needs_clearer_photo`'s 37.5%. Run one dev pass, write down the
`regex_override` + `low_confidence_fallback` share, and **escalate if it exceeds 20% of products** —
combined, the total ask rate then clears ~50%, which is a product decision (integration Decision 4), not
an implementation detail. This is a **gate, not a courtesy**: it was cheap to skip when the fields were not
on the wire, and it is not any more.

**After this phase, before the locks flip in a shipped build** (plan §8.3 — all four are gates, none
of them are in this phase):

1. Prod re-measurement of routing accuracy (≥ 85%, no new failure class). Every number in the plan is
   DEV; prod runs a different vision-provider configuration.
2. S0-1 regression over the 800-listing lab sample (false-101it 9% → ~0).
3. One genuinely mixed grouped submit on **DEV**, confirming each product's `site_id` and that the
   single spanning auction group renders acceptably.
4. On-device pass on an SE-class phone and one Android with a 3-button nav bar, including the
   Vietnamese condition pills.

**Then, and only then:** owner approval → prod deploy of the M-12 route + its env var → the 1.0.4
binary. Prod is a separate, explicitly-approved step. Nothing in this file authorises it.
