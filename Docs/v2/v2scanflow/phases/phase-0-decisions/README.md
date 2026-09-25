# Phase 0 — Decisions and blockers (no code)

Half a day. Everything here is a question that changes the shape of a later phase. Answer them
before Phase 1 starts, in writing, in this file.

## Verify before anything is built

| # | Claim to check | Where it came from | If false |
|---|---|---|---|
| V1 | `/drafts/:id/items` and `/drafts/:id/items/counts` exist on the target dev backend | `items.tsx:30-32` says `testapi` returns **404** — a comment from ~2026-09-17, never re-measured | Phase 1 is blocked on a backend deploy. `curl` both against `testapi.greenbidz.com` and local `:4000` and record status codes here. |
| V2 | The direct-SSE lane (`/wp/analyze-smart-detection-v2`) returns the same product shape the recognition-job lane persists to the server draft | `processing-v2` handles both; only the job lane creates a server draft today | Phase 1 needs a client-side "create draft from products" call — the web's `seedGuestDraft` equivalent. Find the endpoint the job lane's backend uses and confirm a client may call it (`<VERIFY>`). |
| V3 | Photo-less items can be **published** on the web, or only **accepted** | `01-problems.md` P8; CLAUDE.md records photos being made required on `/valuation` and causing a dead end | Decides whether Phase 2 relaxes `usePublishDraft.ts:190` outright or only for document-sourced rows. Read the web's `canSubmit` / accept predicate and cite it. |
| V4 | `openDetectedItem` has no caller that must survive | grep shows callers only in `valuation.tsx:216`, `submit.tsx:205` | If something else needs it, Phase 4's editor must cover that case before Phase 6 deletes it. |

---

## ANSWERED — V1, 2026-09-23

**Verdict: Phase 1 is NOT blocked. The `items.tsx:30-32` comment is stale.**

The 404 it describes was never an "older build" — it is a **feature flag**, and the flag is now on
everywhere.

| Evidence | Where |
|---|---|
| All `/:draftId/items*` routes are gated by `requireScanV2ReviewScale`, which 404s when off | `backend/routes/draftRoutes.js:29-37` |
| The flag reads `SCANV2_REVIEW_SCALE === "true"` | `backend/controller/draftItemsController.js:74-76` |
| `SCANV2_REVIEW_SCALE=true` **on the dev server** (`/www/wwwroot/greenbidz-test-backend/.env`) and on the prod checkout | read over ssh, 2026-09-23 |
| `SCANV2_REVIEW_SCALE=true` locally | `backend/.env:178` |
| `greenbidz-test-backend` online, restarted 57 min before the check | `pm2 list` |

**Measurement caveat, recorded so nobody repeats it.** An unauthenticated `curl` to
`testapi.greenbidz.com/api/v1/drafts/1/items` returns **403 "Missing or invalid x-drafts-key or
seller token"** — that is `draftAuthGuard`, registered at `draftRoutes.js:89` (`draftRouter.use`),
which runs **before** the route-level flag guard at `:139`. So a 403 from outside proves the route
is mounted but says **nothing** about the flag. The flag had to be read at source. (A first attempt
also reused one `-o` capture file across requests and read a stale body — the reused-filename trap
in CLAUDE.md. Redone with the body inline.)

### Routes that exist — three `<VERIFY>` markers upgraded to facts

| Route | Registered | What it unblocks |
|---|---|---|
| `GET /:draftId/items` · `/items/counts` · `/items/:id` | `draftRoutes.js:139-144` | Phase 1's whole premise |
| **`PATCH /:draftId/items/:id`** — per-item autosave, `{form_json_patch, expected_row_version}`, optimistic concurrency | `draftRoutes.js:175-180`; mobile note `draftItemsApi.ts:48-49,168` | **Phase 4's editor has its endpoint.** Server-side write-validation covers price/year/condition/**operation_status**/site_type/subcategory (`draftItemsController.js:743`), behind `SCANV2_ITEM_VALIDATION` (default ON in dev) |
| `POST /:draftId/items:bulk` | `draftRoutes.js:160-165` | Phase 3's bulk accept/discard |
| `POST /:draftId/convert-currency` — atomic lot-wide FX | `draftRoutes.js:167-172` | **D3 was scoped out on the assumption this did not exist. It does.** Reopen D3. |

