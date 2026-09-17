# Multi-marketplace unlock — integration plan across the five phases

**Author:** CTO · **Date:** 2026-08-18 · **Status:** answers "can we start?", then hands off
**Inputs:** `PHASE_1_SERVER_ROUTING_TRUTH.md`, `PHASE_2_SERVER_STOP_GUESSING.md`,
`PHASE_3_APP_CATEGORY_AND_RECYCLE.md`, `PHASE_4_APP_UNLOCK_AND_ROUTING.md`,
`PHASE_5_APP_HONESTY_AND_FORMS.md`, `../MULTI_MARKETPLACE_PLAN.md`, `../SCAN_FLOW_BACKEND.md`,
`../SCAN_FLOW_UX.md`, `../../../UX_DESIGN_RULES.md`

**This document changed no code.** Every `file:line` below was opened today; §9 lists what I verified
myself, what I re-measured, and what I did not.

---

## 0. Verdict

**Yes — the five compose into one safe sequence, and we start tomorrow morning with two engineers on
Phase 1 (server) and Phase 5 (app). Phase 2 and Phase 4 both need a short revision pass before
hand-off, and both sit third and fourth in the order, so neither blocks day one.**

The five phases are individually strong — I checked 60+ of their citations and every drift register is
accurate. What none of them could see is each other. Composing them surfaced **seven couplings that no
phase document records**, and four of those would have shipped a defect:

| # | What composition breaks | Severity |
|---|---|---|
| **C4** | Phase 5 un-disables the single-mode Submit; Phase 4's routing gate then does nothing on the single-item path | ships an unconfirmed marketplace |
| **C5** | Phase 1 and Phase 2 both rewrite `normalizeDetectedSiteType`, `detectSiteTypeForGroup` and `resolveSiteTypeForGroup` with **incompatible** bodies and return shapes | second phase silently reverts the first. **Updated 2026-08-19:** Phase 1 has landed; C5 now also carries the register of **14 assertions across 11 tests in 2 suites** that Phase 2 must knowingly change, and C5's own line numbers are superseded by Phase 2 §1.2b |
| **C6** | `category_source` enum: server emits `'ai'`, app types `'llm'` | a lie in the type system |
| **C7** | `MARKETPLACE_OPTIONS` third field: Phase 4 adds `hintKey`+`hint`, Phase 5 adds `description`, different i18n namespaces, different copy, both ×6 locales | duplicate strings on one screen |

Plus one number the owner should see before approving anything: I measured the v1 ask-trigger myself
over the recorded DEV runs — **`needs_clearer_photo` is true on 27 of 72 products (37.5%)**, perfectly
stable per photo (0 or 3 of 3 runs), and concentrated on **machines (M2–M5) and recycle (R1–R4)**. The
"we're not sure where this belongs" state is not an edge case. It is roughly 4 items in 10, on exactly
the two marketplaces whose category trees are worst. That is a product decision (Decision 4), not a bug.

---

## 1. The execution order

Two tracks, fully parallel. **Serial within each track** — both tracks contain phases that rewrite the
same functions as their predecessor.

```
SERVER engineer                          APP engineer
──────────────────────────────────       ──────────────────────────────────
Phase 1   S0-1, S0-2                     Phase 5   M-5, M-7, M-8, M-9, M-10, M-11
   ↓  measure on dev (G1–G6)                ↓
Phase 2   S0-3a/3b, S0-4, S0-5           Phase 3   M-1, M-2
   ↓  measure on dev (G7–G10)               ↓
Phase 4-server  M-12 route + env var     Phase 4-app  M-3, M-4, M-6, M-12 client
   ↓                                        ↓
   └──────────── owner approval ────────────┘
                       ↓
          prod: S0-* → measure → M-12 route → 1.0.4 binary
```

### Why this order and not another

**Server: Phase 1 → Phase 2, never the reverse.**
- They collide textually and semantically on three functions (C5). Phase 2 already contains the
  merge instruction (*"before writing Step 14, `grep -n "site_type_source"` — if S0-2 already landed,
  merge into its field and enum"*). Phase 1 contains no equivalent instruction for the reverse
  direction, so Phase-2-first would require an unwritten merge.
- Routing accuracy is the headline metric for both, and Phase 2's own acceptance note admits its
  changes **can legitimately move routing**. Measure them serially or you cannot attribute the delta.
- Phase 1 removes the single worst deterministic error class (centrifuge → GPU Accelerator).
  Labelling a known bug before fixing it is the wrong way round.

**App: Phase 5 → Phase 3 → Phase 4.**
- Phase 5 has **zero** upstream dependencies (its own §10: "nothing blocking"), it is the only app
  phase that came back effectively ready, and its M-7 is a stated prerequisite for Phase 4's M-4
  (`marketplace: z.enum([...])`, `schema.ts:57` — verified — taking AI input is the first realistic
  way to recreate an invisible Submit blocker).
- Phase 5 before Phase 3 keeps the diffs one-directional: Phase 5's edit to
  `CategoryConditionCard.tsx:203` is **one line**; Phase 3 rewrites 190 lines of the same file. The
  small edit lands first and the big rewrite carries it forward (verify with one grep, §3).
- Phase 3 before Phase 4 is Phase 4's own before-merge table: M-1 (the recycle tree) and M-2 (the
  searchable picker). Phase 3 also lands three additive `Sheet.tsx` fixes — including
  `keyboardShouldPersistTaps="handled"` on `Sheet.tsx:120`, which I confirmed is absent today — that
  Phase 4's `MarketplaceSheet` inherits for free.
- Phase 4 last because it is the only phase a **seller can see**. Everything else must be true first.

**Phase 4's server half goes to the SERVER engineer, not the app engineer.** Phase 4 needs one new
controller, one new route and one line in `app.js` on the dev host. Two engineers writing the same
backend tree — which holds eight files of other people's uncommitted work — is how that work gets
lost. Sequence it after Phase 2 on the same backend branch.

### What can run in parallel

- The two tracks: yes, completely. No app file is touched by Phase 1 or Phase 2; no backend file is
  touched by Phase 3 or Phase 5.
- Within the app track: Phase 3's **M-1** (`fetchCategories.ts` only — 165 lines, no shared file with
  Phase 5) could be pulled forward and interleaved with Phase 5 if a second app engineer appears.
  M-2 cannot: it rewrites `CategoryConditionCard.tsx`, which Phase 5 also touches.
- **Not parallel, physically:** `GreenBridgeApp/.env`. It is one file on one machine and all five
  phases want it pointed at dev. See §2 C9.

### Day-one assignment

| Engineer | Day 1, morning | Day 1, afternoon |
|---|---|---|
| **SERVER** | Phase 1 §1.3 anchor re-verify; §2.1–§2.3 "prove the bug" (overwrite the two stale scratchpad scripts, rewrite `set2.json` to 15 rows, `rawkeys.mjs` on N1, `run2.mjs "" p1_before_{1,2,3}.json`, both offline replays). No source edit. | Phase 1 §3 — S0-1 (`services/smartExtractionValidator.js` only) + `__tests__/inferSiteTypeNarrowing.test.js`. Run the suite **before** the edit (must fail), then after (**21** tests, not 25). Re-run both replays and require the BEFORE/AFTER columns to converge. |
| **APP** | Phase 5 S0 baselines, then **S1** — the emulator keyboard observation. Do it first: it is the only step that needs a booted emulator early and it decides the branch in S11 *and* S18. Record (a) or (b) with the screenshot. | Phase 5 S2 (`requiredRowLabels.ts`, point `HubRow` at it) and S3 (the failing `requiredStatusGap.test.ts`). |
| **OWNER** | Answer the nine decisions in §7. | — |

---

## 2. The hard couplings

A coupling that is not written down is a coupling that will be violated. Fourteen of them. **C4–C7 and
C9–C13 appear in no phase document.**

### C1 — Phase 2's blank category must not reach prod before Phase 3's M-2 is in a shipped build
*(recorded in Phase 2 §0.1; restated because it is the programme's biggest self-inflicted risk)*

`categoryId: z.string().min(1, 'Category is required')` — verified verbatim at
`src/features/scanner/schema.ts:23`. An empty category is a **hard submit-blocker** in the app that is
in the store today, and today's picker is two stacked 240 px nested scrollers with no search (verified:
`CategoryConditionCard.tsx:212` and `:268` both `maxHeight: 240` + `nestedScrollEnabled`), with 38 of
101lab's 62 leaves under one parent.