### ⚠️ Finding that changes Phase 3's design

The bulk route's op vocabulary is **not** a general field-applier. Mobile's client types it as
`type DraftItemBulkOp = 'accept' | 'discard'` (`draftItemsApi.ts:80`), and the only field-setting op
found in the controller is `set_category` (`draftItemsController.js:456`).

So **"Apply to selected" for Location / Operation status cannot be one bulk call today.** Phase 3
must either (a) fan out N `PATCH` calls with per-row `expected_row_version` — which means handling
partial failure and a 409 on any stale row — or (b) get a new bulk op added server-side. **(a) needs
no backend change and is the recommendation**; the phase doc's `<VERIFY>` on this is now resolved
against it. Mobile has no PATCH client yet (`draftItemsApi.ts` has none) — Phase 3 or 4 writes it.

---

## ANSWERED — V2, 2026-09-23

**Neither lane creates a server draft in the normal (foreground) flow.** The plan's assumption that
"the recognition-job lane already creates the draft" is **WRONG**. Phase 1 must create it explicitly.

| Finding | Evidence |
|---|---|
| A **foreground** recognition job deliberately does NOT persist a draft or fire the bell — *"the seller is already looking at the result, so a draft + notification would be spurious. The draft is created on demand only…"* | `backend/services/recognitionRunner.js:261-263` |
| The draft IS created when the job is **detached** (backgrounded): `persistPendingAiDraft`, `Draft.findOrCreate` keyed by `job_id` (DB UNIQUE ⇒ one draft per job) | `recognitionRunner.js:16-18, 276-288` |
| `POST /recognition-jobs/:id/detach` flips a foreground job to background, persists the pending-ai draft, fires the bell, is **ownership-checked and idempotent**, and **returns `draft_id`** | `controller/recognitionController.js:278-297`; route `routes/recognitionRoutes.js:31` (`attachUser`) |
| It is itself flag-gated: 404s unless `backgroundRecognitionEnabled()` | `recognitionController.js:286-288` |
| A generic draft-create route also exists | `routes/draftRoutes.js:111` → `createDraftController` |
| The job record carries `draft_id`, surfaced on the status payload | `recognitionController.js:269` |

### What Phase 1 must do differently

Two viable routes to "detection lands in a server draft":

**(a) Detach the job.** After a foreground run completes, `POST /recognition-jobs/:id/detach` and use
the returned `draft_id`. Cheap, idempotent, already ownership-checked, and reuses the backend's own
persistence — the draft is built by `persistPendingAiDraft` from the same result the screen showed.
**Cost:** it also fires the "draft ready" bell, which is spurious when the seller is still on screen,
and it only exists for the recognition-job lane, so the direct-SSE lane still has nothing. Requires
`backgroundRecognitionEnabled()` to be on.

**(b) Create the draft from the result client-side** via `POST /drafts` (`createDraftController`) —
the mobile equivalent of the web's `seedGuestDraft` (`GBValuationPro.tsx:880-892`). Works for
**both** lanes, no spurious bell, and puts mobile on the same footing as the web.
**Cost:** mobile must map `MappedSmartDetection` → the draft/items payload, and that mapping has to
match what `listDraftItemsController` reads back.

**Recommendation: (b)**, with (a) as the fallback if the `POST /drafts` payload turns out not to
accept items in one call. **Phase 1's first task is to settle that** — read `createDraftController`
and confirm whether it accepts an items array, or whether items must be written separately.
Marked `<VERIFY>` for the Phase 1 agent, and it is the first thing it should check.

### Knock-on

- The bell. If (a) is used, suppress or delay the notification while the seller is on screen.
- `backgroundRecognitionEnabled()` gates both the detach route and mobile's job lane — confirm its
  env var is set wherever Phase 1 is tested, or the lane silently falls back.

## Decide

**D1. `analyzing.tsx` — wire or delete.** It is the best waiting screen either platform has and it
is unreachable (P4). Options: (a) make `processing-v2` render it (it already watches the
recognition-job stream, which is the lane the device took on 2026-09-23); (b) delete it and keep
`processing-v2`'s own chrome. Recommendation: **(a)**, in Phase 1, only if V2 confirms the job lane
is the default. Otherwise (b) in Phase 6 — an orphan is worse than either.

**D2. The detection chooser ("How should we list these?").** `app/scan/detection.tsx` is reached
when several products AND several images are found (`smartDetectionRouting.ts:19-28`). Its one
job is a real question. Options: (a) port it as a sheet on `items.tsx` (single lot vs. separate
items); (b) drop it and always split, letting the seller merge on Detected (the web has "Merge
into one lot"). Recommendation: **(b)** — the web never asks, and "merge" on the grid is the same
power with fewer screens. Confirm with the owner.

**D3. Currency.** The web's Valuation has a lot-level currency switcher (`xlsx-11`). Mobile's
`valuationSummary.ts` refuses to total mixed currencies by design. Keep that refusal, add the
switcher, or neither in this plan? Recommendation: keep the refusal, no switcher — scope.

**D4. The item editor's "next".** In a 10-item lot, does **Accept & next** go to the next
`needs_review` item (web behaviour) or the next in order? Recommendation: next `needs_review`; it is
what a seller is doing.

**D5. Kit reconciliation for `PrimaryAction`.** The disabled-state fix is in the tree and correct
(P17) but violates the kit rule. Decide: land it as a kit change with its own review, or revert and
re-apply under the kit owner. Not a scan-flow decision, but it blocks a clean Phase 6.

---

## ANSWERED — V2 SUPERSEDED, 2026-09-23 (second pass)

**The V2 answer above recommended option (b): create the server draft from the result client-side
via `POST /drafts`. That recommendation is WRONG and is withdrawn.** It was written from
`seedGuestDraft`'s call site (`GBValuationPro.tsx:880-892`) without opening its implementation.

`seedGuestDraft` is **not a network call**. It is `nextjs-port/src/rtk/api/guestDraftStore.ts:164`,
client-side, returning a **local integer** id. The web's `/valuation` writes **no** server item rows
at any point before sign-in; `guestDraftStore` impersonates the drafts API underneath unmodified
components. Full measurement table and the reasoning are in
`phases/phase-1-one-spine/README.md` § "REWRITTEN 2026-09-23".

**Consequence: Phase 1 needs no backend change, and neither (a) detach-the-job nor (b) `POST /drafts`
is the answer.** Mobile builds the adapter. Logged in `MISTAKES.md` (2026-09-23).

---

## ANSWERED — V3, 2026-09-23

**A photo is required to ACCEPT a row, for every item, with no document exemption. Nothing
downstream re-checks it.**

| Finding | Evidence |
|---|---|
| Accept refuses on any missing required field and opens the editor on the first gap | `ScanV2ReviewGrid.tsx:685-694`; bulk equivalent `:766-784` |
| Photos are in the required set, unconditionally | `reviewBulk.ts:1156` — `if (itemPhotoObjects(item).length === 0) missing.push("photos")` |
| …deliberately, for exactly the document case | `reviewBulk.ts:1143-1155` |
| No document exemption exists — `isOfficeUnit()` (`reviewBulk.ts:1191`) has **zero callers** repo-wide | — |
| `canSubmit` is a **feature flag, not a predicate**, passed as a bare literal `true` on `/valuation` | `ScanV2ReviewSubmitStep.tsx:80-81`; `GBValuationPro.tsx:2142` |
| The submit payload filters on **status alone** | `GBValuationPro.tsx:289`, `:435-438` |

⚠️ **The brief's premise was wrong**: the 2026-09-23 xlsx run did *not* produce text-only rows —
every row carried an embedded thumbnail, and its blockers were Operation status and Location, never
Photos. So that run is no evidence either way. Genuinely photo-less items arise only on a
100%-document upload from which the backend extracted no images (CSV, or an xlsx/PDF that yielded
nothing).

⚠️ **UNVERIFIED — is the gate on prod?** Commit `3ca6338` (2026-09-17) is absent from
`origin/101lab-main`, but that ref was last fetched 2026-09-10. Needs one `git fetch` before anyone
quotes prod.

**Decision: mobile moves its photo requirement from publish to accept, as the web does** — relax
`usePublishDraft.ts:190` and `applySmartDetection.ts:69-70` outright (a document run must reach the
grid), and re-impose "photos" as one line in a mobile `missingRequiredFields` equivalent.
**Phase 2 must NOT land the accept-side gate until the Phase 4 editor ships a working Add-photo
control for the least-privileged user** — the web already had to patch exactly this permanent dead
end (`ScanV2ReviewGrid.tsx:4699-4712`: a guest was told to "sign in again" for media they needed in
order to accept at all). Mobile has no Add-photo control on `items.tsx` today.

---

## DECIDED — D1…D5, 2026-09-23

**D1. `analyzing.tsx` → DELETE in Phase 6.** `processing-v2.tsx` is a functional **superset**: same
5-phase timeline from the same backend enum, plus it *starts* the run (`:438-446`), *stores* the job
id `analyzing` reads (`storeJobId`, `:446`), really *detaches* (`:451`, `:591`), augments photos with
document page-images (`:335-351`) and renders non-fatal rejection banners (`:305-318`).
`analyzing.tsx` can only **watch** — it never starts a run (docblock `:47-51`), and start/detach/
cancel are all `TODO(v2-writes)`. Measured: `t(` occurrences — **processing-v2: 27, analyzing: 0**;
it imports no i18n at all. Wiring it is a ~9-step port whose payoff is visual; deleting it is a
~4-line test edit (`v2Inventory.test.ts:112`, `:584`, `predetectChrome.test.ts:137-155`).
**Port its motion into `processing-v2` instead.**
⚠️ The plan's claim that "the only inbound reference is its own docblock at `:732`" was **WRONG** —
`:732` is an *outbound* `router.replace(routes.v2Camera)`, and three tests pin the file.

**D2. The detection chooser → DROP, but the plan's reason was WRONG.** The web's "Merge into one
lot" is **not** the same power: it is a server bulk op stamping a shared `lot_group_id`
(`reviewBulk.ts:190-197`, `:467-469`) — rows stay separate items sold together. The chooser's
"single" swaps the session to the AI's own `mergedSingleFields` (`scanDraftStore.ts:972-989`) — a
different title/brand/model, not a concatenation. Two conditions on the drop:
1. **Phase 1 must keep `mergedSingleFields`/`mergedSingle` alive** through the move, and port
   `grouped-review.tsx:127,135-139`'s "use as single product" collapse pill onto the detected screen.
   *(Added to Phase 1 scope.)*
2. **Phase 4's editor must absorb step 1 of the chooser** — rename an unidentified product, move a
   photo between items, delete a photo from a group (`detection.tsx:69`, `:92`, `:115`). That half
   has **no equivalent** on the web grid or on mobile's `items.tsx`, and dropping it silently would
   remove the only way to fix the AI's grouping. *(This is the chooser's real cost — it is a
   605-line two-step wizard, not one question.)*