**Enforcement:** `SMART_CATEGORY_UNRESOLVED` = `1` on dev, **absent** on prod. Flipping it is a
`pm2 restart`, no deploy. `__tests__/smartCategoryUnresolvedFlagOff.test.js` (Phase 2 §4.4 / 10g') is
the proof and a red there means the branch does not go anywhere prod can reach.

### C2 — `101recycle` must not enter `MOBILE_SUPPORTED_MARKETPLACES` before M-1 ships in the binary

Re-measured on dev today: recycle ids **1147–5366** (37 rows, no `id` key, no `subcategories` key),
lab ids **5371–5849** (66 ids), **overlap 0**. Every AI recycle category id fails
`CategoryConditionCard.tsx:124`, is cleared at `:157`, and then `schema.ts:23` blocks Submit
permanently. **Enforcement:** server env var, one line. In my order M-1 lands before Phase 4, so
recycle *can* be included — but only after G18 passes on dev **and** one on-device recycle scan reaches
submit-ready.

### C3 — Phase 5's M-7 before Phase 4's M-4
`schema.ts:57` is `marketplace: z.enum(['101lab','101machine','101recycle','101it'])` (verified). M-4
is what lets the AI write that field. Before M-7, an unrecognised value produces a draft that fails
`detailSchema` on a field with **no checklist row** (verified: `requiredStatus.ts:42-61` — `rowForPath`
returns `null` for `marketplace`) and therefore no on-screen explanation. **Enforcement:** order.

### C4 — ⚠ NEW. Phase 5 silently disables Phase 4's routing gate on the single-item path

Phase 4 Step 9-5 item 3 gates the footer with `allRequired={required.allComplete && isRoutingResolved(draft)}`.
Phase 5 S9 changes the single-mode Submit to `disabled={!!submitting}` — `allRequired` then feeds only
the **grouped-mode** buttons. Verified today: `DetailFooter.tsx:117` is `disabled={!allRequired && canPublish}`
and Phase 5 replaces exactly that. So after Phase 5 lands:

- single-mode Submit is gated by `handleSubmit(onValid, onInvalid)` + `detailSchema`;
- `marketplaceConfirmed` is a **draft** field (`scanDraftStore.ts` `DraftItem`), not a `detailSchema`
  field, so `handleSubmit` cannot see it and `onInvalid` can never fire for it;
- an item with `marketplaceConfirmed: false` submits.

Phase 5 §10.1 flags the collision and prescribes "express it as a visible required row". That is the
right instinct but it does not work as written either: `getRequiredStatus(values, photoCount)` is
called with **form values only** (verified `app/scan/detail.tsx:109`), and `marketplaceConfirmed` is not
in the form.

**Enforcement — the minimum, and it is small.** In `useDetailController.ts`, beside Phase 5's
`missingPhotos()` guard:

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

and in `submitSingleValidated`, as the first two statements:

```ts
    if (missingPhotos()) return;
    if (missingRouting()) return;
```

`Alert` and `haptics` are already imported in that file (verified `useDetailController.ts:2` and `:16`),
and `haptics.error` exists (`src/lib/haptics.ts:75`). Only `isRoutingResolved` is a new import.

**The fuller option, if the owner wants the footer chip too:** make routing an eighth `REQUIRED_ROWS`
entry. That requires `getRequiredStatus` to take the draft, which changes a signature
`grouped-review.tsx` also calls. Defer it unless Decision 4 says otherwise; the guard above is the
correctness fix.

**Gate:** G17.

### C5 — ⚠ NEW. Phase 1 and Phase 2 rewrite the same three backend functions incompatibly

Verified in the working tree at `aabac85` (`controller/wordPressSmart.js` = 3411 lines,
`services/smartExtractionValidator.js` = 304 lines).

> **⏱ LINE NUMBERS IN THIS SECTION ARE STALE (recorded 2026-08-19).** Phase 1 has since landed three
> commits (`eb073fb`, `8383b62`, `aa0635b`) plus a test-only `742d359`. `controller/wordPressSmart.js`
> is now 3581 committed / 3589 working-tree lines and `services/smartExtractionValidator.js` is 357.
> Every `file:line` below has moved. **The re-derived anchor table is Phase 2 §1.2b** — use that, not
> these. The merged *bodies* below are unaffected and still authoritative; only the anchors moved.
> Two rows of the status table are also now out of date: `resolveSiteTypeForGroup` and
> `processProductGroup` are further along than described (Phase 1 shipped `buildRoutingSignal` and both
> stamps) — Phase 2 §1.2d(iv) has the current statement.

| Function | Phase 1 | Phase 2 | Verdict |
|---|---|---|---|
| `normalizeDetectedSiteType` (`smartExtractionValidator.js:282-304`) | keeps the `<0.6 → recycle` rewrite; adds `detectedSiteType` + `lowConfidence` | **removes** the rewrite (keeps the real guess); adds `source` | **direct semantic conflict** |
| `detectSiteTypeForGroup` catch (`wordPressSmart.js:1604-1640`) | returns `siteType:'recycle', confidence:0, lowConfidence:true` | returns `siteType:null, confidence:0, source:LOW_CONFIDENCE_FALLBACK` | conflict |
| `resolveSiteTypeForGroup` (`:1657-1688`) | whole body replaced → `{siteType, suggested_terms, confidence, source}` | whole body replaced → `{siteType, suggested_terms, source}` (no `confidence`) | conflict |
| `processProductGroup` destructure / override / stamp (`:1930`, `:1942`, `:2010`) | via the pure `buildRoutingSignal` | via a local `siteTypeSource` variable | conflict |

Whoever lands second wins. If Phase 2 lands second and follows its own text literally, it **drops
`site_type_confidence` from the wire** and reverts S0-2.

**Enforcement — the merged shapes. Phase 2's implementer writes these instead of its Step 15 / 16a /
16b / 16c bodies.**

`services/smartExtractionValidator.js` — one function, both phases' contracts:

```js
export function normalizeDetectedSiteType(parsed) {
  const suggested_terms = {};
  const rawType = parsed.site_type;
  const siteType = normalizeSiteType(rawType, "");
  const confidence =
    typeof parsed.site_type_confidence === "number"
      ? Math.min(1, Math.max(0, parsed.site_type_confidence))
      : 0.75;

  // Off-list / unmappable: nothing to preserve. `recycle` stays as the
  // operational tree key, LABELLED so the client asks (S0-3b), and confidence
  // is 0 because a named-but-unknown type is evidence of nothing (S0-3b).
  if (!ALLOWED_SITE_TYPES.has(siteType)) {
    if (rawType) suggested_terms.site_type = [String(rawType)];
    return {
      siteType: "recycle",
      confidence: 0,
      suggested_terms,
      detectedSiteType: null,           // S0-2
      lowConfidence: true,              // S0-2
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK, // S0-3b
    };
  }

  // Low confidence: KEEP the real guess (S0-3b — this is the whole point) and
  // label it (S0-2 + S0-3b). `recycle` no longer means "we were unsure".
  if (confidence < SITE_TYPE_LOW_CONFIDENCE) {
    suggested_terms.site_type = [siteType];
    return {
      siteType,
      confidence,
      suggested_terms,
      detectedSiteType: siteType,
      lowConfidence: true,
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK,
    };
  }

  return {
    siteType,
    confidence,
    suggested_terms,
    detectedSiteType: siteType,
    lowConfidence: false,
    source: SITE_TYPE_SOURCE.VISION,
  };
}
```

`detectSiteTypeForGroup` — Phase 2's `null` (so the hint can win) plus Phase 1's flag:

```js
  } catch (err) {
    console.warn("detectSiteTypeForGroup failed:", err.message);
    return {
      siteType: null,
      suggested_terms: {},
      confidence: 0,
      lowConfidence: true,
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK,
    };
  }
```

and its success return adds `lowConfidence: normalized.lowConfidence === true` and
`source: normalized.source` beside Phase 1's raw-confidence passthrough.

`resolveSiteTypeForGroup` — Phase 2's null-handling with Phase 1's `confidence` on the wire:

```js
async function resolveSiteTypeForGroup(materializedSubset, language, detectionHint) {
  const hinted = resolveSiteTypeFromHintOnly(detectionHint);
  if (hinted && hinted.confidence >= SITE_HINT_SKIP_VISION_MIN_CONF) {
    return {
      siteType: hinted.siteType,
      suggested_terms: hinted.suggested_terms,
      confidence: hinted.confidence,
      source: hinted.lowConfidence
        ? SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK
        : SITE_TYPE_SOURCE.HINT,
    };
  }

  const fromVision = await detectSiteTypeForGroup(materializedSubset, language);
  let siteType = fromVision.siteType;
  let confidence = fromVision.confidence;
  let lowConfidence = fromVision.lowConfidence === true;
  let source = fromVision.source || SITE_TYPE_SOURCE.VISION;
  const suggested_terms = { ...(fromVision.suggested_terms || {}) };

  if (detectionHint?.site_type) {
    const fromDetection = normalizeSiteType(detectionHint.site_type, "");
    if (fromDetection && ALLOWED_SITE_TYPES.has(fromDetection)) {
      const detConf =
        typeof detectionHint.site_type_confidence === "number"
          ? detectionHint.site_type_confidence
          : 0.85;
      // `siteType == null ||` is S0-3b's addition: a thrown vision call must not
      // lose the contest against its own confidence of 0.
      if (siteType == null || detConf >= fromVision.confidence) {
        siteType = fromDetection;
        confidence = detConf;
        lowConfidence =
          detectionHint.site_type_low_confidence === true ||
          detConf < SITE_TYPE_LOW_CONFIDENCE;
        source = SITE_TYPE_SOURCE.HINT;
      }
    }
  }

  if (siteType == null) {
    // Vision threw AND there was no usable hint. `recycle` is the operational
    // tree key of last resort; the label says it is a guess.
    siteType = "recycle";
    confidence = 0;
    lowConfidence = true;
  }
  if (lowConfidence) source = SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK;

  return { siteType, suggested_terms, confidence, source };
}
```

`processProductGroup`: **Phase 1's `buildRoutingSignal` is the single seam. Delete Phase 2's local
`siteTypeSource` variable entirely** and stamp from the signal:

```js
  data.site_type = siteType;
  data.site_type_confidence = routingSignal.site_type_confidence;
  data.site_type_source = routingSignal.site_type_source;
  // (S0-3a's category_source stamp from Phase 2 Step 11 stays exactly as written.)
```

**Two of Phase 1's own test assertions must change when Phase 2 lands.** In
`__tests__/siteTypeRoutingSignal.test.js`:
- `"confidence < 0.6 rewrites to recycle, flags it, and keeps the real answer"` → the site type is now
  **`machines`**, not `recycle`. Rename it and assert `siteType === 'machines'`, `lowConfidence === true`,
  `confidence === 0.42`.
- `"an off-list type is a fallback even at high confidence"` → `out.confidence` is now **`0`**, not
  `0.95`.

Both are legitimate contract changes owned by Phase 2, not regressions. Write them into Phase 2's PR.

#### ⚠ CORRECTED 2026-08-19 — it is **14 assertions across 11 tests**, in **two** suites, not two assertions

The paragraph this replaces said *"two of Phase 1's own test assertions must change"*. That was written
before `__tests__/siteTypeRoutingWire.test.js` existed. Phase 1's final commit (`aa0635b`) added it —
20 tests that pin the `<0.6 → recycle` semantics **at the endpoint level** (`runSmartDetection`'s
`products[].data` and `merged_single`, plus `smartDetectProductsV2`'s SSE `product` / `result` events).
**Nine** of them change meaning under S0-3b, in **twelve** assertions. They *should* change — S0-3b is
the decision to stop `recycle` being the silent bucket — but until now nobody had enumerated them, so
Phase 2's implementer would have met nine red tests with no way to separate an intended contract
change from a bug they had just introduced.

Also note: Phase 2's Step 2 / Step 27 `git add` lists did not include either Phase 1 suite. Both are
now on them. Leaving them off means the assertion edits are never committed — green locally, red for
the next clone.

**Measured, not predicted.** On 2026-08-19 the three merged bodies above (§5.2b-1 / -2 / -3) were
applied to the backend tree at `aa0635b` (bare literals and `0.6` standing in for the not-yet-exported
`SITE_TYPE_SOURCE` / `SITE_TYPE_LOW_CONFIDENCE`), the suites were run, and both source files were then
restored byte-exact:

- `__tests__/siteTypeRoutingWire.test.js` → **9 failed / 11 passed / 20 total**
- `__tests__/siteTypeRoutingSignal.test.js` → **2 failed / 17 passed / 19 total**

**Suite A — `__tests__/siteTypeRoutingSignal.test.js` (2 assertions, unchanged from the original note):**

| Test | Today | After S0-3b | Why deliberate |
|---|---|---|---|
| *confidence < 0.6 rewrites to recycle, flags it, and keeps the real answer* | `out.siteType === 'recycle'` | **`'machines'`** | S0-3b keeps the real guess instead of rewriting it. **Rename the test** — its title asserts the old behaviour. Also assert `lowConfidence === true`, `confidence === 0.42`. |
| *an off-list type is a fallback even at high confidence* | `out.confidence === 0.95` | **`0`** | A named-but-unknown type is evidence of nothing, so §5.2b-1 returns `confidence: 0`. |

**Suite B — `__tests__/siteTypeRoutingWire.test.js` (12 assertions across 9 tests). Full reasoning per
row lives in Phase 2 §5.2b-5b; this is the register.**

| # | Test | Line | Today | After S0-3b | Why deliberate |
|---|---|---|---|---|---|
| 1 | *vision below 0.6: the recycle bucket is labelled, not passed off as a decision* | `:266` | `data.site_type === 'recycle'` | **`'LabGreenbidz'`** | The `<0.6` branch stops rewriting the guess, so the wire carries the real marketplace *labelled* `low_confidence_fallback` at 0.45. This is S0-3b's whole purpose. Rename the test. |
| 2a | *an off-list site_type at high confidence is a fallback, never a confident 'hint'* | `:296` | `site_type_confidence === 0.5` | **`0`** | Off-list confidence becomes 0, so `buildRoutingSignal`'s `<= 0.5` cap has nothing left to cap. |
| 2b | (same test) | `:297` | `callsTo('siteType') === 0` | **`1`** | A hint at confidence 0 can no longer clear the 0.92 hint-skip gate, so the per-group vision pass now runs. Intended consequence of §5.2b-1; see the vision-skip decision in Phase 1 §13.5. |
| 3 | *the vision pass failing outright still ships an honest, low signal* | `:316` | `site_type_confidence === 0.5` | **`0`** | Vision returns `siteType: null` and §5.2b-3's new `if (siteType == null)` block sets `confidence = 0`. 0 is the honest number when nothing was identified. |
| 4 | *the model returning NO products array keeps the flag: one normalization, one truth* | `:343` | `site_type_confidence === 0.5` | **`0`** | Same cause, via `runDetectionPass`'s synthetic-product path. The test's point — one normalization, flag preserved — still holds. |
| 5 | *empty-products fallback also carries the low-confidence flag* | `:398` | `merged_single.site_type_confidence === 0.5` | **`0`** | Same cause, on the batch fallback. |
| 6a | v2 — *v2's per-group hint carries the low-confidence flag too* | `:496` | `site_type_confidence === 0.5` | **`0`** | Same as 2a, through the other endpoint. |
| 6b | (same test) | `:497` | `callsTo('siteType') === 0` | **`1`** | Same as 2b. **Change 2 and 6 together** — this pair is the only guard on the two endpoints publishing the same contract. |
| 7a | *wired: two same-label groups merged inside runDetectionPass keep the flag* | `:609` | `site_type_confidence === 0.95` | **`0.65`** | ⚠ **Fixture change, not a number change** — see below. |
| 7b | (same test) | `:610` | `site_type_low_confidence === true` | **`false`** | ⚠ same. |
| 8 | *each product carries site_type_low_confidence + site_type_detected* | `:694` | `b.site_type === 'recycle'` | **`'machines'`** | The `<0.6` branch at the per-product stamp. `site_type_detected` now agrees with `site_type` instead of contradicting it. |
| 9 | *the batch-level site-type confidence and flag leave the function* | `:717` | `detection.siteConfidence === 0.88` | **`0`** | Off-list → 0. **Most likely of the twelve to be mistaken for broken plumbing** — `siteConfidence` is the field Phase 1 added to stop confidences being mislabelled. Put the reason in the diff comment. |

**⚠ Row 7 is a behaviour change S0-3b's own text never states.** The test merges group **a**
(`recycle`@0.65, a genuine recycle) with group **b** (off-list `electronics`@0.95). Under S0-3b, b's
confidence becomes **0**, and `mergeTwoDetectionGroups` (`controller/wordPressSmart.js:971-993`) copies
the source's site keys only when `source.site_type_confidence` is **truthy** and greater than the
target's. `0` is falsy, so **an off-list group can no longer win a merge at all**. Arguably right, but
it is a side effect of §5.2b-1, not a stated decision. Merely swapping `0.95 → 0.65` and
`true → false` makes the test green while **deleting its coverage** — there would no longer be a
winner whose honesty flags could travel. **Change the fixture instead** (e.g. make group b
`recycle`@0.95, an ALLOWED type whose confidence §5.2b-1 leaves alone) and add a second case pinning
the new "confidence 0 loses the merge" fact.

**The eleven tests in Suite B that MUST stay green.** If any goes red, that is a regression, not a
contract change. Notably: *THE CONTRACT ITSELF (both fields reach `products[].data` and
`merged_single`)*; *a regex override ships `regex_override` at <= 0.5* (red here usually means the
`"low_confidence_fallback"` **comparison** at `:2012` was missed in the C13 enum swap, so the cap
silently stopped firing); *`resolveSiteTypeForGroup` reports source `low_confidence_fallback` at
confidence 0* (stays green **by construction** of §5.2b-3's `if (siteType == null)` block — red here
means that block is wrong); and **empty-products fallback uses the SITE-TYPE confidence, not the
how-many-products one** (contract rule 1 plus the vision-skip decision — the ALLOWED-type ≥ 0.92 case
must keep skipping vision after Phase 2 lands).

All 14 are legitimate contract changes owned by Phase 2. Write every one into Phase 2's PR body with
its reason. **Do not delete or `.skip` any of them.**

### C6 — ⚠ NEW. `category_source` enum disagrees between server and app

- Phase 2 §4.2 and §9.1 emit `'ai' | 'fuzzy' | 'unresolved'`.
- Phase 4 Step 6-1 and §2 type `'llm' | 'fuzzy' | 'default_parent' | 'unresolved'`.

So the app's type excludes the value the server actually sends (`'ai'`) and declares two the server can
never send. Runtime is survivable — `data.category_source ?? null` passes `'ai'` through and
`deriveRoutingState` only tests `!== 'unresolved'` — but the type is a lie, and `'default_parent'` is
*unreachable by construction* once Phase 2 gates the default substitution.

**Enforcement (Decision 2):** one enum, the server's. In `smartDetectionTypes.ts`:
`category_source?: 'ai' | 'fuzzy' | 'unresolved';` and in `routingState.ts`:
`export type CategorySource = 'ai' | 'fuzzy' | 'unresolved';`. No other Phase 4 change.

### C7 — ⚠ NEW. `MARKETPLACE_OPTIONS` third field, claimed exclusively by two phases

Verified today at `src/features/scanner/constants.ts:40-48`: the type is `{value; label}[]` with **no**
third field, and the four entries are `:44-47`.

- **Phase 4 Step 9-1** replaces it with `{value, label, hintKey, hint}`, keys
  `mobile.detail.marketplaceHint.{lab,machine,it,recycle}`, copy *"Lab and analytical equipment —
  buyers are labs, universities and research sites"*. Says *"M-10 must not add it again."*
- **Phase 5 S16** replaces it with `{value, label, description}`, keys
  `mobile.detail.marketplaceOption.<value>.description`, copy *"Lab & scientific equipment"*. Says M-3
  consumes `description`.

Two field names, two key namespaces, two copies, both ×6 locale files. Confirmed neither key exists
today (`mobile.detail.routing`, `marketplaceHint`, `marketplaceOption` all absent from `en.json`).

**Enforcement (Decision 3):** **Phase 5 wins.** Field `description`, key
`mobile.detail.marketplaceOption.<value>.description`, Phase 5's copy — because Phase 5 already ships
all six translations *and* the only locale editor in the programme that survives the duplicate-key and
CRLF hazards. Phase 4 deletes `hintKey`/`hint` and its four `marketplaceHint.*` keys (its i18n step
drops from 18+2 to **14+2** keys), and both `MarketplaceSheet` and `RoutingChip.hintFor` read:

```ts
t(`mobile.detail.marketplaceOption.${opt.value}.description`, { defaultValue: opt.description })
```

If the short copy reads too terse in the ask state, lengthen **that key**. One string, one home.

### C8 — ⚠ NEW (measured). The ask state fires on 37.5% of products, not on an edge case

I re-ran the recorded DEV runs (`runA/B/C.json`, n = 72 products, 24 photos × 3):

```
products 72   needs_clearer_photo true 27   37.5%
per-photo true-count (of 3 runs):
  L1..L7 0   M1 0  M2 3  M3 3  M4 3  M5 3  M6 0  M7 0
  I1..I5 0   I6 3   R1 3  R2 3  R3 3  R4 3
```

Deterministic per photo (never 1 or 2 of 3) and concentrated on **machines and recycle** — the two
marketplaces Phase 4 also puts in `CATEGORY_UNTRUSTED`. So the seller experience on those two is: a
question about the marketplace *and* a category to pick by hand. That is the correct honest behaviour,
and it is also **not "one tap for the 89% the AI got right"** — it is one tap on ~63% and a
question-plus-a-category-pick on ~37%. **Enforcement:** Decision 4 and gate G4 (measure the
`site_type_source` distribution once S0-2 is on dev, so the *total* ask rate is a number before the
locks flip, not after).

### C9 — ⚠ NEW. `.env` is one file on one machine, and five phases want it

All five phases point `GreenBridgeApp/.env` at dev and all five prescribe a **different** backup path:
`scratchpad/app.env.PHASE1BACKUP`, `/c/tmp/GreenBridgeApp.env.PROD.backup.$(date)`,
`…/Temp/claude/env.backup.$(date)` + a `.LATEST` pointer, `…/env-backup-$(date).env`,
`…/env.prod.backup.$(date)`. Five conventions, one gitignored file (`.gitignore:34` — verified), and a
documented history of it being left on `localhost`.

**Enforcement:**
1. **The APP engineer owns `.env`.** The server engineer never edits it. Phase 1 §6.1 already makes the
   app optional; Phase 2's Step 29 eyeball is the app engineer's job, run once at the end of the server
   track's dev deploy.
2. **One canonical backup**, taken once and never rotated:
   `C:/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical`
   plus the already-verified pristine copy at `…/scratchpad/app.env.PRODBACKUP`.
3. `head -1 .env` must read `GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1` at the end
   of **every** working session, not every phase. Verified as its current value today.
4. Phase 3's restore proof uses an `env.backup.*` **glob**, which `grep` then prefixes with filenames —
   its `diff` can never come back clean on a second run. Use the single canonical path instead.

### C10 — ⚠ NEW. Phase 2's dev flag degrades Phase 3's on-device trap check

With `SMART_CATEGORY_UNRESOLVED=1` on dev, ~17% of scans legitimately return a blank category
(measured baseline: flat-tree first-row pick 12/72). Phase 3's on-device check **#11** — *"run an AI scan
that returns a category … the category is pre-filled. This is the trap check. If it is blank you broke
the hydrate/bridge effect"* — can therefore fail for a legitimate reason and send the engineer hunting a
hydration bug that does not exist.

**Enforcement:** run Phase 3 #11 with a photo known to resolve. From my replay, **L1–L7 all resolved a
category and all have `needs_clearer_photo: false`** — use a lab item. Alternatively set the flag to `0`
on dev for that one check and note it.

### C11 — ⚠ NEW. Three phases edit the same six locale JSONs, inside the same object

Phase 3 adds 11 keys to `mobile.detail`; Phase 4 adds 14 (after C7) to `mobile.detail` + 2 to
`mobile.reviewHub`; Phase 5 adds 7 to `mobile.detail`. Same six files, same object, three phases.

I verified the hazard myself today:

```
en.json      crlf=5290 lf=5290 dups=['close']
zh-Hans.json crlf=5262 lf=5262 dups=['close']
zh-Hant.json crlf=5262 lf=5262 dups=['close']
ja.json      crlf=5195 lf=5195 dups=['close']
th.json      crlf=5179 lf=5179 dups=['close']
vi.json      crlf=5280 lf=5280 dups=['close']
```

Every file is 100% CRLF and every file carries a duplicate `mobile.labCommon.close` key. A
`json.load`/`json.dump` round-trip destroys both. **Only Phase 5 ships an editor that survives it**
(`src/i18n/_phase5_keys.py`, text-mode, anchored on the unique `"profitIntelligence":` line — which I
confirmed is unique at `en.json:3805`). Phase 4 warns against a JSON dump; **Phase 3 does not warn at
all.**

**Enforcement:** locale edits are **serialised, one phase at a time**, all done as text insertion after
a unique anchor line, and after each phase the canary above must still print `crlf == lf` and
`dups=['close']` with the line count up by exactly the number of lines inserted. Reuse Phase 5's script
shape for Phase 3 and Phase 4.

### C12 — ⚠ NEW. One backend branch, two engineers, eight files of other people's work

Phase 2 Step 2 says `git switch -c feat/s0-3-server-stop-guessing`. Phase 4 §0.1 says *"Do not create a
branch in the backend tree — it has uncommitted work from other engineers."* Direct contradiction.

**Resolution:** `git switch -c` carries uncommitted work forward and is safe. Create **one** backend
branch on day 1 and keep all three server pieces (Phase 1, Phase 2, Phase 4's M-12 route) on it. Never
`git switch` back. Confirmed current backend state: branch `fix/seller-gate-existing-sellers` at
`aabac85`, 8 modified files (`chatController.js`, `wordPress.js`, `wordPressGroupedSubmit.js`,
`wordPressSmart.js`, `chatAccess.js`, `chatRoute.js`, `wpProductRoutes.js`, `socket/socket.js`) plus
untracked `socket/socketAuth.js`, `services/descriptionStyleRule.js` and four test files. All of it must
survive. No stash, no reset, no clean, in either tree.

### C13 — ⚠ NEW. `site_type_source` must be one field with one enum, and the ordering makes that free

Phase 1 introduces `site_type_source` with all four values and `site_type_confidence`. Phase 2
introduces `site_type_source` with the same four values and **no** confidence. Phase 2 already
instructs the grep-and-merge. With Phase 1 first, Phase 2's job is to *add branches*, not to declare the
field. **Enforcement:** Phase 2's Step 14 pre-check
(`grep -n "site_type_source" controller/wordPressSmart.js`) is mandatory, not advisory, and the enum
lives in exactly one place — `SITE_TYPE_SOURCE` in `services/smartExtractionValidator.js` (Phase 2's
export), which Phase 1's `buildRoutingSignal` then uses instead of bare strings.

### C14 — The prod sequence itself is a coupling

The app half is a **binary**; it cannot be rolled back in an afternoon. The only remote lever is M-12,
which needs its prod route and env var live first. **Enforcement — prod order, each step separately
approved:** S0-1/S0-2 → measure → S0-3b/S0-4/S0-5 → measure → M-12 route + env var (`101lab` only) →
1.0.4 in review → 1.0.4 released → widen `MOBILE_SUPPORTED_MARKETPLACES` → flip
`SMART_CATEGORY_UNRESOLVED` **last**, once M-2 is demonstrably live. Nothing in this programme
authorises any of it.

---

## 3. Conflicts — file by file

### The three files the brief named

**`src/features/scanner/mapSmartDetection.ts`** — Phase 4 (M-6 carry-through at `:188`/`:209`/`:225`,
the `siteType` → `deploymentSiteType` rename at `:152`/`:157`, the `mergedSingleFields` guard at
`:258-261`) vs Phase 5 (comment-only rewrite at `:113-116`). All verified at those exact lines today.
**~70 lines apart, no textual overlap.** Phase 5 first (its own §10 asks for this). Risk: negligible.

**`src/features/scanner/components/detail/MarketplaceCard.tsx`** — **real conflict.** Verified: 82
lines, `MARKETPLACE_LOCKED = true` at `:22`, `if (MARKETPLACE_LOCKED) return null;` at `:29`, pill row
`:39-76`, wrapper closes `:77-80`.
- Phase 4 Step 8-1 **replaces the whole file** with `export function MarketplaceCard() { return null; }`.
- Phase 5 S16 step 2 inserts a description `<Text>` between `:76` and `:77` — inside code Phase 4
  deletes. Phase 5's own verification gate **#8** (`grep -n "MARKETPLACE_LOCKED = true"` must print line
  22) becomes **permanently red** once Phase 4 lands.

**Resolution: drop Phase 5's S16 step 2 entirely.** Keep S16 steps 1 and 3 (the `constants.ts` data and
the category AI badge). The description gets exactly one home — the `Sheet.Option.description` row
inside Phase 4's `MarketplaceSheet` — which is also what Phase 5's own §10.1 reviewer note asks for
("pick one home… or the same sentence appears twice on one screen"). Phase 5's gate #8 then stays valid
for Phase 5's own PR and is deleted by Phase 4.

**`src/features/scanner/components/detail/CategoryConditionCard.tsx`** — verified 469 lines,
`watch('marketplace')` at `:46-47`, the hydration-race NOTE at `:166-169`, `FieldLabel … required` at
`:203`, the two 240 px scrollers at `:212` / `:268`.
- Phase 3 M2.3 rewrites `:1-22`, deletes `:81-90`, replaces `:178-194` and `:198-388`.
- Phase 5 S16 step 3 changes **one line**, `:203`, adding the `ai` flag.
- Phase 4 does **not** edit this file, but depends on `:46-47` surviving — and Phase 3 keeps it.

**Resolution: Phase 5 first** (1 line), Phase 3 second (190 lines) and Phase 3 carries the flag into
its new collapsed row, which contains the same `FieldLabel`. Verify after Phase 3 with:

```bash
grep -n "sectionCategory')} required ai" src/features/scanner/components/detail/CategoryConditionCard.tsx
# must print exactly one line
```

### Everything else that two or more phases touch

| File | Phases | Overlap | Resolution |
|---|---|---|---|
| `services/smartExtractionValidator.js` | 1, 2 | `normalizeDetectedSiteType` (`:282-304`) — **incompatible bodies** | C5's merged function. Phase 1 also owns `:223-230`/`:235-268` (S0-1) and Phase 2 also owns `:41` and `:190-196` — those do not overlap. |
| `controller/wordPressSmart.js` | 1, 2 | `detectSiteTypeForGroup` (`:1604`), `resolveSiteTypeForGroup` (`:1657`), `processProductGroup` destructure `:1930` / override `:1942` / stamp `:2010`, `__TEST__` (`:218`) | C5. Phase 2's Step 1 pre-flight is **mandatory** — it re-anchors against a tree Phase 1 has just changed. **2026-08-19: every number in this cell is stale** (Phase 1 landed 3 commits; the file is +170 lines) — re-derived in Phase 2 §1.2b. This file is also **dirty** with an unrelated engineer's AI-description change, `HEAD + 8` lines, one hunk of it *inside* `__TEST__` — see Phase 2 §1.2a. |
| `app/scan/detail.tsx` | 4, 5 | `:127` (chip above `IdentityCard` vs `<View onLayout>` wrapper) and `:148` (footer gate vs footer un-gating) | Phase 5 first. The chip goes **above** Phase 5's wrapper. `:148` is C4. Verified card order today: Photos `:121`, Identity `:127`, Description `:128`, Marketplace `:129`, CategoryCondition `:130`, Profit `:131`, Pricing `:132`, Checklist `:139`, Footer `:144`, `allRequired` `:148`. |
| `app/scan/grouped-review.tsx` | 4, 5 | the `missingLabel` IIFE — Phase 5 deletes the private `labelForKey` switch (verified `:542-567`) and rewrites `:568`; Phase 4 replaces the IIFE's final `return` (verified `:572-575`) | Phase 5 first; Phase 4's edit then lands on the shortened IIFE. Phase 4 also touches `:100` / `:158` / `:310-325` / `:498-514` — no overlap with Phase 5. |
| `src/features/scanner/components/detail/useDetailController.ts` | 4, 5 | Phase 4 swaps `:44-45` to `form.watch('marketplace')` and must move the `useForm` block (`:51-55`) above it; Phase 5 inserts after `:55` and edits the four `handleSubmit` calls (`:94`, `:136`, `:144`, `:152`) | Phase 5 first. Moving `useForm` upward does not disturb Phase 5's insertions. Add C4's guard in the same pass as Phase 4's edit. |
| `src/features/scanner/smartDetectionTypes.ts` | 4, 5 | `:125` (Phase 4 adds four fields after `suggestedMarketplace`) vs `:126-130` (Phase 5 comment) — **adjacent** | Phase 5 first; a 1–2 line hand-merge. |
| `src/features/scanner/constants.ts` | 4, 5 | `MARKETPLACE_OPTIONS` `:40-48` | C7. |
| `src/features/scanner/components/detail/index.ts` | 3, 4, 5 | three phases append exports (`CategoryPickerSheet`; `RoutingChip`+`MarketplaceSheet`; `RequiredProgressStrip`+`useRowScroller`) | append-only, trivial. Keep the file's convention: components alphabetical, hooks last. |
| `src/i18n/locales/*.json` (×6) | 3, 4, 5 | same `mobile.detail` object | C11. |
| `src/components/ui/Sheet.tsx` | 3 only | — | Phase 3's three changes are additive; Phase 4 and Phase 5 consume them. Phase 3 must land before Phase 4's sheet is device-tested, or G19 fails. |
| `app/scan/grouped-edit.tsx` | 4, 5 | Phase 4: `:67` + chip at `:217`. Phase 5: `KeyboardStickyView` around `:233-296` | different hunks, no conflict. Both verified today. |
| `src/features/scanner/requiredStatus.ts` | 5 only | — | Phase 4 explicitly stays out of it; C4 is why that is still correct. |
| `src/services/scanner/fetchCategories.ts` | 3 only | — | 165 lines; `endpointForMarketplace` `:24-29` (not exported today — confirmed), `flattenCategoryOptions` `:144`. |
| `app.js` + `controller/mobileConfigController.js` + `routes/mobileConfigRoute.js` | 4-server only | one mount line beside `:411` | no conflict. `GET /api/v1/mobile-config` → **404 today** (I re-confirmed), so the path is free. |

### One assumption invalidation worth naming

Phase 4's `deriveRoutingState` puts `'101machine'` and `'101recycle'` in `CATEGORY_UNTRUSTED` and
computes `prefillCategory: false` for them. That is correct **today** (machines `tree[0]` = 5300 "Boring
& Drilling Machines"; recycle ids unusable) and becomes partly obsolete once Phase 2's S0-3a and Phase
3's M-1 land — at which point the server itself says `category_source: 'unresolved'` and the recycle
tree is valid. Leave the list in place (it is the conservative answer and Phase 4's blocker (d) is about
*enforcing* the flag, not about the list), but write in the code comment that it is a **belt** whose
**braces** are `category_source`, so a future reader does not treat it as permanent policy.

---

## 4. The gates — what must be measured on dev, with numbers

Everything below is dev (`https://testapi.greenbidz.com`, DB `greenbidz_test`). **Prod is unverified
for the entire programme** and G22 is the only thing that changes that.

### Baselines I re-measured myself today, so the "after" numbers have something to be compared against

```
recorded DEV runs, n = 72 products (24 photos × 3 runs):
  routing correct                 64/72 = 89%
  site_type distribution          LabGreenbidz 18 · machines 21 · 101it 23 · recycle 10
  unresolved category             0/72
  flat-tree first-row pick        12/72 (17%)
  year === null                   19/72 (26%)
  co2_emissions === "0 kg"        40/72 (56%)
  HTML-escaped category name      3/72
  needs_clearer_photo === true    27/72 (37.5%)

live dev, read-only, today:
  GET /product/category?lang=en        200 · 37 rows · 18 escaped · ids 1147-5366 · no id/subcategories key
  GET /product/lab/category?language=en 200 · 4 parents · 66 ids · 5371-5849  (overlap with recycle = 0)
  GET /mobile-config                    404  (path free)

app tree:
  npx tsc --noEmit → exit 0, no output
  six locale files: crlf == lf, dups=['close'], lines 5290/5262/5262/5195/5179/5280
```

### Server track — after Phase 1, before Phase 2 starts

| # | Measure | Pass |
|---|---|---|
| **G1** | `infer_ba.mjs` (n=57 offline) and `scale_ba.mjs` (n=800 DEV lab listings) | false-101it **4 → 0** on n=57; **75 (9.4%) → ≤ 8 (≤ 1.0%)** on n=800, and **every residual explainable as genuinely IT hardware mis-filed into lab**. Phase 1's own restatement of the plan's "9% → ~0" to "≤ 1% with every residual explainable" is the correct gate — use it. `machines` and `recycle` buckets gain **0** new false-101it. |
| **G2** | `run2.mjs "" p1_after_{1,2,3}.json` on the 15-photo set, then `score.mjs` | N1 → `LabGreenbidz` **3/3**, and its category is **not** `Components / GPU Accelerators`. Overall routing **≥ the before number measured in the same session** (reference: 64/72 = 89%, which I reproduced). I1 and I5 still `101it` — **if I5 flips, record it**; that is S0-1's one honest cost and a product call, not something to hide. |
| **G3** | `rawkeys.mjs` on ≥ 2 photos | `site_type_confidence` present, numeric, 0–1, on **100%** of products. `site_type_source` ∈ {`hint`,`vision`,`regex_override`,`low_confidence_fallback`} on **100%**. And the contract: `source ∈ {regex_override, low_confidence_fallback} ⇒ confidence ≤ 0.5` on **100%**. Assert it in `score.mjs`; do not eyeball it. |
| **G4** | ⚠ NEW — the `site_type_source` **distribution** over 3×15 | No pass/fail threshold yet — the pass is that **the number is written down**. Escalate to the owner before any app lock flips if `regex_override + low_confidence_fallback` exceeds **20% of products**, because combined with the measured 37.5% `needs_clearer_photo` the total ask rate then clears ~50%. |
| **G5** | Web smart-upload regression on dev — `nextjs-port` **and** `admin-panel` | Review screen renders; marketplace still forced to the deployment site (`ReviewSubmitScreen.tsx:311-321`, `AdminAiUpload.tsx:155`); category empty rather than a wrong guess; no console error; **no submit**. Code-read says safe; this is the only thing that proves it. |
| **G6** | `npm test` (backend) + the two new suites | Exactly the **2** pre-existing failures (`zohoListingSyncPublished`, `uploadValidationService`) and no third. `inferSiteTypeNarrowing` **21** tests, `siteTypeRoutingSignal` **19** tests — Phase 1's own corrected counts, not the 25/20 in its earlier text. Plus the five content greps in Phase 1 §7.1 (`site_type_low_confidence` → 8, `siteLowConfidence` → 3, `buildRoutingSignal` → 3), because **neither new suite fails if the stamp is skipped.** |

### Server track — after Phase 2

| # | Measure | Pass |
|---|---|---|
| **G7** | `measure.mjs afterA.json afterB.json afterC.json` (3×24), with `run.mjs:57-66` patched to record `category_source` and `site_type_source` first | `year === null` **19 → 0**. `co2 === "0 kg"` **40 → 0**. escaped category name **3 → 0**. flat-tree first-row pick **12 → 0**. `category_source` present **0 → 72/72**. `site_type_source` present **72/72**. Unresolved category **12/72 ± 5** (17% ± 7). **> 25% means Rule B is firing wider than designed** — re-read Phase 2 §4.1 and confirm you did not implement one of the two rejected candidates (one of which blanked **69/72**). |
| **G8** | The kill switch, both halves | `smartCategoryUnresolvedFlagOff.test.js` **3 passed**, AND a live dev run with `SMART_CATEGORY_UNRESOLVED` **unset** showing unresolved category **0/24**. This is the single gate between prod and a submit-blocking regression in a shipped app. A red here stops the branch reaching anything prod can touch. |
| **G9** | `GET /product/category?lang=en` | `rows 37, escaped 0` (from my measured 37 / 18). |
| **G10** | Routing accuracy | It **may move** — S0-3b changes what `runDetectionPass` stamps per product, which feeds back as the `detectionHint`. Diff every moved product against `set.json` ground truth; **each move must be toward truth. Revert only on a move away.** Phase 2's original "if routing moves you broke something" rule is wrong and its own reviewer corrected it — do not follow the old wording. |

### App track — before the 1.0.4 build is even discussed

| # | Measure | Pass |
|---|---|---|
| **G11** | `npx tsc --noEmit` | exit 0, no output. Baseline verified by me today. |
| **G12** | `npx jest` | Baseline **92 suites / 825 tests / 22 snapshots** (reported independently by three phase authors and re-run by two reviewers; **I did not re-run it**). After all three app phases the arithmetic gives **102 suites / ~917 tests** (+3 P3, +3 P4, +4 P5). **Treat the totals as indicative and the "zero pre-existing suites red" as the gate** — phase test counts have been wrong five times in this programme (25→21, 20→19, 14→12, 12→10, 19→16, 13→14). |
| **G13** | Locale canary, after **every** locale edit | 6 files parse; `crlf == lf`; `dups == ['close']`; line count = my measured baseline + exactly the lines inserted; `git diff --stat src/i18n/locales/` shows **0 deletions**. Any deletion means a round-trip happened — revert those six files and redo as text. |
| **G14** | Cold-install first scan (Phase 4 blocker (a)) | Clear app storage, network **on**, scan an IT item. The draft either adopts `101it` or **asks**. It must not silently keep `101lab` and stamp `marketplaceConfirmed: true`. |
| **G15** | Fail-closed (Phase 4 V-8) | Clear storage, network **off**, scan. No chip at all; behaviour identical to 1.0.3. **G14 and G15 must be distinguishable** — Phase 4's cold-cache bug is invisible if you only run G15. |
| **G16** | Chip → change marketplace (Phase 4 blocker (b)) | The category clears **in the store** and does not reappear. Verified mechanism: `useDetailController.ts:58-64` runs `reset(draftToFormValues(draft))` on every change of `draft` identity, and `patch()` replaces `current` — so a patch that carries only `marketplace` restores the **old** category under the **new** marketplace, and `buildFormData.ts:161`/`:224` then submit a lab category id with `allowed_sites:['machines']`. |
| **G17** | ⚠ NEW (C4) | Single-mode Submit with `marketplaceConfirmed: false` is **refused with a named reason** — haptic + alert, no navigation, no network call. |
| **G18** | Four trees × two locales, end to end against dev (Phase 3 M1.11) | 8 rows, all HTTP 200, all `stillEscaped=0 blank=0 dupIds=0`, and the two `101recycle` rows **byte-identical in both locale blocks**. Counts are WordPress content and may move — the three zeros are the gate. |
| **G19** | Keyboard-up first tap (Phase 3 (f)) | Type `centrif`, **one** tap on the result, keyboard still up → the row commits. Verified the cause: `Sheet.tsx:120` has no `keyboardShouldPersistTaps`, so it defaults to `'never'`. **No unit test can catch this** — `fireEvent.press` bypasses the responder chain. |
| **G20** | One **mixed** grouped submit on DEV (plan gate 3) | Each product lands on the right `site_id`; the single spanning auction group renders acceptably. **This is the only write in the entire programme** and needs its own owner approval. |
| **G21** | On-device | SE-class phone + one Android with a 3-button nav bar; the Vietnamese condition pills (~2× English, `flex-wrap`); Phase 3's sheet `maxHeight: 520` on the small screen; the M-11 keyboard branch. **iOS keyboard behaviour cannot be checked on this win32 machine** — it goes to a Mac before 1.0.4. |
| **G22** | **Prod re-measurement**, read-only, same photo set (plan gate 1) | Routing **≥ 85%** with no new failure class. Prod runs a different vision-provider configuration (`IMAGE_SEARCH_VISION_PROVIDER=vertex`, `GEMINI_API_KEY` empty). **This is the single biggest open risk in the programme and it is currently unmeasured.** |

---

## 5. What is still not ready, per phase

| Phase | Verdict | What is actually open | Cost to close | Blocks the programme? |
|---|---|---|---|---|
| **1** | **READY** (its reviewer's "READY_AFTER_MY_FIX" fixes are already in the file) | The **emission itself has no unit test** — both suites pin the pure `buildRoutingSignal`, so an engineer could skip §4.7(iii) and get two green suites with the fields absent from the wire. Only G3 proves it. Six replay rows lose an override that agreed with the final answer and the artifacts cannot say whether vision alone reproduces it — G2 is the only settlement. Test counts are 21/19, not 25/20. | Nothing. Execute as written, run G3 as a gate not a courtesy. | **No — it starts day 1.** |
| **2** | **NOT_READY** | (a) The owner must confirm §4.4's reversal: `pickDefaultParent`/`pickDefaultSubcategory` stay **alive behind the flag** instead of being deleted. (b) The **flag-OFF path has never been executed against a running server** by anyone. (c) The "2 pre-existing failing suites" baseline is the task owner's figure, not re-measured. Plus C5's merged bodies must replace Steps 15/16a/16b/16c. | (a) one yes/no — **Decision 1**; (b) Step 10g' + G8, ~20 min; (c) one `npm test`, ~3 min; C5 ~1 hour of doc editing before hand-off. | **No — it is third in the order and starts day 3.** Close (a) on day 1 and it is ready when the server engineer reaches it. |
| **3** | **READY** | Two **product** decisions, not defects: accordion vs all-parents-expanded browse (Decisions 6), and `maxHeight: 520` on an SE-class screen. All 13 on-device criteria are unverified by construction. The `MARKETPLACE_LOCKED` temporary flip in M2.6 is manual discipline with no automated gate. Its locale edit needs C11's text-mode treatment, which it does not currently prescribe. | Decision 6 (one line); add the C11 note. | **No.** |
| **4** | **NOT_READY — do not hand this to an engineer as-is** | Five blockers, all named by its own reviewer and none of them discoverable from its verification section: **(a)** the M-12 supported list is empty exactly when the locks first fire (cold-cache hole — `readCachedSupported()` is only written by a hook mounted *after* `applySmartDetection` has built the draft); **(b)** React Query v5 (`^5.100.14` — I confirmed the version) treats `initialData` as fresh-with-`staleTime`, so `fetchSupportedMarketplaces()` never runs and the whole M-12 lever is inert while every test passes; **(c)** `onConfirm` patches only `marketplace`, and `useDetailController.ts:58-64`'s reset then restores the **old** category under the **new** marketplace; **(d)** `prefillCategory` is computed and never enforced; **(e)** lock 2 — the phase's headline behaviour — has **no test**, and the ask-trigger now exists in three hand-copied places. Plus **(f)** importing `supportedMarketplaces.ts` into the store drags axios + the auth/socket graph into three existing test suites, and the phase asserts they still pass without having run them. Plus C4, C6, C7. | Half a day of revision on the **document**, done in parallel with Phase 5's implementation (day 2 afternoon). Every fix is specified; none is research. | **No — it is fourth. But it must be revised before day 4.** |
| **5** | **READY** | The M-11 keyboard behaviour is unobserved until **S1**, which is why S11/S18 have two branches — do not "fix" case (b) unconditionally. **iOS is unverifiable on this machine.** S16 step 2 must be **dropped** (§3). Its `RequiredProgressStrip` chips use `minHeight: 32`, below the 44 px platform minimum, while the plan queues 40→44 px steppers as a fix in the *other* direction — a judgement call the implementer should see. | Nothing blocking; drop S16 step 2 and run S1 first. | **No — it starts day 1.** |

**Can the programme start without the two NOT_READY phases? Yes.** They are third and fourth in an
order chosen for other reasons, and both are "revise the document", not "go find out". If you would
rather not start at all until every phase is green, you lose two days of the two ready phases for no
reduction in risk.

---

## 6. The first three days, concretely

### Day 1

**SERVER**
1. `cd 101recycle-greenbidz-backend`; `git status --porcelain` (expect the 8 modified + untracked set);
   `git switch -c feat/multi-marketplace-server` — **one branch for all three server pieces** (C12).
2. Phase 1 §1.3: run the three anchor greps and
   `git diff -U0 controller/wordPressSmart.js | grep '^@@'` (expect four hunks, all < 600, so every
   S0-2 site is +8 from `main`).
3. Phase 1 §2: **overwrite** `mm/infer_ba.mjs` and `mm/scale_ba.mjs` from the document — the copies on
   disk implement an **earlier** candidate and print `8 → 8` with the `I5` rows missing. **Rewrite
   `set2.json`** to the 15-row array (`node -e "console.log(require('./set2.json').length)"` → **15**).
4. Baselines: `node rawkeys.mjs <N1 url>` (both new fields `*** ABSENT ***`);
   `node run2.mjs "" p1_before_{1,2,3}.json` (~4 min each at p50 11 s × 15); both replays. Record.
5. Phase 1 §3: S0-1. Run `inferSiteTypeNarrowing.test.js` **before** the edit (must fail on case 1),
   then after → **21 passed**, process exits without `--forceExit`. Re-run both replays; the BEFORE and
   AFTER columns must converge and `-- rows where before != after --` must print nothing.

**APP**
1. `cd GreenBridgeApp`; `git checkout -b feat/multi-marketplace-app-1.0.4`;
   `cp .env "C:/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical"` (C9), then point
   line 1 at `https://testapi.greenbidz.com/api/v1`.
2. Phase 5 S0: `npx tsc --noEmit` (exit 0 — I confirmed today), `npx jest --silent | tail -5`
   (92/825/22).
3. **Phase 5 S1 — the emulator keyboard observation.** Boot per §3.1 (`-dns-server 8.8.8.8,8.8.4.4`,
   `CI=1`), reach `app/scan/detail.tsx` with one photo, dump `ui.closed.xml` and `ui.open.xml`,
   screenshot. **Write down (a) CTA covered or (b) CTA already lifted.** S11 and S18 both branch on it
   and re-doing it later costs another emulator boot.
4. Phase 5 S2 (`requiredRowLabels.ts` + point `HubRow` at it — its private switch is at `:542-567`,
   verified) and S3 (write `requiredStatusGap.test.ts`, **watch it fail** on `parentCategoryId`,
   `customSubcategory`, the seven legacy-draft cases and `draftToFormValues repairs junk`).

**OWNER:** answer §7.

### Day 2

**SERVER**
1. Phase 1 §4 — S0-2, all seventeen sites. The two that are easiest to miss and most consequential:
   **`runSmartDetection`'s own `detectionHint` (v1, main `:2318-2321`)** — v1 is still mounted at
   `routes/wpProductRoutes.js:165-169` and the web reaches it — and **both empty-products fallbacks**
   (main `:2358`, `:3319`), which otherwise ship an unsure `recycle` as
   `source:'hint', confidence:0.85`.
2. `siteTypeRoutingSignal.test.js` → **19 passed**. Then Phase 1 §7.1's content greps
   (`site_type_low_confidence` → 8, `siteLowConfidence` → 3, `buildRoutingSignal` → 3): the suites do
   **not** catch a missing stamp.
3. Full `npm test` → exactly the 2 known failures.
4. **Ask the owner** before the dev `pm2 restart` (a deploy action; earlier approval does not carry).
   Verify port ↔ DB either side (`:6000`/`greenbidz_test`, never `:4000`/`greenbidz`).
5. After-runs ×3 + `rawkeys.mjs` ×2 + `score.mjs`. **Gates G1–G4, G6.**

**APP**
1. Phase 5 S4 (`draftToFormValues` as the coercion seam) → S5 (`requiredStatus.ts`: delete the
   duplicate projection, export `rowForPath`, map the two "Other" paths) → S3's suite green.
2. S6 → S9 (`useRowScroller`, `RequiredProgressStrip`, the `DetailFooter` wrapper/row split and the
   un-disabling).
3. S10 with **both** reviewer corrections (no `photosLabel` line; the `onInvalid` that never alerts an
   empty field list) and S11 wiring `detail.tsx` on the S1 branch.
4. **End of day, 45 min, no code:** revise `PHASE_4_APP_UNLOCK_AND_ROUTING.md` for blockers (a)–(f)
   plus C4, C6, C7, so it is hand-off-ready before anyone reaches it. Specifically: prefetch the config
   in `app/_layout.tsx` (the `QueryClientProvider` is already at `:179`) **before** the scan; swap
   `initialData` for `placeholderData: () => readCachedSupported() ?? fallbackMarketplaces()`; make
   `onConfirm` write the cleared category fields in the same store patch; decide and write down whether
   `prefillCategory` is enforced now or deferred to S0-3a; split the MMKV-only helpers out of
   `supportedMarketplaces.ts`; add the two store-level tests.

### Day 3

**SERVER**
1. Phase 1 §6.5 — the **web** regression on dev, all three consumers (`nextjs-port`,
   `GreenBridgeSeller`, `admin-panel`). Review screens only, **no submit**. **G5.**
2. Start Phase 2 with its **Step 1 pre-flight** — mandatory, because Phase 1 has just moved the tree —
   and **Step 3** (a real `npm test` baseline, closing Phase 2's open item (c)).
3. Steps 9–13, using **§4.4's 10a′–10e′** (flag-gated, helpers retained), **never** Steps 10a–10e.
   Then Step 10g′ / `smartCategoryUnresolvedFlagOff.test.js` — **G8, before the branch goes anywhere.**

**APP**
1. Phase 5 S12–S15 (tests; the profit-card rewrite — copy `:209-280` verbatim, delete the statics at
   `:18-20`/`:23` and the circular `suggestedKey` at `:153-158`, all verified today; the six stale
   "stub" comments, gated by `grep -rn "stub"`, not `"static stub"`).
2. S16 **steps 1 and 3 only** (§3: drop step 2), S17 (the text-mode locale script, then **G13**), S18.
3. S19 device pass including **row 10** (force `aiPrices={null}` at `detail.tsx:131` to see the empty
   state, then revert and prove it with a grep — the dev AI returned a scrap range on 81/81 calls, so
   `figures === null` is otherwise unreachable). Note S19 row 5's alert reads `Please add: TITLE` in
   caps — I confirmed `en.json` ships `mobile.detail.sectionTitle` as `"TITLE"`. That is parity with
   `grouped-edit.tsx`, not a bug.
4. Verification §8 and **restore `.env`** (C9).

**OWNER:** after G1–G4, decide whether Phase 1 alone goes to prod. It is a clean, additive, separately
approvable change and shipping it early starts the confidence log that v1.1's threshold needs. Not
required for the programme to continue.

---

## 7. Decisions for the owner

Nine. Each is a yes/no or a pick, each with my recommendation.

1. **Phase 2 keeps `pickDefaultParent`/`pickDefaultSubcategory` alive behind
   `SMART_CATEGORY_UNRESOLVED` instead of deleting them, reversing the phase's stated intent?**
   → **YES.** Deleting them makes flag-off *not* identical to today, and a blank category reaching the
   1.0.3 app in the store is a hard submit-blocker (`schema.ts:23`, verified). The trade is a `||` that
   a future reader might re-enable; the alternative is an unsubmittable listing.

2. **One `category_source` enum — the server's `'ai' | 'fuzzy' | 'unresolved'`, with Phase 4 dropping
   `'llm'` and `'default_parent'`?**
   → **YES.** `'default_parent'` is unreachable by construction once Phase 2 lands, and `'ai'` is what
   the server actually sends. Three values, one source of truth.

3. **One marketplace-description field — Phase 5's `description` +
   `mobile.detail.marketplaceOption.<value>.description`, with Phase 4 dropping `hintKey`/`hint` and
   `marketplaceHint.*`?**
   → **YES.** Phase 5 already ships all six translations and the only locale editor that survives the
   duplicate-key/CRLF hazard I verified today. Lengthen that one key later if the copy reads thin.

4. **The "we're not sure where this belongs" state will fire on ~37.5% of items (measured: 27/72,
   deterministic per photo, concentrated on machines and recycle). Accept that for v1?**
   → **YES, accept it** — and make G4 a report-back before the app locks flip so the *total* ask rate is
   a number, not a surprise. The alternative is a numeric threshold calibrated on zero observations,
   which is exactly what the approved plan §2.1 rejects. If the number comes back above ~50%, the right
   response is fixing the taxonomy (Decision 7), not raising a threshold.

5. **Phase 3 pins `101recycle` to the English category tree, so zh-Hant/zh-Hans sellers see English
   recycle labels. Accept?**
   → **YES.** I reproduced the failure class: the positional locale bridge mis-maps 8 of 37 recycle
   categories silently (EN 2019 "Metalworking Equipment" → zh 2312 "回收技術"), with no null and no
   error. Untranslated beats silently wrong. It reverts in one line the day the API exposes a stable
   cross-locale key.

6. **Phase 3's browse mode: accordion (tap a parent to expand — the pattern already in this codebase at
   `LabListingEditSheet.tsx:1582-1689`) or all parents expanded (70 rows in 101lab's default state)?**
   → **Accordion.** It matches the in-repo precedent the phase itself says to copy, search is the fast
   path anyway, and 70 rows in the default state contradicts the "Can scrolling be reduced?" rule the
   phase cites as one of the four Nos it is fixing.

7. **Taxonomy content (S0-6): add the missing rows — /machines surface treatment, glass machinery,
   inspection/metrology and a general bucket (13 flat parents, **0** subcategories today); /101it ASUS
   and a Monitors & Displays parent; /recycle Furniture and a consumer-goods bucket?**
   → **YES, and it is the highest-leverage item on this list.** 8 of 11 category errors are
   *unreachable-correct-answer* errors. No code and no model change fixes them, and they are the reason
   machines and recycle dominate the 37.5% ask rate in Decision 4.

8. **Approve one mixed grouped submit on DEV (release gate 3) — the only write in the programme?**
   → **YES.** Mixed submit is currently **code-read only**. One dev submit converts the largest
   unexercised assumption in the plan into a fact.

9. **Prod re-measurement (one day, read-only, same 24 photos) as a gate before the locks flip in a
   shipped build?**
   → **YES.** Every number in all six documents is dev. Prod runs a different vision-provider
   configuration. One day of read-only measurement against a change that decides where the business's
   listings land.

---

## 8. Where the evidence is thin — say it out loud

Four things this programme is about to change are supported by reasoning, not observation. Each has a
gate; none has a result yet.

1. **Prod accuracy is completely unmeasured.** Every figure — 89% routing, 46% category, 37.5% ask
   rate, 9.4% false-101it — is dev. G22 is the only cure and it has not been run.
2. **Mixed-marketplace submit has never been exercised.** The mechanism reads correct end to end
   (per-product `allowed_sites` → per-product `site_id`), but no listing spanning two marketplaces has
   ever been submitted, and the behaviour of one auction group spanning `site_id`s is unknown. G20.
3. **The keyboard/CTA problem is structural-only.** I confirmed the structure (footer is a sibling of
   `KeyboardAwareScrollView`; no `KeyboardStickyView` anywhere in `src/` or `app/`). Nobody has watched
   it on a device, and Android may already resize the window — in which case the "fix" makes it worse.
   Phase 5 S1 is the first honest look, and iOS cannot be looked at on this machine at all.
4. **Nothing unit-tests the two most important wire changes.** Phase 1's suites pin the pure
   `buildRoutingSignal`, not the stamp; Phase 2's harness does not record the two new fields unless
   patched first. Both fields could be absent from the wire with every suite green. **G3 and G7 are the
   only proof, and they are live-run gates, not test gates.** Treat a green CI as saying nothing about
   whether this feature works.

And one thing we genuinely do not know yet: **how often the ask state will fire after S0-2 adds
`regex_override` and `low_confidence_fallback` to the trigger set.** I can measure `needs_clearer_photo`
from disk (37.5%) but the artifacts do not record the pre-override site type, so the override rate is
unknowable offline. That is precisely the observability gap S0-2 closes, and G4 is how we find out —
one dev run, day 2.

---

## 9. What I verified, re-measured, and did not

**Opened and confirmed today (app tree at `11ef609`, backend working tree at `aabac85`):**
`MarketplaceCard.tsx` 82 lines with `MARKETPLACE_LOCKED = true` at `:22`, `return null` at `:29`, pill
row `:39-76`, wrapper close `:77-80` · `constants.ts:40-48` `MARKETPLACE_OPTIONS` with **no** third
field, `defaultCurrencyForSite` `:70-72`, `marketplaceFromSiteType` `:116-130` ·
`CategoryConditionCard.tsx` 469 lines, `:46-47`, `:166-169`, `:203`, `:212`, `:268` ·
`detail.tsx:121/127/128/129/130/131/132/139/143/144/148` · `mapSmartDetection.ts:152/157/188/209/225/250/258-261`
· `smartDetectionTypes.ts:37/125` · `schema.ts:23/57` · `requiredStatus.ts:11-19/39-61/120-140` with
`REQUIRED_ROWS` = 7 and `RequiredStatus` = `{rows,doneCount,total,allComplete}` ·
`scanDraftStore.ts:64/108/159/413` · `fetchCategories.ts` 165 lines, `endpointForMarketplace` `:24-29`
**not exported**, comment at `:27` verbatim, `flattenCategoryOptions` `:144` with the flat branch at
`:148+` · `Sheet.tsx:120` (no `keyboardShouldPersistTaps`), `:198` `numberOfLines={1}`, `:202-206`
`description numberOfLines={2}` · `useDetailController.ts:2/16/44-45/51/55/58-64/66-70/94` ·
`processing.tsx:113/481/504-508` · `grouped-edit.tsx:67/217/219/220/233` ·
`grouped-review.tsx:100/158/541-576` · `DetailFooter.tsx:114-122` with the predicate at `:117` ·
`ProfitIntelligenceCard.tsx:18-20/23/151-158` · `app.config.ts:34` (`version: '1.0.3'`), `:90-92`
(`runtimeVersion: appVersion`) · `.env` line 1 = production · `src/lib/mmkv.ts` (`mmkv.set` /
`mmkv.getString`) · `src/lib/haptics.ts:50/75` (`tap`, `error`) · `package.json:26`
(`@tanstack/react-query ^5.100.14`) · backend `smartExtractionValidator.js:41-50` and `:282-304`
(304 lines total) · `wordPressSmart.js` 3411 lines with `FUZZY_MIN_SCORE` 64, `SITE_HINT_SKIP…` 66,
`__TEST__` 218, `pickDefaultParent` 677, `pickDefaultSubcategory` 686, `fuzzyCategoryFallback` 833,
`mergeTwoDetectionGroups` 954, `fillSubcategoryIfNeeded` 1525, `ensureCategoryPairForSiteType` 1560,
`detectSiteTypeForGroup` 1604, `resolveSiteTypeFromHintOnly` 1642, `resolveSiteTypeForGroup` 1657,
`processProductGroup` 1922, the override at 1942, the stamp at 2010, `runDetectionPass` 2024,
`runSmartDetection` 2298 — every one consistent with **both** phase drift registers.

**Re-measured myself:** the 72-product recorded-run baseline (routing 64/72 = 89%; site split
18/21/23/10; unresolved 0; flat first-row 12; `year === null` 19; `co2 "0 kg"` 40; escaped name 3) —
all reproduce Phase 2's table exactly; **`needs_clearer_photo` 27/72 = 37.5%** with the per-photo
breakdown (new — no phase states it as a rate); dev `GET /product/category?lang=en` → 200, 37 rows, 18
escaped, ids 1147–5366, no `id`/`subcategories` key; dev `GET /product/lab/category?language=en` → 200,
4 parents, 66 ids, 5371–5849 (overlap 0); dev `GET /mobile-config` → **404**; app `npx tsc --noEmit` →
exit 0, no output; all six locale files parse with `crlf == lf`, `dups=['close']`, counts
5290/5262/5262/5195/5179/5280; `"profitIntelligence":` unique at `en.json:3805`; none of the ~40 new
i18n keys from Phases 3/4/5 exists today (no collisions); `mobile.detail.sectionTitle` is `"TITLE"`.

**Not verified by me:** the app jest baseline 92/825/22 (three phase authors and two reviewers agree; I
did not re-run it) · the backend jest baseline (2 pre-existing failures) · any on-device behaviour ·
any iOS behaviour · anything on prod · the 800-listing replay (Phase 1's author and its reviewer both
reproduced it independently; I took their result) · the web smart-upload regression (G5 is written as a
manual step precisely because nobody has run it).

**Process compliance:** no `.ts`, `.tsx`, `.js`, `.json` or `.py` source file was edited; no commit,
push, branch switch, stash, reset or clean in either tree; no deploy, no migration, no production
write; `.env` was read but not modified; `greenbidz-ai-assistant/` was not touched. The only network
calls were three read-only `GET`s against `testapi.greenbidz.com`. The only file this work created is
this document.