Firing conditions, for the record (`smartDetectionRouting.ts:19-28`): `productCount > 1 &&
imageCount > 1`. **Structurally unreachable for CSV/XLSX** (`augmentedPhotos.length === 0`).

**D3. Currency → REOPENED.** `POST /:draftId/convert-currency` exists (`draftRoutes.js:167-172`).
The switcher was scoped out on the assumption it did not. Not in Phases 1–5; revisit after Phase 5.

**D4. "Accept & next" → copy the web's MECHANISM, not its pointer.** The plan called "next
`needs_review`" *"(web behaviour)"* — it is **WRONG**. `ScanV2ReviewGrid.tsx:1511-1517` is plain
`items[i+1]`, no status predicate. The behaviour emerges from **filter + sort**:
`DEFAULT_FILTER = "needs_review"` (`reviewGridUtils.ts:66`) and `DEFAULT_SORT = "confidence_asc"`,
so the walk is least-confident-first within the needs-review tab, and `settleAfterAccept`
(`:647-659`) switches tabs with a toast when it empties. Mobile has neither half — `items.tsx:188-193`
passes `filter: 'all'` deliberately and passes no `sort`. **Advance to the next row as currently
filtered and sorted; never a status-skipping pointer** (it would be wrong on an "All" tab).

**D5. `PrimaryAction` kit edit → land as a kit change in its own commit**, with both measurements in
the message (disabled label 1.23:1 → 4.96:1). Phase 6 owns it. Not both paths — do not also revert.

---

## RESOLVED — does the server honour `sort`? YES

Flagged UNVERIFIED ("a type is not a contract"). Measured 2026-09-23, `backend/helper/draftItemsQuery.js`:

- `normalizeSort(req.query.sort)` → `resolveSort(sort)` → `order`, passed to the query
  (`controller/draftItemsController.js:150`, `:153`, `:179`), with a **sort-aware keyset cursor**
  (`cursorForSort:152`, `buildKeysetWhere:160`).
- `VALID_SORTS` (`:86-91`) = `confidence_asc` (the default, `:36`), `seq`, `price_desc`, plus
  `_asc`/`_desc` for each of `COLUMN_SORT_KEYS` (`:61-68`) = `title, brand, model, year, condition,
  location` → **15 accepted values**.
- ⚠️ **`normalizeSort` fails SILENTLY** — an unknown value falls back to `DEFAULT_SORT` rather than
  erroring. The backend's own docblock flags this (`:52-54`): *"a missing key looks like a broken
  header rather than an unsupported one."* So a mobile sort control wired to a value outside those
  15 will return a plausible list and look dead. **Phase 3/4: assert the returned ORDER changed,
  never that the control changed.**

---

## ANSWERED — V4, 2026-09-23. **The table's own answer was wrong.**

The V4 row says *"grep shows callers only in `valuation.tsx:216`, `submit.tsx:205`"*. Re-measured
(`grep -rn "openDetectedItem" app src`):

| Caller | Line |
|---|---|
| `app/v2/scan/items.tsx` | **`:248`** — a third caller the row omits |
| `app/v2/scan/valuation.tsx` | `:77` (not `:216`) |
| `app/v2/scan/submit.tsx` | `:78` (not `:205`) |

Definition at `src/features/v2/scan/openDetectedItem.ts:189`.

**So yes — a caller must survive, and it is the important one.** `items.tsx:248` is the row-tap →
editor path, i.e. precisely what Phase 4 replaces. Phase 4's editor must serve **all three** entry
points (grid row tap, valuation row tap, submit's recovery control), not just the two the plan
listed, and Phase 6 cannot delete `openDetectedItem` until all three are repointed.

⚠️ **Stale comment to fix in Phase 4:** `src/features/v2/scan/review/spine.ts:143` claims
*"`openDetectedItem` (the v2 route in) is not called from anywhere yet"*. It has three callers.

## Exit criteria

✅ All four V-rows have a dated measurement (V1; V2 + its supersession; V3; V4 — the last two each
overturned the row's own stated answer).
✅ All five D-rows have a decision. Phase 1 has begun.

**Standing note for every later phase:** four of this file's original premises (V2's recommendation,
V3's "text-only rows", D2's merge-equivalence, D4's "web behaviour", V4's caller list) were wrong on
facts none of them had grepped. Treat a row in a plan doc as a claim to re-measure, never as an
input — `CLAUDE.md` § "read before you run": plan docs are not evidence.

---

## ⚠️ CORRECTION — the bulk-op finding above is WRONG (measured 2026-09-23)

The V1 section states:

> The bulk route's op vocabulary is **not** a general field-applier … the only field-setting op
> found in the controller is `set_category` … So **"Apply to selected" for Location / Operation
> status cannot be one bulk call today.** Phase 3 must either (a) fan out N `PATCH` calls … **(a)
> needs no backend change and is the recommendation**.

**That is false.** It was derived from the MOBILE client's type (`draftItemsApi.ts:80`,
`type DraftItemBulkOp = 'accept' | 'discard'`) — which describes what mobile currently sends, not
what the server accepts — plus one grep of the controller.

`VALID_BULK_OPS` (`backend/helper/draftItemsQuery.js:1092-1124`) is **14 ops**:

| Always on (10) | Flag-gated (4) |
|---|---|
| `set_location` · `set_condition` · `set_country` · `set_marketplace` · `set_currency` · `accept` · `unaccept` · `discard` · `delete` · `merge_to_lot` | `split_lot` (`SCANV2_SPLIT_LOT`) · `set_route` (`SCANV2_ITEM_ROUTE`) · `reset_price` (rides `SCANV2_ITEM_ROUTE`) · `set_category` (`SCANV2_SET_CATEGORY`) |

All four flags **default OFF** and none is set in the local `.env` (which has only
`SCANV2_DURABLE_PUBLISH`, `_SCRAP_LOT`, `_REVIEW_SCALE`, `_RESUMABLE_UPLOAD`, `_DURABLE_EXTRACT`,
`_INSPECTION`). So on dev right now the **ten unflagged ops are available and the four are not.**

### What this changes for Phase 3

- **"Apply to selected" IS one bulk call.** Location → `set_location`, Condition → `set_condition`,
  Marketplace → `set_marketplace`, Country → `set_country`. No PATCH fan-out, no per-row
  `expected_row_version`, no partial-failure/409 handling. The recommendation above is withdrawn.
- **`merge_to_lot` is available unflagged** — the web's "Merge into one lot" ports directly.
  ⚠️ It **rejects a mixed-marketplace selection with 400 before stamping**
  (`controller/draftItemsController.js:363`), so the UI must handle that refusal.
- **`unaccept` exists** — the web has no visible un-accept; mobile can offer it. Its docblock gives
  the reason: *"an accept that cannot be taken back is why sellers review slowly."*
- **`split_lot` is NOT available** (flag off), so merge is one-way on dev. Do not build an undo for
  it without turning the flag on first.
- **`set_category` is NOT available** on dev, despite being the one op the earlier note found.

### Also verified in the same pass

- **Search works:** `?q=` → `buildQCondition` (`draftItemsController.js:158`, `:212`), capped at
  `MAX_Q_LEN`.
- **Filters (6):** `needs_review` (default) · `accepted` · `discarded` · `high_value` · `scrap` ·
  `all` (`draftItemsQuery.js:38-45`).
- **Sort (15):** `confidence_asc` (default) · `seq` · `price_desc` · `_asc`/`_desc` for
  `title, brand, model, year, condition, location`.
- ⚠️ **`normalizeFilter` and `normalizeSort` BOTH fail silently** to their default on an unknown
  value (`:398-404`). A mis-wired filter or sort control returns a plausible list and looks dead
  rather than erroring. **Assert the returned SET or ORDER changed — never that the control
  changed.**

**Root cause of the original error, for the log:** a client-side TypeScript union was read as the
server's contract. `CLAUDE.md` § "A TYPE IS NOT A CONTRACT" says exactly this, and it was the
mobile type that misled. Curl the endpoint, or read the server's own vocabulary list.
