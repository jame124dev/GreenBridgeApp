# Phase 2 — Server: stop inventing answers

**Implements:** `MULTI_MARKETPLACE_PLAN.md` §7 Stage 0 tasks **S0-3a, S0-3b, S0-4, S0-5**
**Repo:** `c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend`
**Target:** DEV only — `https://testapi.greenbidz.com`, DB `greenbidz_test`
**Status:** ready to execute · written 2026-08-18 · **closeout revision 2026-08-18** (CTO NOT_READY
resolved: OWNER DECISION stamped at §0.1 and §4.4; integration coupling C5's merged bodies folded in
as the authoritative §5.2b; 10g' made a hard gate and widened to all five call sites; real measured
test baseline in Step 3; Step 11 / Step 28 contracts corrected) · **no code was changed in producing
this file — no `.js`, `.ts`, `.tsx`, `.json` or `.env` was touched**

---

## 0. Read this before you touch anything

### 0.1 The one dependency that can turn this phase into a regression

> ### ⚠️ S0-3a MUST NOT REACH PRODUCTION BEFORE THE APP SHIPS THE SEARCHABLE CATEGORY PICKER (Phase 3, task M-2).
>
> S0-3a makes the server emit an **empty category** when it cannot honestly resolve one.
> In the mobile app an empty category is a **hard submit-blocker**:
>
> ```ts
> // GreenBridgeApp/src/features/scanner/schema.ts:23   (verified 2026-08-18)
> categoryId: z.string().min(1, 'Category is required'),
> ```
>
> The picker the seller must then use is today **two stacked 240 px nested scrollers with no
> search** (`GreenBridgeApp/src/features/scanner/components/detail/CategoryConditionCard.tsx:211-216`
> and `:267-272` — both verified `style={{ maxHeight: 240 }}` + `nestedScrollEnabled`), and 38 of
> 101lab's 62 leaves sit under one parent.
>
> Ship S0-3a to prod without M-2 and you convert **"wrong listing" into "abandoned listing"**.
> This is `MULTI_MARKETPLACE_PLAN.md` §4.2 item 4 and Decision 3 ("Without the picker fix, do not
> do this").
>
> **The enforcement mechanism in this plan:** S0-3a ships behind the env flag
> `SMART_CATEGORY_UNRESOLVED`. On **dev** it is `1`. On **prod** it stays **absent/`0`** until
> M-2 is live in a shipped build (1.0.4). Flipping it needs no deploy — only a `pm2 restart`.
> **Step 9** declares the flag, **§4.4 (Steps 10a'-10e')** gates every path on it, and
> **§4.4 / 10g' — `__tests__/smartCategoryUnresolvedFlagOff.test.js` — is the gate that proves it.**
> (The line here previously pointed at Step 15, which is an S0-3b step and has nothing to do with the
> flag.)
>
> ### REVIEWER CORRECTION (CTO review, 2026-08-18) — read §4.4 BEFORE writing Step 10.
>
> As Steps 10a-10e were originally written **the flag did not gate all of S0-3a**: the
> `pickDefaultParent` / `pickDefaultSubcategory` fallbacks were deleted *unconditionally*, so with
> `SMART_CATEGORY_UNRESOLVED` absent (i.e. on prod) `product_cat` could still ship as
> `{id:"",name:""}` — the exact submit-blocking regression this callout forbids. **§4.4 replaces
> Steps 10a-10e with a flag-gated form and adds the flag-OFF test that would have caught it.**
> Do not implement Step 10 from §4.1-§4.3 alone.
>
> ### OWNER DECISION — APPROVED 2026-08-18
>
> **`pickDefaultParent` and `pickDefaultSubcategory` stay in the file, alive, behind
> `SMART_CATEGORY_UNRESOLVED`.** This reverses this plan's original intent (Step 10a) to delete
> them outright.
>
> *Reason.* Deleting them means **flag-off is not identical to today**. With the flag absent — which
> is the prod configuration until Phase 3's M-2 ships — a failed vision/LLM call would let
> `product_cat: {id:"",name:""}` reach the wire, and a blank category is a **hard submit-blocker** in
> the 1.0.3 build that is in Apple review right now
> (`GreenBridgeApp/src/features/scanner/schema.ts:23` — `categoryId: z.string().min(1, 'Category is required')`,
> opened and confirmed verbatim 2026-08-18). A kill switch that does not fully kill is not a kill
> switch.
>
> *This is a TEMPORARY keep.* Both helpers become **dead code** the moment the app's searchable
> category picker (M-2) is live everywhere and `SMART_CATEGORY_UNRESOLVED` is on in every
> environment: with the flag on, no call site can reach either function. **Removing them is a
> separate, later change** — its own commit, its own review — and it is explicitly NOT in this
> phase's scope. Do not delete them here, and do not add an ungated caller.

### 0.1a ⚠️ THE INTEGRATION PLAN OVERRIDES THIS DOCUMENT ON THREE FUNCTIONS (coupling C5)

`docs/multi-marketplace/phases/PHASE_INTEGRATION.md` §2 **C5** is authoritative and this phase is
**second** on the same three functions Phase 1 rewrites first:

| Function | Anchor (verified 2026-08-18) |
|---|---|
| `normalizeDetectedSiteType` | `services/smartExtractionValidator.js:282-304` |
| `detectSiteTypeForGroup`'s `catch` | `controller/wordPressSmart.js:1636-1639` |
| `resolveSiteTypeForGroup` | `controller/wordPressSmart.js:1657-1688` |

Whoever lands second wins the file. **Following Steps 15 / 16a / 16b / 16c of this document
literally drops `site_type_confidence` off the wire and reverts Phase 1's S0-2.**

**Therefore: §5.2b (immediately before Step 14) carries the merged bodies and is what you write.
Steps 15, 16a, 16b and 16c are reasoning only.** §5.2b also lists the two Phase 1 test assertions
that this phase owns and must change.

### 0.2 Non-negotiable operating rules for this phase

1. **No production anything.** No prod deploy, no prod DB write, no prod migration, no push to
   `main`. Everything here completes on dev. Prod is a separate, owner-approved step.
2. **Both working trees hold other people's uncommitted work.** In the backend, `git status` on
   2026-08-18 showed 8 modified files (chat IDOR fix, socket auth, AI-description fix) plus
   untracked files. **Do not `git stash`, `git reset`, `git checkout -- .`, or `git clean`.**
   Create your branch with `git switch -c` (it carries uncommitted work forward) and `git add`
   only the paths this plan names, by explicit path.
3. **Current backend branch on this machine is `fix/seller-gate-existing-sellers` at `aabac85`**
   (verified). It is not a prod branch. Branch from wherever you actually are, and re-verify the
   line anchors first (§1).
4. **Do not touch `greenbidz-ai-assistant/`.**
5. **No `eas update`.** 1.0.3 is in App Review; `runtimeVersion: appVersion` means an OTA would
   reach the build Apple is testing. This phase is server-only, so this should never come up —
   but the `.env` you edit in §1.4 belongs to the app, so read that step carefully.

### 0.3 UI rules

`c:/Users/Pc/Desktop/greenBridge/UX_DESIGN_RULES.md` is mandatory for UI work. **This phase ships
no UI.** It changes wire values only. The UX consequences of those values (blank category, "ask"
state) are Phase 3's M-2/M-3/M-6 and are governed by that file there. The one obligation this
phase carries is §0.1: do not let the wire change land in front of sellers before the UI that
makes it survivable.

---

## 1. Pre-flight (do all of §1 before writing a line of code)

### Step 1 — Re-verify every line anchor, because `main` moves

Every `file:line` in this document was opened and confirmed on **2026-08-18** against
`101recycle-greenbidz-backend` at `aabac85` with `controller/wordPressSmart.js` at **3411 lines**
and `services/smartExtractionValidator.js` at **304 lines**. Other developers landed Buy Now
orders, DHL shipments, reseller storefronts and a batch-feed fix the same day; prod was `2c088bf`.
Assume the numbers have moved.

Run this. It prints the current line for every anchor this plan edits. **Use the numbers it
prints, not the numbers in this document.**

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
git log --oneline -1
wc -l controller/wordPressSmart.js services/smartExtractionValidator.js utils/categoryCache.js controller/productController.js

echo "--- S0-3a anchors ---"
grep -n "^const FUZZY_MIN_SCORE\|^export const __TEST__\|^function pickDefaultParent\|^function pickDefaultSubcategory\|^function fuzzyCategoryFallback\|^function fillSubcategoryIfNeeded\|^function ensureCategoryPairForSiteType\|^function catTokenize\|^function scoreAgainst\|^async function processProductGroup\|pickDefaultParent(tree)\|pickDefaultSubcategory(selectedCat)\|pickDefaultSubcategory(parent)\|pickDefaultSubcategory(selectedParent)\|siteTypeUsesBrandSubcategories(siteType) && isBrandUnknown" controller/wordPressSmart.js

echo "--- S0-3b anchors ---"
grep -n "^export function normalizeSiteType\|^export function normalizeDetectedSiteType\|^export function validateAndNormalizeExtraction" services/smartExtractionValidator.js
grep -n "detectSiteTypeForGroup failed\|^async function resolveSiteTypeForGroup\|^function resolveSiteTypeFromHintOnly\|const batchSite = normalizeDetectedSiteType\|const per = normalizeDetectedSiteType\|const normalized = normalizeDetectedSiteType\|normalizeSiteType(siteType) || String" controller/wordPressSmart.js

echo "--- S0-4 anchors ---"
grep -n "^export const getCategories\|^function normalizeCategories\|^function buildTreeFromFlatRows\|^async function fetchRecycle\|^async function loadSqlCatalog" controller/productController.js utils/categoryCache.js

echo "--- S0-5 anchors ---"
grep -n "^export function normalizeYear\|UNKNOWN_BRAND_VALUES\|const year = normalizeYear" services/smartExtractionValidator.js controller/wordPressSmart.js
grep -n "CO₂ Emissions:" controller/wordPressSmart.js
```

Reference output as of 2026-08-18 (what the numbers *were*):

| Anchor | File | Line (2026-08-18) |
|---|---|---|
| `FUZZY_MIN_SCORE = 4` | `controller/wordPressSmart.js` | 64 |
| `catTokenize` | `controller/wordPressSmart.js` | 652–657 |
| `scoreAgainst` | `controller/wordPressSmart.js` | 659–675 |
| `pickDefaultParent` | `controller/wordPressSmart.js` | 677–684 |
| `pickDefaultSubcategory` | `controller/wordPressSmart.js` | 686–689 |
| `findBestParent` | `controller/wordPressSmart.js` | 691–723 |
| `export const __TEST__` | `controller/wordPressSmart.js` | 218–241 |
| `normalizeIdentityAndConfidence` | `controller/wordPressSmart.js` | 810–821 |
| `fuzzyCategoryFallback` | `controller/wordPressSmart.js` | **833–877** |
| `fillSubcategoryIfNeeded` | `controller/wordPressSmart.js` | 1525–1547 |
| `ensureCategoryPairForSiteType` | `controller/wordPressSmart.js` | 1560–1602 |
| vision-exception → recycle | `controller/wordPressSmart.js` | 1636–1639 |
| `resolveSiteTypeFromHintOnly` | `controller/wordPressSmart.js` | 1642–1655 |
| `resolveSiteTypeForGroup` | `controller/wordPressSmart.js` | 1657–1688 |
| `pickCategoryFromTree` | `controller/wordPressSmart.js` | 1877–1920 |
| `processProductGroup` | `controller/wordPressSmart.js` | 1922–2022 |
| 101it brand-clearing precedent | `controller/wordPressSmart.js` | **2001–2008** |
| `runDetectionPass` per-product site stamp | `controller/wordPressSmart.js` | **2138–2162** |
| `product` SSE event shape | `controller/wordPressSmart.js` | 3272–3278 |
| `result` payload | `controller/wordPressSmart.js` | **3354–3372** |
| `normalizeSiteType` | `services/smartExtractionValidator.js` | 41–50 |
| `normalizeYear` | `services/smartExtractionValidator.js` | 81–87 |
| year handling in validate | `services/smartExtractionValidator.js` | 190–196 |
| `normalizeDetectedSiteType` | `services/smartExtractionValidator.js` | **282–304** |
| `getCategories` (recycle endpoint) | `controller/productController.js` | 244–290 |
| `normalizeCategories` | `utils/categoryCache.js` | 37–48 |
| `buildTreeFromFlatRows` | `utils/categoryCache.js` | 50–84 |
| `loadSqlCatalog` | `utils/categoryCache.js` | 117–148 |
| `fetchRecycle` | `utils/categoryCache.js` | 163–184 |
| `ensureSmartDetectionCategories` | `utils/categoryCache.js` | **238–251** |

**Drift already found against `MULTI_MARKETPLACE_PLAN.md` — corrected here, do not re-derive:**

| Plan says | Actually (2026-08-18) |
|---|---|
| `fuzzyCategoryFallback` at `:833-870` | **`:833-877`.** The cited range stops before the `pickDefaultSubcategory` fallback at `:871` — which is part of the same defect. |
| 101it precedent at `:2004-2006` | Comment `:2001-2005`, the clearing code is **`:2006-2008`**. |
| `runDetectionPass` stamps confidence at `:2137-2160` | **`:2138-2162`.** |
| `result.detection` at `:3358-3363`, `needs_clearer_photo` at `:3367-3372` | `detection` object **`:3357-3361`**; `needs_clearer_photo` **`:3367-3369`**; whole payload `:3354-3372`. |
| `normalizeDetectedSiteType` at `:282-303` | **`:282-304`** (closing brace on 304). |
| `ensureSmartDetectionCategories` / WP-preferred-over-SQL at `categoryCache.js:236-249` | **`:238-251`.** |
| `buildCompressedCategoryTree` emits parents in load order at `categoryCache.js:255-275` | **`:256-275`.** |
| `endpointForMarketplace` at `fetchCategories.ts:24-30` | **`:24-29`.** |
| `SCAN_FLOW_BACKEND.md:444` — "`year` emitted as the **literal string** `"null"`" | **Wrong, and it changes the fix.** On the wire it is JSON **`null`** (`typeof === "object"`), not the string `"null"`. Proven from the recorded DEV runs (§3) and from code: `normalizeYear("null")` returns `""` and the `else if (data.year)` branch then blanks it, but `normalizeYear(null)` also returns `""` and `else if (null)` is **falsy**, so `data.year` is left as `null` and serialised as `null`. See Step 12. |

The line references in `MULTI_MARKETPLACE_PLAN.md` §4.1/§4.2/§5/§7 were otherwise correct where
this phase touches them, including `pickDefaultParent` at `:677-682` (the function body is
677–684; the `tree[0]` return is inside the cited range), `ensureCategoryPairForSiteType` at
`:1560-1602` (exact), and the vision-exception `recycle` at `:1637-1638` (exact).

### 1.1 ⏱ ANCHOR ADDENDUM — Phase 1 landed while this closeout was being written. Re-read this first.

> **⚠ SUPERSEDED 2026-08-19 by §1.2 below.** This section was written at `eb073fb`, Phase 1's
> FIRST commit; Phase 1 then landed `8383b62` and `aa0635b`. Every number in this section has moved
> again, its recorded §5.2b-pre hit counts (48/10) belong to a different commit, and its §5.2b status
> table is out of date on three rows. **Read §1.2, not this.**

**Recorded 2026-08-18, later the same day than everything above.** The backend branch
`fix/seller-gate-existing-sellers` moved from **`aabac85`** to **`eb073fb`**
(*"S0-1: inferSiteTypeFromProduct may only override on identity fields"*) — i.e. **Phase 1 has
landed**, exactly as integration §1 sequences it. `controller/wordPressSmart.js` grew **3411 → 3550**
lines and `services/smartExtractionValidator.js` **304 → 357**. Every line number in the rest of this
document is the `aabac85` number and is now **stale by 10–35 lines**. Step 1's grep is no longer
optional.

**§5.2b-pre resolves to the "Hits" branch. Confirmed by running it:** 48 hits in
`controller/wordPressSmart.js`, 10 in `services/smartExtractionValidator.js`.

**The anchors §4.4 and §5.2b actually depend on, re-derived at `eb073fb`:**

| What | `aabac85` (rest of this doc) | **`eb073fb` (use this)** |
|---|---|---|
| `FUZZY_MIN_SCORE = 4` | 64 | **64** (unchanged) |
| `export const __TEST__` | 218 | **223** |
| `../services/smartExtractionValidator.js` import block | 10–17 | **10–17** (unchanged) |
| `pickDefaultParent` / `pickDefaultSubcategory` | 677 / 686 | **687 / 696** |
| 🔒 gate 1 — `fuzzyCategoryFallback` parent fallback | 857 | **867** |
| 🔒 gate 2 — `fuzzyCategoryFallback` sub fallback | 871 | **881** |
| 🔒 gate 3 — `fillSubcategoryIfNeeded` default sub | 1545 | **1561** |
| 🔒 gate 4 — `ensureCategoryPairForSiteType` parent | 1576 | **1592** |
| 🔒 gate 5 — `ensureCategoryPairForSiteType` sub | 1598 | **1614** |
| `fuzzyCategoryFallback` (fn) | 833 | **843** |
| `fillSubcategoryIfNeeded` (fn) | 1525 | **1541** |
| `ensureCategoryPairForSiteType` (fn) | 1560 | **1576** |
| `detectSiteTypeForGroup` (fn) | 1604 | **1620** |
| `detectSiteTypeForGroup`'s `catch` | 1636–1639 | **1658–1666** (`console.warn` at `:1659`) |
| `resolveSiteTypeForGroup` (fn) | 1657 | **1687**; its tail `if (lowConfidence) source = …` is `:1731`, its `return` `:1733` |
| `pickCategoryFromTree` cacheKey `normalizeSiteType(siteType)` | 1883 | **1929** |
| `processProductGroup` (fn) | 1922 | **2016** |
| `const catEmpty` / the `if` / the `fuzzyCategoryFallback` call | 1979 / 1980 / 1981 | **2087 / 2088 / 2089** |
| `ensureCategoryPairForSiteType(data, treeForSite);` — Step 11's replace target | 1993 | **2101** (`const taxSuggested` now `:2103`) |
| `data.site_type = siteType;` stamp | 2010 | **2118** |
| `runDetectionPass` — `const batchSite` / `const per` | 2124 / 2138 | **2240 / 2257** |
| `runSmartDetection` (v1) | 2298 | **2423** |
| `siteTypeUsesBrandSubcategories`'s `normalizeSiteType(siteType)` | 829 | **839** |
| CO₂ prompt line (Step 25) | 570 | **580** (`For weight:` on the next line, as before) |
| `normalizeSiteType` (validator) | 41 | **41** (unchanged) |
| `data.site_type = normalizeSiteType(siteType \|\| data.site_type)` | 151 | **151** (unchanged) |
| `delete data._parent_category_hint` | 205 | **205** (unchanged) |
| `normalizeDetectedSiteType` (validator) | 282–304 | **317–356** |

**All five 🔒 gated call sites still exist, still read exactly as quoted in §4.4, and Phase 1 touched
none of them** — so §4.4's code is applied unchanged, only at the new line numbers, and 10g'
remains valid as written.

#### What Phase 1's landed code changes about §5.2b — read before writing §5.2b

Phase 1 implemented more of the merge than C5 assumed, which **shrinks** this phase's job. Verified by
reading `eb073fb`:

| §5.2b part | Status at `eb073fb` | What Phase 2 still writes |
|---|---|---|
| **§5.2b-1** `normalizeDetectedSiteType` | Phase 1's version: **still rewrites both branches to `recycle`**, returns `detectedSiteType` + `lowConfidence`, has **no `source`**, and off-list keeps the model's `confidence` rather than 0 | **All of §5.2b-1.** This is the real S0-3b change and it is entirely outstanding |
| **§5.2b-2** `detectSiteTypeForGroup`'s `catch` | returns `{siteType:"recycle", suggested_terms:{}, confidence:0, lowConfidence:true}` — **no `source`, and `recycle` not `null`** | **All of §5.2b-2**, plus `lowConfidence` + `source` on the success return (`:1656` already has `lowConfidence`; add `source`) |
| **§5.2b-3** `resolveSiteTypeForGroup` | **Mostly done.** Already returns `{siteType, suggested_terms, confidence, source}`, already has `if (lowConfidence) source = "low_confidence_fallback"` at `:1731` | **Five small deltas only:** (1) replace the four bare string literals (`"hint"`, `"vision"`, `"low_confidence_fallback"`) with `SITE_TYPE_SOURCE.*`; (2) seed `let source = fromVision.source \|\| SITE_TYPE_SOURCE.VISION`; (3) `if (siteType == null \|\| detConf >= fromVision.confidence)`; (4) `lowConfidence = detectionHint.site_type_low_confidence === true \|\| detConf < SITE_TYPE_LOW_CONFIDENCE`; (5) add the `if (siteType == null) { siteType = "recycle"; confidence = 0; lowConfidence = true; }` block immediately **above** `:1731` |
| **§5.2b-4** `processProductGroup` stamp | **Already done by Phase 1.** `buildRoutingSignal` exists (`:1987-2014`), is called at `:2043`, and `data.site_type_source = routingSignal.site_type_source` is stamped at `:2126` beside `site_type_confidence` | **Nothing to add — and that is the point: do NOT introduce a local `siteTypeSource`.** Step 16c would have created a second, competing source of truth |
| **§5.2b-5** two Phase 1 test assertions | Phase 1's `__tests__/siteTypeRoutingSignal.test.js` is on the branch | Unchanged instruction: edit those two assertions in **this** phase's PR |
| **C13** the enum lives in one place | `buildRoutingSignal` uses **bare string literals**, and Phase 1 left a comment at `:1977` saying *"lands its exported SITE_TYPE_SOURCE constant, these literals become references"* | Export `SITE_TYPE_SOURCE` from `services/smartExtractionValidator.js` (Step 15) and **swap Phase 1's four literals in `buildRoutingSignal` for references.** Phase 1 explicitly invited this; it is not a drive-by edit |

### 1.2 ⏱ ANCHOR ADDENDUM #2 — recorded 2026-08-19. **§1.1 above is now STALE. This section supersedes it.**

§1.1 was written at **`eb073fb`** — Phase 1's *first* commit. Phase 1 then landed two more:

```
eb073fb  S0-1: inferSiteTypeFromProduct may only override on identity fields   <- §1.1 was written here
8383b62  S0-2: emit site_type_confidence + site_type_source per product
aa0635b  S0-2 hardening: pin the routing contract on the wire, and stop the
         fallback paths mislabelling the grouping confidence                    <- Phase 1 ENDS here
742d359  S0-1 hardening: pin the identity-only narrowing itself                 <- test-only, no source change
```

`controller/wordPressSmart.js` is now **3581 committed lines** (`3589` in the working tree — see the
+8 warning below) and `services/smartExtractionValidator.js` **357**. **Every line number in §1.1 and
in the rest of this document is wrong.** Re-derived below by opening each site on 2026-08-19.

#### 1.2a ⚠ Read this before you use any number in this document

**The numbers in the tables below are WORKING-TREE numbers — `HEAD + 8`.** `controller/wordPressSmart.js`
carries an unrelated engineer's uncommitted AI-description change
(`services/descriptionStyleRule.js`), in four hunks:

```
@@ -33,0  +34    @@   import { buildDescriptionRule } ...
@@ -250,0 +252,6 @@   three extra symbols inside `export const __TEST__`
@@ -565,0 +573   @@   const descriptionRule = buildDescriptionRule(lang);
@@ -577  +585    @@   the equipment_description prompt line, replaced 1-for-1
```

So: identical to `HEAD` above line 34, **+1** between 34 and 251, **+7** between 252 and 572, and
**+8** from 573 down. Every S0-3a / S0-3b / S0-5 anchor in this phase is in the **+8** region.
`grep -n` on your working tree prints the numbers below; `git show HEAD:…` prints them minus 8.

**Two consequences you must not skip.**

1. **The dirty hunk sits inside `export const __TEST__`** — the very block this phase edits. `:252-257`
   adds `buildDescriptionRule`, `buildExtractionSystemPrompt`, `buildLanguageBlocks`. Those are **not
   yours**. Stage by explicit path, then read `git diff --cached` before every commit. Never
   `git add -A`, never `git add .`, never `git commit -a`.
2. The dirty-entry count to record before staging (Step 27's step 1) is **27** at `aa0635b`/`742d359`,
   the same 27 as at `aabac85`. Phase 1 committed nothing of anyone else's.

#### 1.2b The anchors §4.4 / §5.2b / Steps 11-17 / Step 25 depend on

| What | `aabac85` (body of this doc) | `eb073fb` (§1.1) | **`aa0635b` working tree — USE THIS** |
|---|---|---|---|
| `SITE_HINT_SKIP_VISION_MIN_CONF = 0.92` | — | — | **66** |
| `REGEX_OVERRIDE_CONFIDENCE = 0.5` *(new in Phase 1)* | — | — | **71** |
| `FUZZY_MIN_SCORE = 4` | 64 | 64 | **64** (unchanged) |
| `export const __TEST__` | 218 | 223 | **223-258** (`:252-257` is the DIRTY hunk; Phase 1's 7 symbols are `:240-251`) |
| `../services/smartExtractionValidator.js` import block | 10-17 | 10-17 | **10-17** (unchanged; `:5-9` is still the *categoryCache* import) |
| `catTokenize` / `scoreAgainst` | 652 / 659 | — | **669 / 676** |
| `pickDefaultParent` / `pickDefaultSubcategory` | 677 / 686 | 687 / 696 | **694 / 703** |
| `findBestParent` | 691 | — | **708** |
| `UNKNOWN_BRAND_VALUES` / `isBrandUnknown` body | — | — | **791 / 810** |
| `normalizeIdentityAndConfidence` | 810 | — | **827** |
| `siteTypeUsesBrandSubcategories`'s `normalizeSiteType(siteType)` | 829 | 839 | **846** (fn at `:844`) |
| `fuzzyCategoryFallback` (fn) | 833 | 843 | **850** |
| 🔒 gate 1 — `fuzzyCategoryFallback` parent fallback | 857 | 867 | **874** |
| 🔒 gate 2 — `fuzzyCategoryFallback` sub fallback | 871 | 881 | **888** |
| `mergeTwoDetectionGroups` *(Phase 1 exported it)* | — | — | **971-993** |
| `fillSubcategoryIfNeeded` (fn) | 1525 | 1541 | **1548** |
| 🔒 gate 3 — `fillSubcategoryIfNeeded` default sub | 1545 | 1561 | **1568** |
| `ensureCategoryPairForSiteType` (fn) | 1560 | 1576 | **1583** |
| 🔒 gate 4 — `ensureCategoryPairForSiteType` parent | 1576 | 1592 | **1599** |
| 🔒 gate 5 — `ensureCategoryPairForSiteType` sub | 1598 | 1614 | **1621** |
| `detectSiteTypeForGroup` (fn) | 1604 | 1620 | **1627-1674** |
| `detectSiteTypeForGroup` **success** return (§5.2b-2's second block) | 1628-1635 | `:1656` has `lowConfidence` | **1647-1663** (`normalizeDetectedSiteType` call `:1650`, `lowConfidence:` `:1663`) |
| `detectSiteTypeForGroup`'s **`catch`** (§5.2b-2) | 1636-1639 | 1658-1666 | **1665-1673** (`console.warn` `:1666`, `siteType: "recycle"` `:1668`) |
| `resolveSiteTypeFromHintOnly` | 1642-1655 | — | **1676-1692** |
| `resolveSiteTypeForGroup` (fn, §5.2b-3) | 1657-1688 | 1687 | **1694-1741** |
| — its hint-skip gate `if (hinted && hinted.confidence >= …)` | — | — | **1700** |
| — its hint-vs-vision contest block `if (detectionHint?.site_type) { … }` | 1675-1682 | — | **1722-1736**; its deciding `if (detConf >= fromVision.confidence)` is **1729** (`detConf` `:1725-1728`, `lowConfidence =` `:1732`, `source = "hint"` `:1733`) |
| — its tail `if (lowConfidence) source = …` / `return` | — | 1731 / 1733 | **1738 / 1740** |
| `pickCategoryFromTree` (fn) / its cacheKey `normalizeSiteType(siteType)` | 1877 / 1883 | — / 1929 | **1930 / 1936** |
| `buildRoutingSignal` *(new in Phase 1 — the S0-2 seam)* | — | 1987-2014 | **1994-2021** |
| `buildGroupDetectionHint` *(new in Phase 1)* | — | — | **2036-2042** |
| `buildBatchDetectionHint` *(new in Phase 1)* | — | — | **2054-2060** |
| `processProductGroup` (fn) | 1922-2022 | 2016 | **2062-2184** |
| — the `buildRoutingSignal({...})` call | — | 2043 | **2089-2094** |
| — the mid-function `data.site_type = siteType;` (Phase 1's, keeps the override) | 1930 / 1942 | 2043 | **2100** |
| — `const catEmpty` / the `if` / the `fuzzyCategoryFallback` call | 1979 / 1980 / 1981 | 2087 / 2088 / 2089 | **2133 / 2134 / 2135** |
| — `ensureCategoryPairForSiteType(data, treeForSite);` (Step 11's replace target) | 1993 | 2101 | **2147** (`const taxSuggested` `:2149`) |
| — 101it brand-clearing precedent | 2001-2008 | — | **2155-2162** |
| — the FINAL `data.site_type = siteType;` (§5.2b-4's stamp site) | 2010 | 2118 | **2164** — ⚠ `grep -n "data.site_type = siteType;"` returns **THREE** lines: `:1918` (inside `extractAttributes`, unrelated), `:2100` (mid-function, keeps the regex override before the category tree is loaded) and `:2164` (the stamp site). Take the **last** one |
| — `data.site_type_confidence = routingSignal…` / `…_source = routingSignal…` | — | 2126 | **2171 / 2172** |
| `runDetectionPass` (fn) | — | — | **2186-2403** |
| — `const batchSite = normalizeDetectedSiteType(parsed)` | 2124 | 2240 | **2286** |
| — its own empty-products synthetic product (raw values, one normalization) | — | — | **2288-2302** |
| — `const per = normalizeDetectedSiteType({…})` / the per-product stamp block | 2138 / 2138-2162 | 2257 | **2309 / 2309-2334** |
| — its return: `siteConfidence` / `siteLowConfidence` *(new in Phase 1)* | — | — | **2396 / 2401** |
| `runSmartDetection` (v1) | 2298 | 2423 | **2482** |
| — v1 per-group `processProductGroup` call site (hint arg) | — | — | **2507-2512** (`buildGroupDetectionHint(group)` `:2510`) |
| — v1 empty-products fallback call site | — | — | **2547-2552** (`buildBatchDetectionHint(detection)` `:2550`) |
| — v1 `const payload = {` | — | — | **2557** |
| `smartDetectProductsV2` | — | — | **2882** |
| — v2 per-group `processProductGroup` call site | — | — | **3440-3446** (`buildGroupDetectionHint(group)` `:3443`) |
| — v2 empty-products fallback call site | — | — | **3505-3511** (`buildBatchDetectionHint(detection)` `:3508`) |
| — v2 `product` SSE event shape | 3272-3278 | — | **3450-3457** |
| — v2 `result` payload | 3354-3372 | — | **3532-3550** (`detection` object `:3535-3539`, `needs_clearer_photo` `:3545-3547`) |
| CO₂ prompt line (Step 25) | 570 | 580 | **587** (`For weight:` on the next line, as before) |
| `normalizeSiteType` (validator) | 41-50 | 41 | **41-50** (unchanged) |
| `normalizeYear` (validator) | 81-87 | — | **81-87** (unchanged) |
| `validateAndNormalizeExtraction` (validator) | — | — | **148** |
| `data.site_type = normalizeSiteType(siteType \|\| data.site_type)` | 151 | 151 | **151** (unchanged) |
| year handling in validate | 190-196 | — | **190** (`const year = normalizeYear(data.year)`) |
| `delete data._parent_category_hint` | 205 | 205 | **205** (unchanged) |
| `IT_STRONG_RE` / `IT_WEAK_RE` / `IT_BRAND_RE` / `LAB_PRODUCT_RE` / `MACHINE_PRODUCT_RE` *(S0-1)* | — | — | **236 / 239 / 242 / 244 / 247** |
| `inferSiteTypeFromProduct` (validator) | — | — | **268-292** |
| `normalizeDetectedSiteType` (validator, §5.2b-1) | 282-304 | 317-356 | **317-356** (unchanged since `eb073fb`) |
| `getCategories` (`controller/productController.js`) | 244-290 | — | **244** (unchanged) |
| `normalizeCategories` / `buildTreeFromFlatRows` / `loadSqlCatalog` / `fetchRecycle` (`utils/categoryCache.js`) | 37 / 50 / 117 / 163 | — | **37 / 50 / 117 / 163** (all unchanged) |
| `ensureSmartDetectionCategories` / `buildCompressedCategoryTree` (`utils/categoryCache.js`) | 238-251 / 256 | — | **238 / 256** (unchanged) |

**All five 🔒 gated call sites still exist and still read exactly as quoted in §4.4.** Phase 1 touched
none of them, so §4.4's code and 10g' apply unchanged, only at the new numbers. Every S0-4 and S0-5
anchor outside `controller/wordPressSmart.js` is byte-unchanged since `aabac85`.

#### 1.2c §5.2b-pre's grep — the recorded hit counts were never right

§1.1 states *"Confirmed by running it: 48 hits in `controller/wordPressSmart.js`, 10 in
`services/smartExtractionValidator.js`"* under a heading that says the tree is `eb073fb`. Those two
numbers cannot both be true: at `eb073fb` the grep returns **22 / 2**. 48 / 10 is the count at
**`8383b62`**, one commit later. Measured today:

| Commit | `controller/wordPressSmart.js` | `services/smartExtractionValidator.js` |
|---|---|---|
| `eb073fb` | 22 | 2 |
| `8383b62` | 48 | 10 |
| **`aa0635b` (and the working tree)** | **47** | **10** |

The branch resolution is unaffected — **hits, so Phase 1 has landed** — but do not treat 48/10 as a
checksum. Use "many hits, including `buildRoutingSignal`" as the signal.

#### 1.2d Steps that no longer make sense against the refactored shape — rewritten here

Phase 1's authorised refactor replaced the four inline `detectionHint` literals with two pure
builders. Three places in this document instruct you to grep for or edit code that **no longer
exists**. Use these rewrites.

**(i) Step 28's acceptance notes cite an object that no longer exists.** Two places in §8 — the
`routing accuracy` row of the after-table, and the paragraph beginning *"per product (`:2124` …"* —
say the per-product stamps are *"passed straight back in as the `detectionHint` (`:3262-3265`, inside
the `processProductGroup` call at `:3259`)"*. A third — the *"A product moved **away** from its
`set.json` truth"* row — points at the hint contest as `:1675-1682`. **All three anchors are dead:**
`aa0635b` replaced the four inline `detectionHint` literals with two builders, so
`grep -n "site_type: detection.siteType" controller/wordPressSmart.js` and
`grep -n "site_type_confidence: batchSite.confidence" controller/wordPressSmart.js` both return
**nothing** (verified 2026-08-19, exit 1). Replacement anchors: `:2124` → **`:2286`**, `:2138` →
**`:2309`**, the hint contest `:1675-1682` → **`:1722-1736`** (its deciding `if` is `:1729`). The
correct statement is:

> `runDetectionPass` stamps four site keys per product at **`:2309-2334`** (`site_type`,
> `site_type_confidence`, `site_type_low_confidence`, `site_type_detected`). Those keys are read back
> in by **`buildGroupDetectionHint(group)`** — `controller/wordPressSmart.js:2036-2042` — which is the
> `detectionHint` argument at **all four** `processProductGroup` call sites: v1 per-group `:2510`, v1
> empty-products fallback `:2550` (via `buildBatchDetectionHint`), v2 per-group `:3443`, v2
> empty-products fallback `:3508` (via `buildBatchDetectionHint`). The hint can then win the contest at
> **`:1729`**. So routing can legitimately change when S0-3b changes what `normalizeDetectedSiteType`
> returns — that is the point of S0-3b, not a regression.

**(ii) The old grep `grep -n "{ site_type: detection.siteType }" …` and any grep for
`site_type_confidence: batchSite.confidence` return NOTHING.** Both were consumed by the builders. The
replacement pre-flight grep is:

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
# the two builders and their four call sites — expect 4 and 4 code hits respectively
grep -n 'buildGroupDetectionHint\|buildBatchDetectionHint' controller/wordPressSmart.js
# the batch fallback MUST read siteConfidence, never `detection.confidence` (contract rule 1)
grep -n 'site_type_confidence: detection?.siteConfidence' controller/wordPressSmart.js   # expect 1
grep -n 'siteConfidence: batchSite.confidence' controller/wordPressSmart.js              # expect 1
# the S0-2 seam this phase must NOT duplicate
grep -n 'buildRoutingSignal' controller/wordPressSmart.js                                # 5 raw / 3 code
grep -n 'REGEX_OVERRIDE_CONFIDENCE' controller/wordPressSmart.js                         # 3, all code (:71 :2006 :2013)
```

**(iii) The `detectionHint` shape is now defined in one place, so Phase 2 must not hand-build one.** If
S0-3b needs a new key on the hint (it does not, as written), add it to **both** builders — that is why
they exist. The three keys are exactly:

```js
{ site_type, site_type_confidence, site_type_low_confidence }
```

`buildGroupDetectionHint` reads them off the per-product group; `buildBatchDetectionHint` reads
`detection.siteType` / `detection.siteConfidence` / `detection.siteLowConfidence`. **`buildBatchDetectionHint`
must never read `detection.confidence`** — that is the how-many-products number, and emitting it as
`site_type_confidence` is the exact contract-rule-1 violation Phase 1's `aa0635b` fixed. It is pinned
at both endpoint and unit level; see Phase 1 §13.1.

**(iv) §5.2b-4 is already satisfied and its line numbers moved.** `buildRoutingSignal` exists at
**`:1994-2021`**, is called at **`:2089-2094`**, and the two stamps are at **`:2171-2172`** — after the
final `data.site_type = siteType;` at `:2164`. Phase 2 adds **nothing** here; it must not introduce a
local `siteTypeSource`, and it must not drop `data.site_type_confidence`.

**(v) C13 — the enum swap has SIX literal sites across two functions, not four.** Enumerated by
opening each one:

| Line | Function | Literal |
|---|---|---|
| `:1708` | `resolveSiteTypeForGroup` (hint-skip return) | `hinted.lowConfidence ? "low_confidence_fallback" : "hint"` — **two** values on one line |
| `:1733` | `resolveSiteTypeForGroup` (hint wins the contest) | `source = "hint"` |
| `:1738` | `resolveSiteTypeForGroup` (tail demotion) | `source = "low_confidence_fallback"` |
| `:2000` | `buildRoutingSignal` (default) | `source \|\| "vision"` |
| `:2007` | `buildRoutingSignal` (override) | `finalSource = "regex_override"` |
| `:2012` | `buildRoutingSignal` (cap test) | `if (finalSource === "low_confidence_fallback")` — a **comparison**, not an assignment; swap it too or the cap silently stops firing |

Swap every one for `SITE_TYPE_SOURCE.*` when Step 15 exports it. Phase 1's own doc-comment at
`:1982-1985` explicitly invites this ("*When S0-3b lands its exported SITE_TYPE_SOURCE constant, these
literals become references to it*"), so it is not a drive-by edit. **`:2012` is the one that bites if
missed** — a typo'd constant there leaves the `<= 0.5` cap unreachable with every test still green
except the two that assert 0.5.

### Step 2 — Create your branch without disturbing anyone

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
git status --porcelain          # expect other people's modified/untracked files — LEAVE THEM
git switch -c feat/s0-3-server-stop-guessing
```

`git switch -c` carries the uncommitted work forward. Later, commit **only** these paths:

```
controller/wordPressSmart.js
services/smartExtractionValidator.js
utils/categoryCache.js
utils/htmlEntities.js
controller/productController.js
__tests__/smartCategoryUnresolved.test.js
__tests__/smartCategoryUnresolvedFlagOff.test.js
__tests__/siteTypeHonestFallback.test.js
__tests__/categoryNameEntities.test.js
__tests__/smartFieldHygiene.test.js
__tests__/siteTypeRoutingSignal.test.js      <- ADDED 2026-08-19: Phase 1 suite, see 5.2b-5 (2 assertions)
__tests__/siteTypeRoutingWire.test.js        <- ADDED 2026-08-19: Phase 1 suite, see 5.2b-5b (12 assertions)
```

### Step 3 — Record the test baseline you must not regress

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
npm test 2>&1 | tail -40
```

#### The REAL baseline — measured, not reported

The earlier text here carried a second-hand claim. **The suite was actually run on 2026-08-18 on
branch `fix/seller-gate-existing-sellers` at `aabac85`** with the 27 pre-existing dirty entries in
the tree, using exactly the command above. This is the number to hold yourself to:

```
Test Suites: 2 failed, 56 passed, 58 total
Tests:       3 failed, 1 skipped, 720 passed, 724 total
Snapshots:   0 total
Time:        ~9.6 s
```

**Exactly 2 suites and exactly 3 tests are red before you start. Both are unrelated to this
phase.** Anything else red is yours.

| Red suite | Red tests | Why it is red (root cause, read so you do not chase it) |
|---|---|---|
| `__tests__/uploadValidationService.test.js` | **3**, all in `describe("validateUploadFiles — rejected document classes get specific reasons")`: `Legacy CFB (encrypted.xlsx with CFB magic) → cfb_legacy_or_encrypted reason` (`:149`), `Macro-enabled .docm → macro_enabled reason at validate gate` (`:163`), `XXE'd OOXML → unsafe document structure` (`:174`) | All three assert a *specific* rejection reason; the service returns the generic `"Document could not be rendered to an image — needs manual review."` The specific-reason classifier no longer reaches those assertions. **Nothing to do with `site_type` or categories.** |
| `__tests__/zohoListingSyncPublished.test.js` | **suite failed to run** (counts as 0 red tests, 1 red suite) | `SyntaxError: The requested module '../utlis/zohoUtils.js' does not provide an export named 'createZohoOffer'` at `:136`. The test's `jest.unstable_mockModule("../utlis/zohoUtils.js", …)` factory (ends `:107`) is **stale**: it omits `createZohoOffer`, which the SUT `lib/zohoSync.js:36` imports. The real export does exist (`utlis/zohoUtils.js:1164`) — it is the mock, not the source, that is behind. |

Two things follow, and both matter to you:

1. **`uploadValidationService.js:415` is `normalizeSiteType(item.marketplace, "")`** — an **explicit**
   fallback, so Step 14 does not touch it. If that suite's failure *changes shape* (different test
   names, or a 4th red test) after your edit, look there first.
2. Neither red file, nor `lib/zohoSync.js`, nor `utlis/zohoUtils.js`, is dirty in the working tree —
   so these two failures are genuinely pre-existing at `aabac85`, not artefacts of another
   engineer's uncommitted work. Do not "fix" them in this branch.

Single-file loop, which you will use constantly:

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/brandUnknownGuard.test.js --forceExit
```

**Verified 2026-08-18:** that command passes (`1 passed, 19 tests, 3.788 s`) and importing
`controller/wordPressSmart.js` from a Jest test works. **Without `--forceExit` Jest prints
"Jest did not exit one second after the test run has completed" and hangs** — the sequelize
import leaves an open handle. Always pass `--forceExit` for single-file runs. Calling `jest`
directly (no `--experimental-vm-modules`) fails on `import`.

### Step 4 — Point the app at DEV, and write down how to put it back

You will use the mobile app to eyeball the wire change in Step 16. The app currently points at
**production**:

```
# GreenBridgeApp/.env line 1 — verified 2026-08-18
GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
```

**An earlier session left this file on a `localhost` URL and it had to be recovered from a
backup. Do not repeat that.**

> **Integration coupling C9 — one file, five phases, and this step's convention was one of five.**
> `GreenBridgeApp/.env` is a single gitignored file (`.gitignore:34`) that **all five phases want to
> point at dev**, and each phase originally prescribed a *different* backup path — including a
> **timestamped rotating** one, right here. Rotating backups are the hazard: a later phase's
> "restore from the backup" glob then matches several files and its `diff` can never come back clean.
>
> **Enforcement, and it overrides the `$(date …)` line that used to be below:**
> 1. **The APP engineer owns `.env`.** The server engineer running this phase does **not** edit it.
>    Step 29's eyeball is the app engineer's job, run once at the end of the dev deploy — and this
>    whole phase is server-only, so if you are the server engineer you can skip §1.4 and Step 29
>    entirely and hand them over.
> 2. **One canonical backup, taken once, never rotated:**
>    `C:/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical`
>    (plus the already-verified pristine copy at `…/scratchpad/app.env.PRODBACKUP`). If a phase needs
>    its own marker, use `.env.backup.<phaseid>` — a **fixed** name per phase, no timestamp — and
>    **never delete a backup another phase may own.**
> 3. `head -1 .env` must read `GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1` at the
>    end of **every** working session, not just at the end of a phase. Confirmed as its current value
>    2026-08-18, with `git diff --stat -- .env` empty.

```bash
cd "c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp"

# 1. Back it up FIRST, outside the repo, to the ONE canonical path (C9). Do not
#    timestamp it and do not rotate it — a second copy breaks another phase's restore proof.
CANON="C:/Users/Pc/AppData/Local/Temp/claude/GreenBridgeApp.env.PROD.canonical"
[ -f "$CANON" ] || cp .env "$CANON"       # never overwrite an existing canonical backup
head -1 "$CANON"                          # must be the PRODUCTION url

# 2. Point at dev — this exact line, nothing else in the file changes.
sed -i 's#^GREENBIDZ_API_URL=.*#GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1#' .env
head -1 .env    # must read: GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1

# 3. EXPO_PUBLIC_* / API URL are inlined at bundle time — restart Metro with a clear cache.
npx expo start --clear
```

**Restore it the moment you finish Step 16 — this is a required step, not a courtesy:**

```bash
cd "c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp"
sed -i 's#^GREENBIDZ_API_URL=.*#GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1#' .env
head -1 .env    # must read: GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
git diff --stat .env    # must be empty — the file is back to its committed state
```

If `git diff .env` is not empty after restoring, copy the backup back over it.

### Step 5 — Confirm which DB your local backend talks to

Measuring before/after in one sitting (§3, §14) needs the backend running locally. Verify it is
on the **dev** DB before you send it a single request:

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
grep -E "^PORT=|^DB_DATABASE=|^DB_HOST=" .env
```

Verified 2026-08-18: `DB_HOST=34.44.20.223`, `DB_DATABASE=greenbidz_test`, `PORT=4000`.

- `greenbidz_test` is the **dev** DB. Good.
- `PORT=4000` is the **prod port number** on the server. Locally that is harmless, but it is the
  exact configuration that once made "prod" serve the test DB. **Never assume port 4000 ⇒ prod
  DB. Read `DB_DATABASE`.** If `DB_DATABASE` is anything other than `greenbidz_test`, **stop** and
  fix it before proceeding.
- Nothing in this phase writes to any DB. The smart-detect endpoint is analysis-only: it creates
  no listing, no draft, no row.

---

## 2. File structure

### Created

| File | Responsibility |
|---|---|
| `utils/htmlEntities.js` | One `decodeHtmlEntities(value)` helper. The single place HTML entities are decoded out of WordPress term names. Nothing else. |
| `__tests__/smartCategoryUnresolved.test.js` | S0-3a: proves the default-parent substitution is gone, that the flat-tree first-row pick is rejected, and that `category_source` is emitted. |
| `__tests__/smartCategoryUnresolvedFlagOff.test.js` | **🔒 HARD GATE.** S0-3a kill switch (§4.4 / 10g'): proves that with `SMART_CATEGORY_UNRESOLVED` **absent** the pipeline still returns `tree[0]` and `subcategories[0]` at **all five** gated call sites — i.e. that prod is genuinely unaffected until the flag is flipped. **5 tests.** A red here means the branch may not be pushed, merged, deployed, or otherwise put anywhere production can serve it. The flag-OFF path has never been executed against a running server by anyone, so this file is the only thing standing between prod and a submit-blocking regression in the shipped 1.0.3 app. |
| `__tests__/siteTypeHonestFallback.test.js` | S0-3b: proves a low-confidence guess keeps its real `site_type` and is marked `low_confidence_fallback`, and that `normalizeSiteType` no longer silently defaults to `recycle`. |
| `__tests__/categoryNameEntities.test.js` | S0-4: proves `&amp;` is decoded and that `catTokenize` stops producing the junk token `amp;`. |
| `__tests__/smartFieldHygiene.test.js` | S0-5: proves `year: null` becomes `""`, `co2_emissions: "0 kg"` becomes `""`, and `brand: "null"` is blanked. |

### Modified

| File | What changes in it |
|---|---|
| `controller/wordPressSmart.js` | S0-3a: `CATEGORY_SOURCE` constant; **`pickDefaultParent`/`pickDefaultSubcategory` KEPT** (OWNER DECISION §0.1) and all **5** fallback call sites gated on `CATEGORY_UNRESOLVED_ENABLED` (`:857`, `:871`, `:1545`, `:1576`, `:1598`); new **`isUnevidencedFirstRowPick`** + `clearCategoryPair`; `category_source` stamped in `processProductGroup`. S0-3b: vision-exception path returns `null` + a source; `resolveSiteTypeForGroup` returns and threads `source` **and Phase 1's `confidence`** (§5.2b / C5 — merged body, not Step 16b's); `site_type_source` stamped from Phase 1's `buildRoutingSignal`, **not** from a local `siteTypeSource` variable (§5.2b); the **three** `normalizeSiteType` implicit-default call sites made explicit (`:829`, `:1883`, and `smartExtractionValidator.js:151`). S0-5: prompt rules for `year`/`co2_emissions`. Plus `__TEST__` exports. |
| `services/smartExtractionValidator.js` | S0-3b: `normalizeSiteType` default `"recycle"` → `null`; `normalizeDetectedSiteType` returns a `source` and stops rewriting a low-confidence guess to `recycle`. S0-5: `normalizeYear` call site handles `null`; new `normalizeMeasurement`; `"null"`/`"undefined"` added to the placeholder set used for brand/model/country. |
| `utils/categoryCache.js` | S0-4: decode entities in `normalizeCategories` and `buildTreeFromFlatRows` so every tree the AI is shown is clean. |
| `controller/productController.js` | S0-4: decode entities in the `getCategories` (recycle) response. |

### Explicitly NOT modified

`utils/categoryCache.js:163-184` (`fetchRecycle`) — see §13. `services/groupedListingSubmitService.js`
— verified to contain **zero** references to `product_cat` / `product_category_ids`, so nothing on
the submit path matches on category *names* and decoding them is safe there.

---

## 3. Prove the problems exist first

Do this **before** any edit. It gives you the "before" numbers and it teaches you the failure.

### Step 6 — Read the recorded DEV baseline (no network needed)

The 24-photo × 3-run DEV capture behind `SCAN_FLOW_BACKEND.md` is on this machine:

```
C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/
  runA.json runB.json runC.json    24 photos × 3 runs = 72 products, `result` events recorded
  set.json                         the 24 test images + ground truth
  run.mjs                          the read-only harness (multipart → SSE → record `result`)
```

**This is a session-scoped temp directory. Copy it somewhere durable before you rely on it:**

```bash
mkdir -p /c/tmp/mm-baseline
cp -r "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/." /c/tmp/mm-baseline/
ls /c/tmp/mm-baseline/run.mjs /c/tmp/mm-baseline/set.json /c/tmp/mm-baseline/runA.json
```

If it is gone, regenerate it: `cd /c/tmp/mm-baseline && node run.mjs` (all 24 photos ->
`results.json`). `run.mjs` takes `argv[2]` = comma-separated id filter and `argv[3]` = output file.
(**Corrected in CTO review 2026-08-18:** the plan previously said an empty `argv[2]` "filters
everything out". It does not — `run.mjs:6` is `process.argv[2] ? ... : null`, so `""` is falsy and no
filter is applied. `node run.mjs "" after.json` is therefore safe and writes the named file directly.)

> ### REQUIRED HARNESS PATCH before Step 28 — CTO review, 2026-08-18
>
> `run.mjs` records a **fixed projection** of each product (`run.mjs:57-66`), and
> `category_source` / `site_type_source` are **not in it**. Re-run it unpatched after your change
> and `measure.mjs` reports `{ '(absent)': 24 }` for both — so Step 28's acceptance criterion
> ("`category_source` and `site_type_source` must be present on every product") fails for a reason
> that has nothing to do with your code. Add the two lines first:
>
> ```js
>         product_cat: d.product_cat, subcategory: d.subcategory,
>         co2: d.co2_emissions,
>         category_source: d.category_source,      // S0-3a — added 2026-08-18
>         site_type_source: d.site_type_source,    // S0-3b — added 2026-08-18
>         needs_clearer_photo: d.needs_clearer_photo,
> ```
>
> `measure.mjs` already reads `p.category_source` / `p.site_type_source`, and it reads `p.co2`
> because the harness renames `co2_emissions` -> `co2` on the way in (`run.mjs:64`) — that rename is
> correct, do not "fix" it. Patch `run.mjs` **before** the after-run; the recorded
> `runA/B/C.json` baseline files are unaffected (both fields are legitimately absent there).

Now compute the baseline. Save this as `/c/tmp/mm-baseline/measure.mjs`:

```js
// Read-only. Recomputes the four Phase-2 metrics from recorded `result` events.
// Usage: node measure.mjs runA.json runB.json runC.json
import fs from "node:fs";
const files = process.argv.slice(2);
if (!files.length) { console.error("usage: node measure.mjs <run.json...>"); process.exit(1); }

const FUZZY_MIN_SCORE = 4;
const toHint = (v) => (v == null ? "" : typeof v === "string" ? v : String(v));
const catTokenize = (t) =>
  toHint(t).toLowerCase().split(/[\s\/\-&,.()+_]+/).filter((w) => w.length > 2);

let tot = 0, unresolvedCat = 0, firstRowFlat = 0, yearNull = 0, yearReal = 0,
    co2Zero = 0, co2Real = 0, escapedName = 0, ampToken = 0;
const site = {};
const src = { category: {}, site_type: {} };

for (const f of files) {
  for (const rec of JSON.parse(fs.readFileSync(f, "utf8"))) {
    for (const p of rec.products || []) {
      tot++;
      site[p.site_type] = (site[p.site_type] || 0) + 1;
      const catId = String(p.product_cat?.id ?? "");
      if (!catId) unresolvedCat++;
      // The flat-tree first rows, hard-coded from the live trees (machines 5300, recycle 1147).
      if ((p.site_type === "machines" && catId === "5300") ||
          (p.site_type === "recycle" && catId === "1147")) firstRowFlat++;
      if (p.year === null) yearNull++;
      else if (p.year !== "" && p.year != null) yearReal++;
      if (p.co2 === "0 kg") co2Zero++;
      else if (p.co2 !== "" && p.co2 != null) co2Real++;
      const nm = String(p.product_cat?.name || "");
      if (/&(amp|lt|gt|quot|#0?39);/i.test(nm)) escapedName++;
      if (catTokenize(nm).includes("amp;")) ampToken++;
      // present only after S0-3a / S0-3b land; counted so after-runs show them
      const cs = p.category_source ?? "(absent)";
      const ss = p.site_type_source ?? "(absent)";
      src.category[cs] = (src.category[cs] || 0) + 1;
      src.site_type[ss] = (src.site_type[ss] || 0) + 1;
    }
  }
}
const pct = (n) => `${n}/${tot} = ${((100 * n) / tot).toFixed(0)}%`;
console.log("products                       ", tot);
console.log("site_type distribution         ", site);
console.log("S0-3a unresolved category      ", pct(unresolvedCat));
console.log("S0-3a flat-tree first-row pick ", pct(firstRowFlat));
console.log("S0-5  year === null (JSON null)", pct(yearNull), " real year:", pct(yearReal));
console.log('S0-5  co2 === "0 kg"           ', pct(co2Zero), " real co2 :", pct(co2Real));
console.log("S0-4  escaped category name    ", pct(escapedName), " junk 'amp;' token:", pct(ampToken));
console.log("category_source                ", src.category);
console.log("site_type_source               ", src.site_type);
```

```bash
cd /c/tmp/mm-baseline && node measure.mjs runA.json runB.json runC.json
```

**Expected output — this is the BEFORE table, measured 2026-08-18 on DEV, n = 72 products:**

```
products                        72
site_type distribution          { LabGreenbidz: 18, machines: 21, '101it': 23, recycle: 10 }
S0-3a unresolved category       0/72 = 0%
S0-3a flat-tree first-row pick  12/72 = 17%
S0-5  year === null (JSON null) 19/72 = 26%   real year: 16/72 = 22%
S0-5  co2 === "0 kg"            40/72 = 56%   real co2 : 11/72 = 15%
S0-4  escaped category name     3/72 = 4%     junk 'amp;' token: 3/72 = 4%
category_source                 { '(absent)': 72 }
site_type_source                { '(absent)': 72 }
```

Read that table. **The backend says "I don't know" about a category 0 times in 72 tries**, and
17% of the time it says "Boring & Drilling Machines" — the first row of the flat machines tree —
including on an "Alliance Control Panel", an "Industrial Plating Line", an "Industrial Screen
Printing Machine" and an "Industrial Planer". That is the problem this phase exists to fix.

### Step 7 — See the wrong answer in the repo's own capture

```bash
cd "c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp"
grep -o '"product_cat":{[^}]*}' src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt
```

**Verified output — 5 occurrences, every one identical:**

```
"product_cat":{"id":5300,"name":"Boring & Drilling Machines"}
```

One of those products is a multi-purpose **welding fixture**. This is a shipped fixture, not a
hypothesis.

### Step 8 — Confirm the tree that produces it, live and read-only

```bash
curl -s "https://greenbidz.com/wp-json/recycle_greenbidz/v1/machine-categories?v=123456&language=en" \
| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).data;
let subs=0;r.forEach(c=>subs+=(c.subcategories||c.sub_categories||[]).length);
console.log("parents",r.length,"subs",subs,"tree[0]",r[0].id,JSON.stringify(r[0].name));});'
```

**Verified 2026-08-18, HTTP 200: `parents 13 subs 0 tree[0] 5300 "Boring & Drilling Machines"`.**

`ensureSmartDetectionCategories` prefers this WordPress cache and only falls back to SQL when it
is empty (`utils/categoryCache.js:238-251`), so this — not the SQL tree — is what the runtime
uses. `pickDefaultParent` is `tree.find(has children) || tree[0]`
(`controller/wordPressSmart.js:677-684`); with zero children anywhere it returns `tree[0]`.

And confirm the recycle names:

```bash
curl -s "https://testapi.greenbidz.com/api/v1/product/category?lang=en" \
| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).data;
const e=r.filter(x=>/&(amp|lt|gt|quot);/i.test(x.name));
console.log("rows",r.length,"escaped",e.length);console.log(e.slice(0,4).map(x=>x.term_id+" :: "+x.name).join("\n"));});'
```

**Verified 2026-08-18, HTTP 200: `rows 37 escaped 18`**, e.g.
`1148 :: Construction &amp; Earthmoving Equipment`, `1281 :: Surplus &amp; Scrap Materials`.
Ids span **1147–5366**; shape is `{term_id, term_taxonomy_id, name, slug, description, thumbnail_id}`.

---

## 4. S0-3a — Let the category picker say "I don't know"

### 4.1 What the change actually is, and why it is two rules not one

`MULTI_MARKETPLACE_PLAN.md` §4.2 item 1 asks for two things. They are **not** the same fix and
only one of them is measurable on today's data. Both are in scope; keep them as separate steps.

**Rule A — take the deterministic default substitution off the shipping path.**
`pickDefaultParent` / `pickDefaultSubcategory` are called as `||` fallbacks in exactly 5 places —
`:857`, `:871`, `:1545`, `:1576`, `:1598` (all five re-confirmed 2026-08-18).
**Gate all five behind `CATEGORY_UNRESOLVED_ENABLED`. Do NOT delete the two helpers** — see the
OWNER DECISION in §0.1 and the code in §4.4 (Steps 10a'-10e'). The word "delete" survives below only
inside Step 10, which is superseded and is reasoning only.

> **Honest measurement:** Rule A alone changes **nothing** on the 72-product DEV sample — the
> LLM pick (`pickCategoryFromTree`) always returned an in-tree id, so `bestCat`/`parentFromData`
> was never null and the default was never reached. Rule A closes a latent path (it fires when
> the LLM call fails or returns junk, and `pickCategoryFromTree` returns `{id:"",name:""}` on
> exception at `:1918`). Do it anyway — but do not expect it to move the number.

**Rule B — reject the LLM's first-row pick on a flat tree.** This is where the 17% lives.
§4.1 of the plan says it exactly: *"the LLM pick itself also tends to return the first row of the
tree text it is handed, and `buildCompressedCategoryTree` emits parents in load order"*
(`utils/categoryCache.js:256-275`, verified). So on a tree with **no subcategories at all** —
where there is no more specific row to corroborate against — a pick of `tree[0]` carries no
evidence and must be treated as unresolved.

I tried three candidate rules against the recorded 72 products before choosing this one. **Do not
substitute a "better" rule without re-running this comparison** — two of the three are actively
harmful:

| Candidate rule | Blanked | Verdict |
|---|---|---|
| Corroborate **every** pick with `scoreAgainst(parent.name, slug, tokens(name+brand+model)) >= 4` | **69/72 = 96%** | **Catastrophic.** Blanks obviously-correct picks: a Zeiss microscope → "Life Sciences & Biotech (Bio)" scores **0**, because the scorer is a token-overlap counter, not a semantic matcher. Would block Submit on 96% of drafts. |
| Same, restricted to `pick === tree[0]`, with a subcategory escape hatch | 22/72 = 31% | Better, but blanks **correct** picks: "BINDER BD 53 Incubator" → "Lab Infrastructure & Essentials" › "Incubators and Growth Chambers" scores **1** (plural/singular gives `+1`, not `+3`). Tuning the scorer to fix that is guessing. |
| **`pick === tree[0]` AND the tree is flat (no subcategories anywhere)** | **12/72 = 17%** | **Chosen.** All 12 are genuine errors (L7 Alliance control panel, M4 plating line, M5 screen-printing machine, M7 planer × 3 runs each). **Zero false blanks on this sample.** |

Escape hatch, free: if the existing `findBestParent(...)` — which *does* use the description and
already thresholds at `FUZZY_MIN_SCORE` — independently lands on `tree[0]`, keep the pick. Checked
against the 12: it rescues **none of them** (best score 3), so the hatch costs nothing here while
protecting a genuine boring machine.

**What Rule B does NOT catch, stated so nobody claims otherwise:** the 101it `Components` dumping
ground (`tree[0]` = 5523 `Components`, whose only child is `GPU Accelerators` 5524) is a *nested*
tree, so it is out of Rule B's reach — 8/72 products landed there, including an AOI inspection
system and a dual-monitor-plus-keyboard lot. That is an unreachable-correct-answer problem
(plan §4.3, Decision 6 / task S0-6: taxonomy content) plus Phase-3's M-2 picker. Not this phase.

### 4.2 The contract this task adds to the wire

```
products[].data.category_source : 'ai' | 'fuzzy' | 'unresolved'
```

- `'ai'` — `pickCategoryFromTree`'s pick survived validation and Rule B, and **nothing downstream
  changed the ids**.
- `'fuzzy'` — the deterministic scorer (`findBestParent` / `findBestSubcategory`, score ≥
  `FUZZY_MIN_SCORE` = 4) **is what actually supplied the id that shipped** — whether it came through
  `fuzzyCategoryFallback` (`:1981`) or through `ensureCategoryPairForSiteType`'s `bestCat` /
  `bestSub` (`:1576`, `:1598`).
- `'unresolved'` — nothing could be justified. `product_cat` and `subcategory` are both
  `{ id: "", name: "" }`.

Three values, no more. Per integration coupling **C6** the enum is **exactly** `'ai' | 'fuzzy' |
'unresolved'` on both sides of the wire: **no `'llm'`, no `'default_parent'`** (Phase 4's earlier
four-value type is wrong and C6 corrects it to this one). Rule B's rejection reports as
`'unresolved'` — the app only needs "do not pre-fill". The reason goes to a log line, not the wire.

> **The one thing that makes this contract wrong if you skip it.** `'fuzzy'` is defined by *effect*,
> not by *which branch ran*. **Entering the `catEmpty || (!sub && cat)` branch at `:1980` is NOT
> evidence that the fuzzy scorer did anything**: that condition is true for **every** product on a
> flat tree, because a flat tree has no subcategory to fill (machines = **13 parents / 0
> subcategories**, re-measured live 2026-08-18). Labelling on branch entry would have reported
> `category_source:'fuzzy'` for **21 of the 72** DEV products (the whole `machines` bucket) whose
> parent came straight from the AI and whose ids the fuzzy scorer never touched. Step 11 therefore
> compares the ids before and after. Do not "simplify" it back.
>
> **Flag-off caveat, stated so nobody reports it as a bug.** With `SMART_CATEGORY_UNRESOLVED`
> absent, an id supplied by `pickDefaultParent` / `pickDefaultSubcategory` also changes the ids and
> so reports `'fuzzy'`. That is deliberate: the enum has no `'default_parent'` member (C6), and with
> the flag **on** — the only configuration this field is designed for — those two helpers are
> unreachable. `category_source` is a best-effort label in the flag-off configuration and an exact
> one in the flag-on configuration.

### Step 9 — Add the constant, the guard, and the clear helper

Anchor: immediately after `const FUZZY_MIN_SCORE = 4;` (line 64 on 2026-08-18). **It must be
above `export const __TEST__` (line 218)** — `__TEST__` is evaluated at module-eval time, so a
`const` declared below it would be in its TDZ and throw on import. The file's own comment at
`:235-237` says this.

```js
const FUZZY_MIN_SCORE = 4;

// S0-3a — how `product_cat`/`subcategory` were arrived at. Emitted per product as
// `data.category_source` so the client can tell "the AI picked this" from "nobody
// could pick one" and stop presenting a guess as the seller's own choice.
// 'unresolved' means product_cat AND subcategory are both {id:"",name:""}.
const CATEGORY_SOURCE = {
  AI: "ai",
  FUZZY: "fuzzy",
  UNRESOLVED: "unresolved",
};

// Kill switch. Absent or "0" restores pre-S0-3a behaviour (always ship SOME id)
// without a code deploy — `pm2 restart` is enough.
//
// MUST stay OFF on production until the app ships the searchable category sheet
// (plan §4.2 item 4 / task M-2). `categoryId` is schema-required in the app
// (GreenBridgeApp/src/features/scanner/schema.ts:23), so an empty category is a
// hard submit-blocker: without a fast picker this converts "wrong listing" into
// "abandoned listing".
const CATEGORY_UNRESOLVED_ENABLED = process.env.SMART_CATEGORY_UNRESOLVED === "1";
```

Then, directly below `findBestSubcategory` (ends line 770 on 2026-08-18) — anywhere is fine,
these are hoisted function declarations:

```js
/**
 * S0-3a Rule B — reject an LLM category pick that is just the first row of the tree.
 *
 * `buildCompressedCategoryTree` (utils/categoryCache.js:256-275) hands the model the
 * parents in load order, and the model has a measured bias toward row one: 12 of 72
 * DEV products came back as machines `tree[0]` = 5300 "Boring & Drilling Machines",
 * on an Alliance control panel, a plating line, a screen-printing machine and a
 * planer. The repo's own capture
 * (GreenBridgeApp/src/services/scanner/__tests__/fixtures/smartDetectStream.zh-hant.txt)
 * shows 5300 on a welding fixture.
 *
 * Restricted to FLAT trees (no subcategories anywhere) on purpose: on a nested tree
 * the chosen subcategory is independent evidence, and blanking there blanked correct
 * picks in testing. Escape hatch: if the deterministic scorer independently lands on
 * tree[0], the pick has evidence — keep it.
 */
function isUnevidencedFirstRowPick(data, tree) {
  if (!Array.isArray(tree) || tree.length < 2) return false;
  const first = tree[0];
  if (!first) return false;
  const pickedId = String(data?.product_cat?.id ?? "");
  if (!pickedId || pickedId !== String(first.id)) return false;

  const isFlatTree = tree.every(
    (c) => !Array.isArray(c.subcategories) || c.subcategories.length === 0
  );
  if (!isFlatTree) return false;

  // Escape hatch — the deterministic scorer agrees, independently of the model.
  const desc = (data.equipment_description || "").slice(0, 300);
  const { match } = findBestParent(
    data._parent_category_hint,
    data.name,
    data.brand,
    desc,
    tree
  );
  if (match && String(match.id) === String(first.id)) return false;

  return true;
}

/** S0-3a — the honest empty pair. Mirrors clearInvalidCategoryForSiteType's shape. */
function clearCategoryPair(data) {
  data.product_cat = { id: "", name: "" };
  data.subcategory = { id: "", name: "" };
}
```

### Step 10 — ⛔ SUPERSEDED. The five default substitutions (reasoning only — write §4.4's code)

> ## ⛔ STOP. DO NOT WRITE ANY CODE FROM STEP 10. IMPLEMENT §4.4 (STEPS 10a'-10g') INSTEAD.
>
> CTO review 2026-08-18 found that removing the substitutions *unconditionally* takes them out
> from behind `SMART_CATEGORY_UNRESOLVED`, so a blank category could ship on prod before the
> M-2 picker exists — the exact submit-blocking regression §0.1 forbids. The **OWNER DECISION
> (APPROVED 2026-08-18, §0.1)** is that both helpers **stay**, gated. §4.4 keeps them, gates all
> five call sites on the flag, and adds the flag-OFF hard-gate test.
>
> **Every one of 10a–10e below is superseded by its primed twin in §4.4.** They are retained
> because the *reasoning* is still correct and worth reading, and because deleting them would
> destroy the record of why the gate exists. Nothing between here and §4.4 is a work instruction.
>
> | Below (reasoning only) | What you actually write |
> |---|---|
> | 10a — delete both helpers | **10a'** — keep both, add the "do not add an ungated caller" comment |
> | 10b — `:857` unconditional | **10b'** — `:857` gated |
> | 10c — `:871` unconditional | **10c'** — `:871` gated |
> | 10d — `:1545` unconditional | **10d'** — `:1545` gated |
> | 10e — `:1576` + `:1598` unconditional | **10e'** — both gated |
> | *(nothing)* | **10f'** — Rule B already gated + `__TEST__` list |
> | *(nothing)* | **10g'** — 🔒 the flag-OFF HARD GATE test, 5 tests |

**⛔ 10a — SUPERSEDED BY 10a'. DO NOT DELETE ANYTHING.** *(Original intent, reversed by the OWNER
DECISION in §0.1: delete `pickDefaultParent` and `pickDefaultSubcategory` outright at lines 677–689
on 2026-08-18, on the argument that deleting rather than orphaning them makes a future
re-introduction a visible new function in review rather than a one-character `||`. That argument is
sound in the abstract and **loses** to flag-off-must-equal-today. Both functions stay.)*

The code as it stands today — **10a' keeps this exactly as it is**, so this listing is here to
identify the functions, not to delete them:

```js
function pickDefaultParent(tree) {
  if (!Array.isArray(tree) || !tree.length) return null;
  return (
    tree.find(
      (cat) => Array.isArray(cat.subcategories) && cat.subcategories.length > 0
    ) || tree[0]
  );
}

function pickDefaultSubcategory(parent) {
  if (!parent || !Array.isArray(parent.subcategories)) return null;
  return parent.subcategories[0] || null;
}
```

*(⛔ Superseded. The tombstone comment below was the original replacement. **Do not apply it.**
10a' ships a different comment — the "retained ONLY as the flag-off path" one — directly above the
functions it keeps.)*

```js
// ============================================================================
// DO NOT APPLY THIS BLOCK. Superseded by §4.4 / 10a'. It is here as the record
// of the rejected approach (delete the helpers) that the OWNER DECISION at §0.1
// reversed on 2026-08-18. Writing it re-opens the prod submit-blocker.
// ============================================================================
// S0-3a — pickDefaultParent / pickDefaultSubcategory removed on purpose.
// pickDefaultParent was `tree.find(has children) || tree[0]`; the live WordPress
// machines tree is 13 parents with ZERO subcategories, so it returned tree[0] =
// 5300 "Boring & Drilling Machines" for anything the model and the fuzzy scorer
// both failed on. pickDefaultSubcategory was `subcategories[0]`, and the app uses
// the SUBCATEGORY as the seller's category when one is present
// (GreenBridgeApp/src/features/scanner/mapSmartDetection.ts:168 —
// `categoryId = subId ?? parentId`), so a blind first-child pick became the
// listing's category. An empty pair + category_source:'unresolved' is correct.
```

**Why `pickDefaultSubcategory` is gated too, even though the plan's task line names only
`pickDefaultParent`** (this reasoning survives intact — it is why 10c'/10d'/10e' gate the
subcategory fallbacks as well)**:** `mapSmartDetection.ts:168` is `const categoryId = subId ?? parentId;`
(verified 2026-08-18, opened). A blind `subcategories[0]` therefore *becomes* the seller's category
on every nested marketplace. Leaving it **ungated** would defeat S0-3a on lab and 101it — the two
nested trees. If a reviewer disagrees, this is the separable piece: drop the gate in 10c' and 10e'
only (i.e. let the subcategory keep its first-child pick), which does not touch the parent gates.

**⛔ 10b (SUPERSEDED BY 10b') — `fuzzyCategoryFallback`, the parent fallback** (line 857 on
2026-08-18). *The `→` target below is ungated and must NOT be written; 10b' is the gated form.*

```js
  const selectedCat = bestCat || pickDefaultParent(tree);
  if (!selectedCat) return suggested;
```
→
```js
  const selectedCat = bestCat;
  if (!selectedCat) {
    // S0-3a — nothing scored >= FUZZY_MIN_SCORE. Say so instead of filing the item
    // under tree[0].
    if (CATEGORY_UNRESOLVED_ENABLED) clearCategoryPair(data);
    return suggested;
  }
```

Note the pre-existing bug this also fixes: on the old line, `return suggested` left
`data.product_cat` holding whatever the caller had already put there, which on this path is the
`{id:"",name:""}` set at `:1956` — so behaviour was accidentally right when `tree` was empty
(`:838-843`) and undefined otherwise. Now it is explicit.

**⛔ 10c (SUPERSEDED BY 10c') — `fuzzyCategoryFallback`, the subcategory fallback** (line 871).
*The `→` target below is ungated and must NOT be written; 10c' is the gated form.*

```js
    const selectedSub = bestSub || pickDefaultSubcategory(selectedCat);
```
→
```js
    const selectedSub = bestSub;
```

The two lines below it already handle `null` by writing `{ id: "", name: "" }` — no other change.

**⛔ 10d (SUPERSEDED BY 10d') — `fillSubcategoryIfNeeded`** (lines 1545–1546).
*The `→` target below deletes the fallback outright and must NOT be written; 10d' gates it instead.*

```js
  const defaultSub = pickDefaultSubcategory(parent);
  if (defaultSub) data.subcategory = { id: defaultSub.id, name: defaultSub.name };
}
```
→
```js
  // S0-3a — no evidence for any child. Leave the subcategory empty; the parent
  // stands on its own and the seller picks the leaf.
}
```

**⛔ 10e (SUPERSEDED BY 10e') — `ensureCategoryPairForSiteType`, both fallbacks** (lines 1576 and
1598). *Both `→` targets below are ungated and must NOT be written; 10e' is the gated form.*

```js
  const selectedParent = parentFromData || bestCat || pickDefaultParent(tree);
  if (!selectedParent) return;
```
→
```js
  const selectedParent = parentFromData || bestCat;
  if (!selectedParent) {
    // S0-3a — this function used to be the "always return SOME id" safety net.
    // That net is what shipped 5300 on a welding fixture. Empty is the answer.
    if (CATEGORY_UNRESOLVED_ENABLED) clearCategoryPair(data);
    return;
  }
```

and

```js
  const selectedSub = validExistingSub || bestSub || pickDefaultSubcategory(selectedParent);
```
→
```js
  const selectedSub = validExistingSub || bestSub;
```

### Step 11 — Apply Rule B and stamp `category_source` in `processProductGroup`

Anchor: `processProductGroup`. **Replace the single line
`  ensureCategoryPairForSiteType(data, treeForSite);` (line 1993 on 2026-08-18, immediately under the
`// Final safety:` comment at `:1992`)** with the block below. `const taxSuggested = await
applyTaxonomyMatching(data);` stays where it is at `:1995`.

> **The ORDER here is load-bearing and silently breaks Rule B if you get it wrong.** Rule B must run
> **after** `ensureCategoryPairForSiteType`, never before: `ensureCategoryPairForSiteType` is the
> "always return SOME id" safety net (`:1560-1602`), so a Rule-B clear placed above it is
> immediately re-filled from `bestCat` and — with the flag off — from `pickDefaultParent`. Rule B
> would then measure as a no-op and you would spend a day looking for the wrong bug. Equally, the
> `category_source` stamp must be the **last** thing that touches the ids before
> `applyTaxonomyMatching`, except for the 101it brand-clearing block at `:2001-2008`, which is
> discussed below and is correct as-is.

```js
  // Final safety: always keep category/subcategory within current site_type tree.
  // S0-3a — this is also the SECOND place the deterministic scorer can supply the
  // ids that ship (bestCat at :1576, bestSub at :1598), so it is snapshotted the
  // same way as fuzzyCategoryFallback. Without this, a product whose parent came
  // from findBestParent HERE would report category_source:'ai'.
  const beforeEnsureCat = String(data.product_cat?.id ?? "");
  const beforeEnsureSub = String(data.subcategory?.id ?? "");
  ensureCategoryPairForSiteType(data, treeForSite);
  if (
    String(data.product_cat?.id ?? "") !== beforeEnsureCat ||
    String(data.subcategory?.id ?? "") !== beforeEnsureSub
  ) {
    usedFuzzyFallback = true;
  }

  // S0-3a — Rule B: the LLM's pick is the first row of a flat tree with no
  // independent evidence. Clear it rather than shipping a confident wrong answer.
  // MUST be after ensureCategoryPairForSiteType — see the ordering note in the plan.
  if (CATEGORY_UNRESOLVED_ENABLED && isUnevidencedFirstRowPick(data, treeForSite)) {
    console.log(
      `[smartDetect][category] rejected first-row pick ${data.product_cat?.id} (${data.product_cat?.name}) for "${data.name || "?"}" on ${siteType}`
    );
    clearCategoryPair(data);
  }

  // S0-3a — how we got here, on the wire. 'fuzzy' means the deterministic scorer
  // ACTUALLY supplied the ids that shipped (see §4.2: the label is defined by
  // effect, not by which branch ran), else 'ai'. Empty pair => 'unresolved'.
  if (!data.product_cat?.id && !data.subcategory?.id) {
    data.category_source = CATEGORY_SOURCE.UNRESOLVED;
  } else if (usedFuzzyFallback) {
    data.category_source = CATEGORY_SOURCE.FUZZY;
  } else {
    data.category_source = CATEGORY_SOURCE.AI;
  }
```

`usedFuzzyFallback` needs declaring, and **it must be `let` in the function scope, not `const`
inside the branch** — the block at `:1993` above also writes to it. In the same function, the
existing block at lines 1979-1990 (`const catEmpty` at `:1979`, the `if` at `:1980`, the
`fuzzyCategoryFallback` call at `:1981` — all three re-opened 2026-08-18):

```js
  const catEmpty = !data.product_cat?.id && !data.subcategory?.id;
  if (catEmpty || (!data.subcategory?.id && data.product_cat?.id)) {
    const fuzzy = fuzzyCategoryFallback(data, treeForSite);
```
→
```js
  let usedFuzzyFallback = false;
  const catEmpty = !data.product_cat?.id && !data.subcategory?.id;
  if (catEmpty || (!data.subcategory?.id && data.product_cat?.id)) {
    // REVIEWER CORRECTION (2026-08-18): do NOT set this flag on entering the branch.
    // The branch condition `!data.subcategory?.id && data.product_cat?.id` is TRUE for
    // EVERY product on a FLAT tree (machines = 13 parents / 0 subcategories, re-measured
    // live 2026-08-18, so the subcategory is always empty), which would label 21 of the
    // 72 DEV products `category_source:'fuzzy'` — the entire machines bucket — even
    // though the AI supplied the parent and the fuzzy scorer changed nothing.
    // Set it only if fuzzyCategoryFallback actually CHANGED an id.
    const beforeCat = String(data.product_cat?.id ?? "");
    const beforeSub = String(data.subcategory?.id ?? "");
    const fuzzy = fuzzyCategoryFallback(data, treeForSite);
    usedFuzzyFallback =
      String(data.product_cat?.id ?? "") !== beforeCat ||
      String(data.subcategory?.id ?? "") !== beforeSub;
```

The remaining three lines of that block (`suggested_terms = { ...suggested_terms, ...fuzzy };`,
`fillSubcategoryIfNeeded(...)`, the revalidate) are unchanged. Note that `fillSubcategoryIfNeeded`
runs *after* the snapshot is compared, so with the flag off its first-child pick does not flip
`usedFuzzyFallback` here — it flips it at the `:1993` snapshot instead if it changed the id, which is
the flag-off caveat §4.2 documents.

The existing 101it brand-clearing block (lines 2001–2008) runs **after** this and can empty the
subcategory while leaving the parent — which is intended (`Parent category is kept.`), so
`category_source` stays `'ai'`/`'fuzzy'` there. That is correct: the parent *is* resolved. Leave
that block exactly as it is; it is the precedent this whole task generalises.

Finally extend the log line at 2015–2017 so a dev run is readable:

```js
  console.log(
    `[smartDetect] ${siteType} | ${treeForSite?.length || 0} parents, ${subCount} subs | ${data.name || "?"} → ${data.product_cat?.name || "-"} / ${data.subcategory?.name || "-"} | category_source=${data.category_source}`
  );
```

### Step 12 — Export for tests

Add to `export const __TEST__ = { ... }` (line 218). Only function declarations and consts
declared **above** line 218 may go here.

```js
export const __TEST__ = {
  // ... existing entries, unchanged ...
  isBrandUnknown,
  siteTypeUsesBrandSubcategories,
  resolveEventSink,
  // S0-3a
  CATEGORY_SOURCE,
  catTokenize,
  scoreAgainst,
  findBestParent,
  fuzzyCategoryFallback,
  fillSubcategoryIfNeeded,
  ensureCategoryPairForSiteType,
  isUnevidencedFirstRowPick,
  clearCategoryPair,
  // S0-3a kill switch (§4.4 / 10f'). Exported so a reviewer can assert the two
  // helpers still EXIST and still return tree[0] / subcategories[0]; the flag-OFF
  // suite (10g') drives them through the three gated callers instead.
  pickDefaultParent,
  pickDefaultSubcategory,
  // S0-3b
  resolveSiteTypeFromHintOnly,
  // Function declarations only — `__TEST__` is evaluated at module-eval time,
  // so a `const` declared further down (e.g. ANALYZE_LANGUAGES) would be in
  // its TDZ here and throw on import.
  buildDescriptionRule,
  buildExtractionSystemPrompt,
  buildLanguageBlocks,
};
```

`CATEGORY_SOURCE` is safe here **only because** Step 9 put it at line ~65. If you put it lower,
this import throws.

### Step 13 — Write the S0-3a test

`__tests__/smartCategoryUnresolved.test.js`:

```js
/**
 * S0-3a — the category picker is allowed to say "I don't know".
 *
 * The behaviour under test is env-gated (SMART_CATEGORY_UNRESOLVED), so this file
 * sets the flag BEFORE importing the controller: the module reads it once at
 * module-eval time.
 */
process.env.SMART_CATEGORY_UNRESOLVED = "1";

const { __TEST__ } = await import("../controller/wordPressSmart.js");
const {
  CATEGORY_SOURCE,
  fuzzyCategoryFallback,
  fillSubcategoryIfNeeded,
  ensureCategoryPairForSiteType,
  isUnevidencedFirstRowPick,
} = __TEST__;

// The live WordPress machines tree, fetched 2026-08-18: 13 parents, ZERO
// subcategories, tree[0] = 5300. Abridged to 4 parents — the shape is what matters.
const FLAT_MACHINES_TREE = [
  { id: 5300, name: "Boring & Drilling Machines", slug: "boring-drilling-machines", subcategories: [] },
  { id: 5301, name: "Grinding & Finishing", slug: "grinding-finishing", subcategories: [] },
  { id: 5316, name: "Milling Machines", slug: "milling-machines", subcategories: [] },
  { id: 5306, name: "Welding Equipment", slug: "welding-equipment", subcategories: [] },
];

// The live 101it tree shape: nested, tree[0] = 5523 Components with one child.
const NESTED_IT_TREE = [
  {
    id: 5523, name: "Components", slug: "components",
    subcategories: [{ id: 5524, name: "GPU Accelerators", slug: "gpu-accelerators" }],
  },
  {
    id: 5421, name: "Laptops & Desktops", slug: "laptops-desktops",
    subcategories: [{ id: 5422, name: "Dell", slug: "dell" }],
  },
];

describe("S0-3a: no default-parent substitution", () => {
  it("leaves the category EMPTY when nothing scores >= FUZZY_MIN_SCORE (was: tree[0])", () => {
    const data = {
      name: "SULICK",                 // no token overlap with any parent name
      brand: "",
      model: "",
      equipment_description: "An unidentified grey enclosure on castors.",
      product_cat: { id: "", name: "" },
      subcategory: { id: "", name: "" },
    };
    fuzzyCategoryFallback(data, FLAT_MACHINES_TREE);
    expect(data.product_cat).toEqual({ id: "", name: "" });
    expect(data.subcategory).toEqual({ id: "", name: "" });
    // The regression this guards: 5300 "Boring & Drilling Machines".
    expect(String(data.product_cat.id)).not.toBe("5300");
  });

  it("still returns a real pick when the scorer actually matches", () => {
    const data = {
      name: "Bridgeport Milling Machine",
      brand: "Bridgeport",
      model: "Series I",
      equipment_description: "Vertical milling machine, knee type.",
      product_cat: { id: "", name: "" },
      subcategory: { id: "", name: "" },
    };
    fuzzyCategoryFallback(data, FLAT_MACHINES_TREE);
    expect(String(data.product_cat.id)).toBe("5316");
  });

  it("ensureCategoryPairForSiteType no longer guarantees an id", () => {
    const data = {
      name: "SULICK",
      brand: "",
      model: "",
      equipment_description: "",
      product_cat: { id: "", name: "" },
      subcategory: { id: "", name: "" },
    };
    ensureCategoryPairForSiteType(data, FLAT_MACHINES_TREE);
    expect(data.product_cat).toEqual({ id: "", name: "" });
    expect(data.subcategory).toEqual({ id: "", name: "" });
  });

  it("ensureCategoryPairForSiteType keeps an id the AI already validated", () => {
    const data = {
      name: "Welding fixture",
      brand: "",
      model: "",
      equipment_description: "",
      product_cat: { id: 5306, name: "Welding Equipment" },
      subcategory: { id: "", name: "" },
    };
    ensureCategoryPairForSiteType(data, FLAT_MACHINES_TREE);
    expect(String(data.product_cat.id)).toBe("5306");
  });

  it("fillSubcategoryIfNeeded no longer picks subcategories[0] blind", () => {
    const data = {
      name: "Unidentified server chassis",
      brand: "",
      model: "",
      equipment_description: "",
      product_cat: { id: 5523, name: "Components" },
      subcategory: { id: "", name: "" },
    };
    fillSubcategoryIfNeeded(data, NESTED_IT_TREE);
    // Was: {id:5524, name:"GPU Accelerators"} — the marketplace-wide dumping ground.
    expect(data.subcategory).toEqual({ id: "", name: "" });
  });
});

describe("S0-3a Rule B: unevidenced first-row pick on a flat tree", () => {
  it("rejects 5300 on an Alliance control panel", () => {
    const data = {
      name: "Alliance Control Panel",
      brand: "Waters",
      model: "",
      equipment_description: "Control panel for an Alliance machine.",
      product_cat: { id: 5300, name: "Boring & Drilling Machines" },
      subcategory: { id: "", name: "" },
    };
    expect(isUnevidencedFirstRowPick(data, FLAT_MACHINES_TREE)).toBe(true);
  });

  it("rejects 5300 on an industrial plating line", () => {
    const data = {
      name: "Industrial Plating Line with Control Panel",
      brand: "",
      model: "",
      equipment_description: "Plating line with tanks and a control cabinet.",
      product_cat: { id: 5300, name: "Boring & Drilling Machines" },
      subcategory: { id: "", name: "" },
    };
    expect(isUnevidencedFirstRowPick(data, FLAT_MACHINES_TREE)).toBe(true);
  });

  it("KEEPS 5300 on a genuine boring machine (the scorer corroborates)", () => {
    const data = {
      name: "Radial Drilling Machine",
      brand: "Kitchen & Walker",
      model: "",
      equipment_description: "Radial arm drilling machine for boring operations.",
      product_cat: { id: 5300, name: "Boring & Drilling Machines" },
      subcategory: { id: "", name: "" },
    };
    expect(isUnevidencedFirstRowPick(data, FLAT_MACHINES_TREE)).toBe(false);
  });

  it("does NOT fire on a non-first row", () => {
    const data = {
      name: "Anything at all",
      brand: "", model: "", equipment_description: "",
      product_cat: { id: 5316, name: "Milling Machines" },
      subcategory: { id: "", name: "" },
    };
    expect(isUnevidencedFirstRowPick(data, FLAT_MACHINES_TREE)).toBe(false);
  });

  it("does NOT fire on a NESTED tree (subcategory is independent evidence)", () => {
    const data = {
      name: "NVIDIA H100 NVL PCIe GPU",
      brand: "NVIDIA", model: "H100 NVL",
      equipment_description: "Datacentre GPU accelerator card.",
      product_cat: { id: 5523, name: "Components" },
      subcategory: { id: 5524, name: "GPU Accelerators" },
    };
    expect(isUnevidencedFirstRowPick(data, NESTED_IT_TREE)).toBe(false);
  });

  it("does NOT fire on an empty pick or a 1-parent tree", () => {
    expect(isUnevidencedFirstRowPick({ product_cat: { id: "", name: "" } }, FLAT_MACHINES_TREE)).toBe(false);
    expect(isUnevidencedFirstRowPick(
      { name: "x", product_cat: { id: 5300, name: "Boring & Drilling Machines" } },
      [FLAT_MACHINES_TREE[0]]
    )).toBe(false);
  });
});

describe("S0-3a: category_source enum", () => {
  it("is exactly the three documented values", () => {
    expect(CATEGORY_SOURCE).toEqual({ AI: "ai", FUZZY: "fuzzy", UNRESOLVED: "unresolved" });
  });
});
```

Run it:

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/smartCategoryUnresolved.test.js --forceExit
```

**Expected: `1 passed, 12 tests`** (5 + 6 + 1 — the plan previously said 14). Before Step 10/11
land, the first five and the Rule-B tests
fail (the module has no `isUnevidencedFirstRowPick` export at all, so the whole suite fails to
import) — that is the point: write the test, watch it fail, then make it pass.

Top-level `await import(...)` is used because the flag must be set before module evaluation.
`jest.config.js` has `transform: {}` and the project is native ESM (`"type": "module"`), so
top-level await in a test file is supported.

---

### 4.4 REVIEWER CORRECTION — the kill switch must gate Rule A as well

**Found in CTO review, 2026-08-18. This subsection OVERRIDES Steps 10a-10e above.**

> ### OWNER DECISION — APPROVED 2026-08-18
>
> **KEEP `pickDefaultParent` and `pickDefaultSubcategory` alive, behind the
> `SMART_CATEGORY_UNRESOLVED` flag.** This reverses Step 10a's original intent to delete them.
>
> *Reason.* Deleting them means **flag-off is not identical to today**, and with the flag off — the
> prod configuration — a blank category can reach the wire. A blank category is a **hard
> submit-blocker** in the 1.0.3 build **now in Apple review**
> (`GreenBridgeApp/src/features/scanner/schema.ts:23`, opened and confirmed verbatim 2026-08-18:
> `categoryId: z.string().min(1, 'Category is required')`).
>
> *This keep is TEMPORARY.* Once the app's searchable category picker (Phase 3 / M-2) is live
> everywhere and the flag is on in every environment, **both helpers are dead code** — no call site
> can reach them. **Removing them is a separate, later change**, with its own commit and review, and
> it is out of scope here. Until then: do not delete them, and **do not add an ungated caller**.
>
> Consequence for this phase, spelled out: 10a' is not an oversight to be "cleaned up" by a later
> reader, and 10g' is the test that proves the keep actually works.

The defect: Step 9 gates only the *explicit* `clearCategoryPair(...)` calls on
`CATEGORY_UNRESOLVED_ENABLED`, while Steps 10a-10e remove the `pickDefaultParent` /
`pickDefaultSubcategory` substitutions for **everyone**. Traced through `processProductGroup`
with the flag **absent** (prod):

1. `pickCategoryFromTree` throws or returns an out-of-tree id, so `data.product_cat` is
   `{id:"",name:""}` (`:1918`, or cleared by `clearInvalidCategoryForSiteType` `:1549-1558`);
2. `fuzzyCategoryFallback` (`:833-877`) — `bestCat` is `null` because nothing scores
   `>= FUZZY_MIN_SCORE`; with Step 10b it **early-returns without setting a parent**;
3. `ensureCategoryPairForSiteType` (`:1560-1602`) — `parentFromData` is `undefined` and `bestCat`
   is `null`, so with Step 10e `selectedParent` is falsy and it **returns without setting a
   parent**;
4. the payload ships `product_cat: {id:"",name:""}` — and `categoryId` is schema-required
   (`GreenBridgeApp/src/features/scanner/schema.ts:23`), so the shipped app (no M-2 picker) hard-blocks
   Submit.

That is §0.1's forbidden outcome, reached with the flag off. On the 72-product DEV sample it happens
**0 times** (the LLM always returned an in-tree id — §4.1 Rule A), which is precisely why no test and
no measurement in this plan catches it. It fires when the vision/LLM call fails, which on prod is a
live failure mode (different vision-provider configuration; a dead-key outage has happened before).

**The fix: keep both helpers and gate every fallback on the flag, so flag-off is byte-identical to
today.** Apply the following *instead of* Steps 10a-10e.

**10a' — do NOT delete `pickDefaultParent` / `pickDefaultSubcategory`** (`:677-689`). Leave both
bodies exactly as they are and put this comment directly above `pickDefaultParent`:

```js
// S0-3a — these two are the "always ship SOME id" substitution. They are the reason
// id 5300 "Boring & Drilling Machines" shipped on a welding fixture (the live WordPress
// machines tree is 13 parents with ZERO subcategories, so `tree.find(has children) ||
// tree[0]` is always tree[0]), and pickDefaultSubcategory's blind `subcategories[0]`
// BECOMES the seller's category on the nested trees
// (GreenBridgeApp/src/features/scanner/mapSmartDetection.ts:168 — `categoryId = subId ?? parentId`).
//
// They are retained ONLY as the flag-off path: with SMART_CATEGORY_UNRESOLVED absent the
// pipeline must behave exactly as it does today, because an empty category is a hard
// submit-blocker in the shipped app until M-2 lands. Every call site below is gated on
// CATEGORY_UNRESOLVED_ENABLED. Do not add an ungated caller.
```

**10b' — `fuzzyCategoryFallback`, the parent fallback** (`:857`):

```js
  const selectedCat = bestCat || pickDefaultParent(tree);
  if (!selectedCat) return suggested;
```
becomes
```js
  // S0-3a — nothing scored >= FUZZY_MIN_SCORE. Say so instead of filing the item under
  // tree[0]. Flag off => the old substitution, byte-identical.
  const selectedCat =
    bestCat || (CATEGORY_UNRESOLVED_ENABLED ? null : pickDefaultParent(tree));
  if (!selectedCat) {
    if (hint) suggested.product_cat = [hint];
    if (CATEGORY_UNRESOLVED_ENABLED) clearCategoryPair(data);
    return suggested;
  }
```

(`if (hint) suggested.product_cat = [hint];` preserves the intent of the original `:859`, which the
early return would otherwise skip. At runtime `hint` is `""` here — `validateAndNormalizeExtraction`
already `delete`d `data._parent_category_hint` at `services/smartExtractionValidator.js:205`, and
`data.parent_category` was deleted in `extractAttributes` at `:1872` — so the line is inert today.
Keep it: `suggested_terms.product_cat[0]` is what the web reads as its category hint
(`nextjs-port/.../NewSubmissionUploadPage.tsx:1207`).)

**10c' — `fuzzyCategoryFallback`, the subcategory fallback** (`:871`):

```js
    const selectedSub = bestSub || pickDefaultSubcategory(selectedCat);
```
becomes
```js
    const selectedSub =
      bestSub || (CATEGORY_UNRESOLVED_ENABLED ? null : pickDefaultSubcategory(selectedCat));
```

**10d' — `fillSubcategoryIfNeeded`** (`:1545-1546`):

```js
  const defaultSub = pickDefaultSubcategory(parent);
  if (defaultSub) data.subcategory = { id: defaultSub.id, name: defaultSub.name };
}
```
becomes
```js
  // S0-3a — no evidence for any child. Leave the subcategory empty; the parent stands on
  // its own and the seller picks the leaf. Flag off => the old first-child pick.
  if (CATEGORY_UNRESOLVED_ENABLED) return;
  const defaultSub = pickDefaultSubcategory(parent);
  if (defaultSub) data.subcategory = { id: defaultSub.id, name: defaultSub.name };
}
```

**10e' — `ensureCategoryPairForSiteType`, both fallbacks** (`:1576` and `:1598`):

```js
  const selectedParent = parentFromData || bestCat || pickDefaultParent(tree);
  if (!selectedParent) return;
```
becomes
```js
  // S0-3a — this function used to be the "always return SOME id" safety net. That net is
  // what shipped 5300 on a welding fixture. Empty is the answer — behind the flag.
  const selectedParent =
    parentFromData || bestCat || (CATEGORY_UNRESOLVED_ENABLED ? null : pickDefaultParent(tree));
  if (!selectedParent) {
    if (CATEGORY_UNRESOLVED_ENABLED) clearCategoryPair(data);
    return;
  }
```

and

```js
  const selectedSub = validExistingSub || bestSub || pickDefaultSubcategory(selectedParent);
```
becomes
```js
  const selectedSub =
    validExistingSub ||
    bestSub ||
    (CATEGORY_UNRESOLVED_ENABLED ? null : pickDefaultSubcategory(selectedParent));
```

**10f' — Rule B is already gated** (Step 11's `if (CATEGORY_UNRESOLVED_ENABLED && isUnevidencedFirstRowPick(...))`);
leave it as written.

Also add `pickDefaultParent` and `pickDefaultSubcategory` to the Step 12 `__TEST__` export list —
**already done in Step 12's listing, so the two steps agree.** To be precise about *why*, because the
original wording here was wrong: the 10g' suite does **not** import them directly, and exporting them
is **not** required for it to pass — it drives them through the three gated callers
(`fuzzyCategoryFallback`, `ensureCategoryPairForSiteType`, `fillSubcategoryIfNeeded`), which is the
stronger test because it exercises the gate rather than the helper. They are exported so a reviewer
can assert in one line that the OWNER DECISION was honoured — that both functions still exist and
still return `tree[0]` / `subcategories[0]` — without reading the diff.

**10g' — 🔒 THE HARD GATE. The flag-OFF test that was missing.** Add a **second** test file,
`__tests__/smartCategoryUnresolvedFlagOff.test.js`. It must be its own file: the flag is read once at
module-eval time, so one process cannot hold both states. The `delete process.env.…` on the first line
is not decoration — Jest reuses a worker process across test files and `process.env` is not reset
between them, so without it `smartCategoryUnresolved.test.js` running first in the same worker would
leave the flag **on** and this suite would silently test the wrong configuration.

> ### 🔒 THE RULE
>
> **This suite is a hard gate, not a nicety. Until it is green, the branch may not be pushed,
> merged, tagged, deployed, or put anywhere production can serve it — dev included, because dev is
> what gets promoted.** The flag-OFF path has **never been executed against a running server by
> anyone**; every claim that "prod is unaffected" in this document rests on this file plus a code
> read. A red here does not mean "adjust the test"; it means the kill switch is not a kill switch and
> §0.1's forbidden outcome is reachable on prod.

> **Line numbers:** the five gate anchors below are `aabac85` numbers. Phase 1 landed as `eb073fb`
> and moved them to **`:867`, `:881`, `:1561`, `:1592`, `:1614`** — see §1.1. The *code* at each site
> is unchanged, so 10a'-10e' apply verbatim.

**It must cover all five gated call sites, not three.** The reviewer's original three assertions were
correct but exercised only `:857`, `:1576` and `:1545`; `:871` and `:1598` were never reached, because
on a flat tree there is no subcategory to fall back to and `ensureCategoryPairForSiteType` returns
early at `:1584`. Tests 4 and 5 below add a **nested** tree and close the gap:

| Test | Drives | Gated call site(s) proved |
|---|---|---|
| 1 | `fuzzyCategoryFallback` + flat tree | `:857` (`pickDefaultParent`) |
| 2 | `ensureCategoryPairForSiteType` + flat tree | `:1576` (`pickDefaultParent`) |
| 3 | `fillSubcategoryIfNeeded` + nested tree | `:1545` (`pickDefaultSubcategory`) |
| **4 (new)** | `fuzzyCategoryFallback` + nested tree | `:857` **and `:871`** (`pickDefaultSubcategory`) |
| **5 (new)** | `ensureCategoryPairForSiteType` + nested tree | `:1576` **and `:1598`** (`pickDefaultSubcategory`) |

**All five expectations below were executed against today's real, unmodified code on 2026-08-18** —
the three helpers plus everything they call (`toHintString`, `catTokenize`, `scoreAgainst`,
`findBestParent`, `findBestSubcategory`, `pickDefaultParent`, `pickDefaultSubcategory`) were extracted
verbatim from `controller/wordPressSmart.js` — ranges `:640-770`, `:833-877`, `:1525-1547`,
`:1560-1602` — and run against these exact fixtures. Observed:

```
1 fuzzy   FLAT   (:857)              cat=5300/Boring & Drilling Machines | sub=/-
2 ensure  FLAT   (:1576)             cat=5300/Boring & Drilling Machines | sub=/-
3 fillSub NESTED (:1545)             cat=5523/Components | sub=5524/GPU Accelerators
4 fuzzy   NESTED (:857+:871)         cat=5523/Components | sub=5524/GPU Accelerators
5 ensure  NESTED (:1576+:1598)       cat=5523/Components | sub=5524/GPU Accelerators
findBestParent(unmatchable, FLAT) -> null score 0     # the escape hatch does not fire
```

So these are **measured** expectations, not predicted ones. If one of them goes red, today's
behaviour changed — which is the whole point of the gate.

```js
/**
 * S0-3a kill switch — with SMART_CATEGORY_UNRESOLVED absent, behaviour must be
 * IDENTICAL to pre-S0-3a. This is the test that protects prod until M-2 ships:
 * an empty category is a hard submit-blocker in the shipped app
 * (GreenBridgeApp/src/features/scanner/schema.ts:23).
 */
delete process.env.SMART_CATEGORY_UNRESOLVED;

const { __TEST__ } = await import("../controller/wordPressSmart.js");
const { fuzzyCategoryFallback, ensureCategoryPairForSiteType, fillSubcategoryIfNeeded } = __TEST__;

const FLAT_MACHINES_TREE = [
  { id: 5300, name: "Boring & Drilling Machines", slug: "boring-drilling-machines", subcategories: [] },
  { id: 5301, name: "Grinding & Finishing", slug: "grinding-finishing", subcategories: [] },
  { id: 5316, name: "Milling Machines", slug: "milling-machines", subcategories: [] },
  { id: 5306, name: "Welding Equipment", slug: "welding-equipment", subcategories: [] },
];
const NESTED_IT_TREE = [
  { id: 5523, name: "Components", slug: "components",
    subcategories: [{ id: 5524, name: "GPU Accelerators", slug: "gpu-accelerators" }] },
];

const unmatchable = () => ({
  name: "SULICK", brand: "", model: "",
  equipment_description: "An unidentified grey enclosure on castors.",
  product_cat: { id: "", name: "" }, subcategory: { id: "", name: "" },
});

describe("S0-3a kill switch OFF: pre-S0-3a behaviour is preserved", () => {
  it("fuzzyCategoryFallback still substitutes tree[0]", () => {
    const data = unmatchable();
    fuzzyCategoryFallback(data, FLAT_MACHINES_TREE);
    expect(String(data.product_cat.id)).toBe("5300");
  });

  it("ensureCategoryPairForSiteType still guarantees an id", () => {
    const data = unmatchable();
    ensureCategoryPairForSiteType(data, FLAT_MACHINES_TREE);
    expect(String(data.product_cat.id)).toBe("5300");
  });

  it("fillSubcategoryIfNeeded still picks subcategories[0]", () => {
    const data = {
      name: "Unidentified server chassis", brand: "", model: "", equipment_description: "",
      product_cat: { id: 5523, name: "Components" }, subcategory: { id: "", name: "" },
    };
    fillSubcategoryIfNeeded(data, NESTED_IT_TREE);
    expect(String(data.subcategory.id)).toBe("5524");
  });

  // The two below are what make this a gate on ALL FIVE call sites. On a FLAT tree
  // the subcategory fallbacks (:871, :1598) are unreachable — there is no child to
  // pick and ensureCategoryPairForSiteType returns early at :1584 — so without a
  // nested tree two of the five gates ship untested.
  it("fuzzyCategoryFallback still substitutes BOTH tree[0] and subcategories[0] (:857 + :871)", () => {
    const data = unmatchable();
    fuzzyCategoryFallback(data, NESTED_IT_TREE);
    expect(String(data.product_cat.id)).toBe("5523");
    expect(String(data.subcategory.id)).toBe("5524");
  });

  it("ensureCategoryPairForSiteType still substitutes BOTH (:1576 + :1598)", () => {
    const data = unmatchable();
    ensureCategoryPairForSiteType(data, NESTED_IT_TREE);
    expect(String(data.product_cat.id)).toBe("5523");
    expect(String(data.subcategory.id)).toBe("5524");
  });
});
```

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/smartCategoryUnresolvedFlagOff.test.js --forceExit
```

**Expected: `1 passed, 5 tests`.** If **any** of the five goes red the kill switch is not a kill
switch, and **the branch must not be pushed, merged or deployed anywhere prod can reach it** — see
🔒 THE RULE above. The file is already in the Step 27 `git add` list and in the §10 verification
loop; both call it out as the gate.

**A green here proves exactly one thing, and no more:** that with the flag absent, the five `||`
substitutions still substitute. It does **not** prove the flag-off path end-to-end through a live
`processProductGroup`, because that needs a running server and a forced vision failure — see §13,
which says so plainly. This is the strongest available static proof, and it is a gate rather than a
warning precisely because the stronger proof does not exist yet.

---

## 5. S0-3b — Stop `recycle` being the silent bucket for "unknown"

### 5.1 What is true today

Four paths make `recycle` mean "we don't know" (all verified 2026-08-18):

| Path | Site | Behaviour |
|---|---|---|
| implicit default | `services/smartExtractionValidator.js:41-50` | `normalizeSiteType(value, fallback = "recycle")` |
| unmappable site type | `:291-295` | off-list string → `return { siteType: "recycle", ... }` |
| low confidence | `:298-301` | `confidence < 0.6` → **overwrites** the real guess with `recycle` |
| vision call threw | `controller/wordPressSmart.js:1636-1639` | `return { siteType: "recycle", suggested_terms: {}, confidence: 0 }` (the return itself is `:1638`) |

Measured on the 72-product DEV sample: **all 10 recycle-routed products were genuinely recycle**,
and `suggested_terms.site_type` — the only tell that the `< 0.6` rewrite fired — was present on
**0 of 72** runs. So today the destructive rewrite is *latent*, not active. It becomes active the
moment marketplaces are unlocked and four trees are in play, and `recycle` is the one marketplace
whose category ids the app cannot render at all (recycle ids 1147–5366 vs the lab tree's
5371–5849, overlap **0**).

### 5.2 The contract this task adds

```
products[].data.site_type_source : 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback'
```

Exactly the four values `MULTI_MARKETPLACE_PLAN.md` §2.3 specifies. **Do not add a fifth.**
Decisions taken so Phase 3's `SmartProductData` union does not have to change later:

- an **off-list / unmappable** site type reports `'low_confidence_fallback'` (not a new
  `'unmappable_fallback'`) — the app's rule is identical: both fallback sources ⇒ **ask**;
- a **vision-call exception** also reports `'low_confidence_fallback'`, with the operational
  `site_type` still a valid tree key so the pipeline keeps working.

> **Interface note for whoever implements S0-2 (task S0-2, plan §7 Stage 0).** S0-2 owns
> `site_type_confidence` and the `'hint'` / `'vision'` / `'regex_override'` values. This phase
> introduces the **field** `site_type_source` and populates the fallback cases, because S0-3b's
> "mark it `low_confidence_fallback`" has nowhere to land otherwise. **Before writing Step 14,
> check whether S0-2 already landed:**
> ```bash
> grep -n "site_type_source\|site_type_confidence" controller/wordPressSmart.js services/smartExtractionValidator.js
> ```
> If `site_type_source` already exists, **merge into it** — add the `low_confidence_fallback`
> branches only, and do not redeclare the enum. If it does not, add it as below. Either way this
> phase does **not** emit `site_type_confidence`; that stays S0-2's.

### 5.2b AUTHORITATIVE — the merged bodies (integration coupling C5). Write THESE.

**Added 2026-08-18 to close the integration review. This subsection replaces the conflicting code in
Steps 15, 16a, 16b and 16c. Those steps keep their reasoning; their code blocks are superseded.**

#### Why this exists

Phase 1 (S0-1 / S0-2) lands **first** on this branch, and it rewrites the **same three functions**
this phase rewrites:

| Function | Anchor (opened 2026-08-18) | Phase 1 does | Phase 2 does | Conflict |
|---|---|---|---|---|
| `normalizeDetectedSiteType` | `services/smartExtractionValidator.js:282-304` | keeps the `<0.6 -> recycle` rewrite; adds `detectedSiteType` + `lowConfidence` | **removes** the rewrite (keeps the real guess); adds `source` | direct semantic conflict |
| `detectSiteTypeForGroup`'s `catch` | `controller/wordPressSmart.js:1636-1639` | returns `siteType:'recycle', confidence:0, lowConfidence:true` | returns `siteType:null, confidence:0, source:LOW_CONFIDENCE_FALLBACK` | conflict |
| `resolveSiteTypeForGroup` | `controller/wordPressSmart.js:1657-1688` | whole body -> `{siteType, suggested_terms, confidence, source}` | whole body -> `{siteType, suggested_terms, source}` — **no `confidence`** | conflict |
| `processProductGroup` destructure / override / stamp | `:1930`, `:1942-1946`, `:2010` | via the pure `buildRoutingSignal` | via a local `siteTypeSource` variable | conflict |

**Whoever lands second wins the file, and this phase lands second.** The integration reviewer proved
that following Step 16b literally **drops `site_type_confidence` off the wire and reverts Phase 1's
S0-2** — a silent regression in another engineer's shipped work, with no test in either phase that
catches it (Phase 1's own suites assert the helper, not the stamp).

So: Phase 2 does **not** re-declare these contracts. It **adds branches to Phase 1's**. Per coupling
**C13** the enum lives in exactly one place — `SITE_TYPE_SOURCE` in
`services/smartExtractionValidator.js`, exported by this phase — and Phase 1's `buildRoutingSignal`
consumes it instead of bare strings.

#### 5.2b-pre — the mandatory grep (this is not advisory)

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"
grep -n "site_type_source\|site_type_confidence\|buildRoutingSignal\|lowConfidence\|detectedSiteType" \
  controller/wordPressSmart.js services/smartExtractionValidator.js
```

- **Hits => Phase 1 has landed.** Write §5.2b's merged bodies exactly as below. Do **not** declare
  `site_type_source` a second time and do **not** create a local `siteTypeSource`.
- **No hits => Phase 1 has NOT landed yet.** Stop and re-read the integration plan's execution order
  (§1): Phase 1 is supposed to be first, and landing this phase first inverts the conflict rather
  than removing it. If the owner has genuinely resequenced, then §5.2b's bodies are still what you
  write — they are a superset — but `buildRoutingSignal` will not exist, so keep a local
  `siteTypeSource` **and flag it in the PR as debt Phase 1 must reconcile**.

#### 5.2b-1 — `normalizeDetectedSiteType` (replaces Step 15's body)

`services/smartExtractionValidator.js:282-304`. One function, both phases' contracts. The
`SITE_TYPE_LOW_CONFIDENCE` and `SITE_TYPE_SOURCE` exports declared in Step 15 are unchanged and
still belong to this phase.

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

#### 5.2b-2 — `detectSiteTypeForGroup`'s `catch` (replaces Step 16a's body)

`controller/wordPressSmart.js:1636-1639`. Phase 2's `null` (so the hint can win) **plus** Phase 1's
flag:

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

And the **success** return at `:1628-1635` keeps Phase 1's raw-confidence passthrough and gains two
keys:

```js
    const parsed = await callOpenAIJson(messages, 220, 0);
    const normalized = normalizeDetectedSiteType(parsed);
    return {
      siteType: normalized.siteType,
      suggested_terms: normalized.suggested_terms,
      confidence:
        typeof parsed.site_type_confidence === "number"
          ? parsed.site_type_confidence
          : normalized.confidence,
      lowConfidence: normalized.lowConfidence === true,
      source: normalized.source,
    };
```

The import block is `controller/wordPressSmart.js:10-17` (see Step 16's note — `:5-9` is the
*categoryCache* import). Add both `SITE_TYPE_SOURCE` and `SITE_TYPE_LOW_CONFIDENCE` there.

#### 5.2b-3 — `resolveSiteTypeForGroup` (replaces Step 16b's body)

`controller/wordPressSmart.js:1657-1688`. Phase 2's null-handling **with `confidence` back on the
return** — that is the line Step 16b dropped:

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

Two differences from Step 16b worth naming, because they are easy to "correct" back by mistake:
`confidence` is on the return (Phase 1's S0-2 depends on it), and the weak-hint case sets
`source = HINT` and lets the single `if (lowConfidence)` line at the end demote it — instead of
Step 16b's inline ternary. One place decides the label.

#### 5.2b-4 — `processProductGroup` (replaces Step 16c)

**Phase 1's `buildRoutingSignal` is the single seam. Delete Phase 2's local `siteTypeSource`
variable entirely** — do not declare it at `:1930-1934`, do not thread it, and do not set it in the
regex-override block at `:1942-1946` (Phase 1's `buildRoutingSignal` already owns `regex_override`).
Stamp from the signal, at the existing `data.site_type = siteType;` line (`:2010`):

```js
  data.site_type = siteType;
  data.site_type_confidence = routingSignal.site_type_confidence;
  data.site_type_source = routingSignal.site_type_source;
  // (S0-3a's category_source stamp from Step 11 stays exactly as written, at :1993-1995.)
```

`site_type_confidence` is **Phase 1's field and this phase must not drop it.** §11's line "It does
not emit `site_type_confidence`" was written on the assumption that this phase landed first; with
Phase 1 first the field is already on the wire, and Step 16c's body would have silently deleted it.

#### 5.2b-5 — the two Phase 1 test assertions this phase OWNS and MUST change

> **⚠ INCOMPLETE — see §5.2b-5b immediately below.** "Two assertions" was true when this was written.
> Phase 1 then landed `__tests__/siteTypeRoutingWire.test.js` (20 tests, `aa0635b`), which pins the same
> `<0.6 → recycle` semantics **at the endpoint level** in **nine more tests / twelve more assertions**.
> The real total is **14 assertions across 11 tests**, all enumerated in §5.2b-5b.

`__tests__/siteTypeRoutingSignal.test.js` (Phase 1's suite, 19 tests). These are **legitimate
contract changes owned by Phase 2, not regressions** — S0-3b *is* the decision to stop rewriting a
low-confidence guess to `recycle`. Change them in **this** phase's PR and say in the PR body that
they are intentional:

1. `"confidence < 0.6 rewrites to recycle, flags it, and keeps the real answer"` — the site type is
   now **`machines`**, not `recycle`. Rename the test (its current title asserts the old behaviour)
   and assert `siteType === 'machines'`, `lowConfidence === true`, `confidence === 0.42`.
2. `"an off-list type is a fallback even at high confidence"` — `out.confidence` is now **`0`**, not
   `0.95`.

Do not delete either test and do not `.skip` either one. Two edited assertions, both explained.

#### 5.2b-5b ⚠ ADDED 2026-08-19 — the OTHER Phase 1 suite. **Nine more tests change, and §5.2b-5 above does not mention any of them.**

§5.2b-5 and `PHASE_INTEGRATION.md` §2 C5 were written before
**`__tests__/siteTypeRoutingWire.test.js`** existed. That suite landed with Phase 1's final commit
(`aa0635b`, 20 tests) and it pins the `<0.6 → recycle` semantics **at the endpoint level** —
`runSmartDetection`'s `products[].data` / `merged_single`, and `smartDetectProductsV2`'s SSE `product`
/ `result` events. S0-3b deliberately stops `recycle` being the silent bucket, so these assertions
**should** change. Nobody had enumerated them, which meant Phase 2's implementer would have met nine
red tests with no way to tell an intended contract change from a bug they had just introduced.

**These numbers are measured, not predicted.** On 2026-08-19 the three merged bodies of §5.2b-1 /
§5.2b-2 / §5.2b-3 were applied to the tree at `aa0635b` (with bare literals and `0.6` standing in for
the not-yet-exported `SITE_TYPE_SOURCE` / `SITE_TYPE_LOW_CONFIDENCE`) and the suites were run:

- `__tests__/siteTypeRoutingWire.test.js` → **9 failed / 11 passed / 20 total** — exactly the nine below
- `__tests__/siteTypeRoutingSignal.test.js` → the **2** §5.2b-5 already names, and only those

Both source files were then restored byte-exact (`controller/wordPressSmart.js` md5
`20f378b450369e2a2757a41f6570de93`, `services/smartExtractionValidator.js` md5
`e0a9ca92bac174f5754bc45ed3e40ee4`, `git diff` unchanged).

##### The nine tests, with the replacement assertion

| # | Test | Line | Assertion today | After S0-3b | Why the change is deliberate |
|---|---|---|---|---|---|
| 1 | *vision below 0.6: the recycle bucket is labelled, not passed off as a decision* | `:266` | `expect(data.site_type).toBe("recycle")` | **`"LabGreenbidz"`** | The hint is `machines`@0.2 and vision says `LabGreenbidz`@0.45. Today the `<0.6` branch rewrites **both** to `recycle`; S0-3b keeps the real guess. The wire now carries `LabGreenbidz`, labelled `low_confidence_fallback` at 0.45 — so the client can say *"we think LabGreenbidz, please confirm"* instead of dumping it in recycle. **This is S0-3b's entire purpose.** Rename the test — its current title asserts the old behaviour. Its other two assertions (`source`, `0.45`) stay green. |
| 2a | *an off-list site_type at high confidence is a fallback, never a confident 'hint'* | `:296` | `expect(data.site_type_confidence).toBe(0.5)` | **`0`** | §5.2b-1 sets off-list `confidence: 0` — *a named-but-unknown type is evidence of nothing*. `buildRoutingSignal`'s `<= 0.5` cap then has nothing to cap. |
| 2b | (same test) | `:297` | `expect(callsTo("siteType")).toBe(0)` | **`1`** | With the hint at confidence 0 it can no longer clear `SITE_HINT_SKIP_VISION_MIN_CONF` (0.92), so the per-group vision pass **now runs** on this path. See the decision note below — leave the `siteType` pass un-stubbed so the test keeps covering off-list **plus** a failing vision call, which is the honest worst case. |
| 3 | *the vision pass failing outright still ships an honest, low signal* | `:316` | `expect(data.site_type_confidence).toBe(0.5)` | **`0`** | The detection returns no `site_type` at all, so the hint takes the off-list branch (confidence 0) and `detectSiteTypeForGroup`'s catch returns `siteType: null`; §5.2b-3's new `if (siteType == null)` block then sets `confidence = 0`. **0 is the more honest number** — nothing was identified at all. `site_type` (`recycle`) and `source` stay green. |
| 4 | *the model returning NO products array keeps the flag: one normalization, one truth* | `:343` | `expect(data.site_type_confidence).toBe(0.5)` | **`0`** | Same cause as #3, reached through `runDetectionPass`'s synthetic-product path. The *point* of the test — one normalization, flag preserved — still holds; only the number moves. |
| 5 | *empty-products fallback also carries the low-confidence flag* | `:398` | `expect(payload.merged_single.site_type_confidence).toBe(0.5)` | **`0`** | Same cause, on the batch fallback. |
| 6a | v2 — *v2's per-group hint carries the low-confidence flag too* | `:496` | `expect(product.data.site_type_confidence).toBe(0.5)` | **`0`** | Same as #2a, through the **other** endpoint. |
| 6b | (same test) | `:497` | `expect(callsTo("siteType")).toBe(0)` | **`1`** | Same as #2b. **Change #2 and #6 together** — the two endpoints must publish the same contract, and this pair is the only test that would catch them drifting apart. |
| 7a | *wired: two same-label groups merged inside runDetectionPass keep the flag* | `:609` | `expect(detection.products[0].site_type_confidence).toBe(0.95)` | **`0.65`** | ⚠ **Read the note below — do not just change the number.** |
| 7b | (same test) | `:610` | `expect(detection.products[0].site_type_low_confidence).toBe(true)` | **`false`** | ⚠ same. |
| 8 | *each product carries site_type_low_confidence + site_type_detected* | `:694` | `expect(b.site_type).toBe("recycle")` | **`"machines"`** | The `<0.6` branch at the per-product stamp (`:2309-2334`) — the single clearest expression of the S0-3b semantic change. Its siblings (`site_type_low_confidence: true`, `site_type_detected: "machines"`) stay green, and `site_type_detected` now agrees with `site_type` instead of contradicting it. |
| 9 | *the batch-level site-type confidence and flag leave the function* | `:717` | `expect(detection.siteConfidence).toBe(0.88)` | **`0`** | Off-list → confidence 0. **This is the assertion most likely to be mistaken for broken plumbing**, because `siteConfidence` is the field Phase 1 added specifically to stop confidences being mislabelled. It is not broken: S0-3b decided a named-but-unknown type is worth 0. Put that sentence in the diff comment. |

**Totals: 9 tests, 12 assertions** in `siteTypeRoutingWire.test.js`, **plus** the 2 assertions in
`siteTypeRoutingSignal.test.js` that §5.2b-5 already names. **14 assertions across 11 tests.** Do not
delete or `.skip` any of them.

##### ⚠ #7 is not a number change — it is a behaviour change S0-3b's own text never mentions

Test 7 feeds `runDetectionPass` two same-label groups: **a** = `recycle`@0.65 (a *genuine* recycle,
≥ 0.6) and **b** = off-list `electronics`@0.95. Today b's normalized confidence is 0.95, so when
`mergeTwoDetectionGroups` (`controller/wordPressSmart.js:971-993`) merges them, b wins and its honesty
flags travel with the pair — which is exactly what the test exists to prove.

Under S0-3b, b's confidence becomes **0**. That merge helper copies the source's four site keys only
when `source.site_type_confidence` is **truthy** *and* greater than the target's:

```js
  if (
    (!target.site_type_confidence ||
      target.site_type_confidence < source.site_type_confidence) &&
    source.site_type_confidence
  ) {
```

`0` is falsy, so **b can no longer win a merge at all**, and the merged group keeps a's
`recycle`@0.65 / `lowConfidence: false`. Arguably correct — a zero-confidence guess should not beat a
0.65 one — but it is a **side effect** of §5.2b-1's `confidence: 0`, not a decision §5.2b-1 states.

**Do this, not the lazy thing.** Changing `0.95 → 0.65` and `true → false` makes the test green while
**silently deleting its coverage**: it would no longer prove that a merged group keeps the winner's
honesty flags, because there would no longer be a winner. Instead **change the fixture** so the
mechanism is still exercised — e.g. make group **b** `recycle`@0.95 (an ALLOWED type, so §5.2b-1
leaves its confidence alone) and keep asserting `0.95` / `true`; then add a *second* case asserting
the new fact that an off-list group at confidence 0 loses the merge. Same test count if you use
`test.each`; either way, say in the PR which of the two facts each case pins.

##### The eleven tests that MUST stay green — if any of these goes red, that IS a regression

| Test | Why it must survive S0-3b |
|---|---|
| *THE CONTRACT ITSELF: both fields reach `products[].data` AND `merged_single`* | S0-2's headline. Red here means Phase 2 dropped the stamp — the exact silent revert C5 exists to prevent. |
| *the fields describe the FINAL site type: a regex override ships `regex_override` at <= 0.5* | The S0-1 + S0-2 join. Red here usually means the `:2012` literal was missed in the C13 enum swap (see §1.2d(v)) and the cap stopped firing. |
| *vision decides: source `vision` carries vision's own number* | The unchanged happy path. |
| **empty-products fallback uses the SITE-TYPE confidence, not the how-many-products one** | Contract rule 1 **and** the vision-skip decision. This asserts `callsTo("siteType") === 0` with `merged_single.site_type_confidence === 0.95` for an ALLOWED type at 0.95. **It must stay green after Phase 2** — see below. |
| *v2: `product` + `result` events both carry both fields* | Both endpoints, one contract. |
| *`resolveSiteTypeForGroup` reports source `low_confidence_fallback` at confidence 0* (the catch test) | Stays green **by construction** of §5.2b-3's new `if (siteType == null)` block. **If this one goes red, you got that block wrong** — it is the cheapest signal in the suite. |
| both `mergeTwoDetectionGroups` pure tests | Pure key copying; S0-3b does not touch it. |
| all three `detectionHint` builder tests, incl. *buildBatchDetectionHint reads the SITE-TYPE confidence, not the grouping one* | Contract rule 1 at unit level. |

##### DECISION inherited from Phase 1 — the vision-skip, and what Phase 2 may and may not change

Recorded in full in Phase 1 §13.5. The short form, because Phase 2 rewrites this exact contest:

- Phase 1 decided that `buildBatchDetectionHint` passes **`detection.siteConfidence`** — the genuine
  site-type confidence — and **not** `detection.confidence`, the how-many-products number. A
  consequence is that the 0.92 hint-skip gate **can** now fire on the empty-products fallback path,
  where before S0-2 it never could (the hint carried no confidence, so it scored 0 and vision always
  ran). That is accepted: when the gate fires it is because the model's own *site-type* confidence is
  ≥ 0.92, which is the condition the gate was written for.
- **Phase 2 MAY change** how often the gate fires. It does, and legitimately: §5.2b-1's
  `confidence: 0` on the off-list branch means that branch stops skipping vision (tests #2b and #6b
  above are the record of it). Change those two assertions knowingly.
- **Phase 2 MUST NOT** re-point `buildBatchDetectionHint` at `detection.confidence`, and MUST NOT cap
  the reported confidence to force the old always-call-vision behaviour. Either would put a number
  describing the grouping decision into the field that must describe the marketplace — contract rule
  1, the thing `site_type_confidence` was created to prevent.
- **The ALLOWED-type ≥ 0.92 case must keep skipping vision** after Phase 2 lands. That is what the
  must-stay-green *empty-products fallback uses the SITE-TYPE confidence* test asserts, and it is the
  only guard on it.

#### 5.2b-6 — three assertions to add to Step 17's suite (test count stays 10)

Step 17's `siteTypeHonestFallback.test.js` stays **green unchanged** against the merged body — it
asserts a subset of the returned keys — which means it would *also* stay green if you accidentally
dropped Phase 1's two keys. Close that hole by adding expectations **inside the existing `it`
blocks** (no new `it`s, so the expected count stays `1 passed, 10 tests`):

```js
  // in "does NOT rewrite machines@0.4 to recycle"
  expect(out.detectedSiteType).toBe("machines");
  expect(out.lowConfidence).toBe(true);

  // in "marks a confident guess as vision"
  expect(out.detectedSiteType).toBe("101it");
  expect(out.lowConfidence).toBe(false);

  // in "returns recycle as the tree key but marks it a fallback with confidence 0"
  expect(out.detectedSiteType).toBeNull();
  expect(out.lowConfidence).toBe(true);
```

---

### Step 14 — Make the silent default visible (zero behaviour change)

`services/smartExtractionValidator.js:41`:

```js
export function normalizeSiteType(value, fallback = "recycle") {
```
→
```js
/**
 * S0-3b — the fallback is no longer implicit. `recycle` used to be the default for
 * every caller, which is how "we could not identify this" became indistinguishable
 * from "this is genuinely a scrap lot" on the wire. Callers now say what they want.
 */
export function normalizeSiteType(value, fallback = null) {
```

**Three** call sites rely on the implicit default (verified 2026-08-18 by grepping every caller).
Make all three explicit so behaviour is **byte-identical**:

- `services/smartExtractionValidator.js:151`
  `data.site_type = normalizeSiteType(siteType || data.site_type);`
  → `data.site_type = normalizeSiteType(siteType || data.site_type, "recycle");`
  (In `processProductGroup` `siteType` is always supplied, so this is unreachable in practice on
  the v2 path — but it is the operational last resort and must stay a valid tree key.)
- `controller/wordPressSmart.js:829` (inside `siteTypeUsesBrandSubcategories`)
  `const normalized = String(normalizeSiteType(siteType) || "").toLowerCase();`
  → `const normalized = String(normalizeSiteType(siteType, "") || "").toLowerCase();`
  (Returns `false` either way — `recycle` was never `101it`.)
- `controller/wordPressSmart.js:1883` (inside `pickCategoryFromTree`) — **the plan originally missed
  this one; CTO review 2026-08-18 found it.**
  `const cacheKey = normalizeSiteType(siteType) || String(siteType || "");`
  → `const cacheKey = normalizeSiteType(siteType, "") || String(siteType || "");`
  (Effect is nil in practice: by this point `siteType` is always one of the four allowed values, so
  `normalizeSiteType` returns it verbatim and the `||` never runs. Make it explicit anyway — with the
  new `null` default an unmappable value would otherwise fall through to the raw string as the tree
  text cache key, which is a silently different key.)

Verified callers of `normalizeSiteType`, so you can confirm nothing else moves:
`controller/wordPressSmart.js:829, :1644, :1675, :1883`;
`services/smartExtractionValidator.js:151, :285`; `services/uploadValidationService.js:416`.
(`controller/wordPressSmart.old.js:790` is a dead copy — leave it.)

### Step 15 — Preserve the real guess in `normalizeDetectedSiteType`

> **STOP — the code block in this step is SUPERSEDED by §5.2b-1.** Its `return` shapes are missing
> Phase 1's `detectedSiteType` and `lowConfidence`, so writing them as-is reverts S0-2 (integration
> coupling C5). **The two `export const` declarations below — `SITE_TYPE_LOW_CONFIDENCE` and
> `SITE_TYPE_SOURCE` — are still yours and still correct; write those.** For the function body,
> write §5.2b-1. Everything else in this step is reasoning.

`services/smartExtractionValidator.js:282-304`, whole function:

```js
export function normalizeDetectedSiteType(parsed) {
  const suggested_terms = {};
  const rawType = parsed.site_type;
  let siteType = normalizeSiteType(rawType, "");
  const confidence =
    typeof parsed.site_type_confidence === "number"
      ? Math.min(1, Math.max(0, parsed.site_type_confidence))
      : 0.75;

  if (!ALLOWED_SITE_TYPES.has(siteType)) {
    if (rawType) {
      suggested_terms.site_type = [String(rawType)];
    }
    return { siteType: "recycle", confidence, suggested_terms };
  }

  if (confidence < 0.6) {
    suggested_terms.site_type = [siteType];
    siteType = "recycle";
  }

  return { siteType, confidence, suggested_terms };
}
```
→
```js
/** S0-3b — below this, the routing is a guess the seller must confirm, not a fact. */
export const SITE_TYPE_LOW_CONFIDENCE = 0.6;

/** S0-3b — how the final site_type was arrived at. Plan §2.3's four values, no more. */
export const SITE_TYPE_SOURCE = {
  HINT: "hint",
  VISION: "vision",
  REGEX_OVERRIDE: "regex_override",
  LOW_CONFIDENCE_FALLBACK: "low_confidence_fallback",
};

/**
 * S0-3b — stop using `recycle` as the silent bucket for "unknown".
 *
 * Before: an off-list site type, or any guess under 0.6, was REWRITTEN to `recycle`
 * and the real guess was thrown into top-level suggested_terms where it lost which
 * product it belonged to (controller/wordPressSmart.js:3364). `recycle` on the wire
 * therefore meant "genuinely recycle" OR "we were unsure" — and `recycle` is the one
 * marketplace whose category ids the mobile app cannot render (zero id overlap with
 * the lab tree it fetches), so the worst-identified items went to the worst tree.
 *
 * After: the real guess survives and carries `source: 'low_confidence_fallback'`, so
 * the client can ASK instead of accepting a wrong marketplace as fact. `recycle` is
 * still returned when there is genuinely nothing mappable — the pipeline needs a
 * valid tree key — but it is now labelled.
 */
export function normalizeDetectedSiteType(parsed) {
  const suggested_terms = {};
  const rawType = parsed.site_type;
  const siteType = normalizeSiteType(rawType, "");
  const confidence =
    typeof parsed.site_type_confidence === "number"
      ? Math.min(1, Math.max(0, parsed.site_type_confidence))
      : 0.75;

  if (!ALLOWED_SITE_TYPES.has(siteType)) {
    // Nothing mappable at all. `recycle` stays as the operational tree key, but it
    // is labelled a fallback so the client asks.
    if (rawType) {
      suggested_terms.site_type = [String(rawType)];
    }
    return {
      siteType: "recycle",
      confidence: 0,
      suggested_terms,
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK,
    };
  }

  if (confidence < SITE_TYPE_LOW_CONFIDENCE) {
    // Keep the REAL guess. Do not overwrite it with `recycle`.
    suggested_terms.site_type = [siteType];
    return {
      siteType,
      confidence,
      suggested_terms,
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK,
    };
  }

  return { siteType, confidence, suggested_terms, source: SITE_TYPE_SOURCE.VISION };
}
```

### Step 16 — Fix the vision-exception path and thread `source` through

> **STOP — 16a, 16b and 16c are SUPERSEDED by §5.2b-2, §5.2b-3 and §5.2b-4.** Following 16b literally
> **drops `site_type_confidence` off the wire and reverts Phase 1's S0-2** (integration coupling C5),
> and 16c's local `siteTypeSource` variable duplicates a field Phase 1's `buildRoutingSignal` already
> owns. Read 16a-16c for the reasoning; write §5.2b. **16d is NOT superseded** — it is a
> no-change verification and still applies.

**16a — `controller/wordPressSmart.js:1636-1639`** (inside `detectSiteTypeForGroup`'s `catch`):

```js
  } catch (err) {
    console.warn("detectSiteTypeForGroup failed:", err.message);
    return { siteType: "recycle", suggested_terms: {}, confidence: 0 };
  }
```
→
```js
  } catch (err) {
    console.warn("detectSiteTypeForGroup failed:", err.message);
    // S0-3b — the vision call failed; we know NOTHING. `siteType: null` lets
    // resolveSiteTypeForGroup prefer the detection hint if one exists, and only
    // fall back to `recycle` as the operational tree key — labelled, not silent.
    return {
      siteType: null,
      suggested_terms: {},
      confidence: 0,
      source: SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK,
    };
  }
```

Also update the success return just above it (lines 1628–1635) to carry the source:

```js
    const parsed = await callOpenAIJson(messages, 220, 0);
    const normalized = normalizeDetectedSiteType(parsed);
    return {
      siteType: normalized.siteType,
      suggested_terms: normalized.suggested_terms,
      confidence:
        typeof parsed.site_type_confidence === "number"
          ? parsed.site_type_confidence
          : normalized.confidence,
      source: normalized.source,
    };
```

Add the import at the top of the file. **The `../services/smartExtractionValidator.js` import block
is `controller/wordPressSmart.js:10-17`** (verified 2026-08-18 — `:5-9` is the *categoryCache* import;
adding `SITE_TYPE_SOURCE` there throws `does not provide an export named 'SITE_TYPE_SOURCE'`):

```js
  SITE_TYPE_SOURCE,
```

**16b — `resolveSiteTypeForGroup`** (lines 1657–1688), whole function:

```js
async function resolveSiteTypeForGroup(
  materializedSubset,
  language,
  detectionHint
) {
  const hinted = resolveSiteTypeFromHintOnly(detectionHint);
  if (hinted && hinted.confidence >= SITE_HINT_SKIP_VISION_MIN_CONF) {
    return {
      siteType: hinted.siteType,
      suggested_terms: hinted.suggested_terms,
      source: SITE_TYPE_SOURCE.HINT,
    };
  }

  const fromVision = await detectSiteTypeForGroup(materializedSubset, language);
  let siteType = fromVision.siteType;
  let source = fromVision.source || SITE_TYPE_SOURCE.VISION;
  const suggested_terms = { ...(fromVision.suggested_terms || {}) };

  if (detectionHint?.site_type) {
    const fromDetection = normalizeSiteType(detectionHint.site_type, "");
    if (fromDetection && ALLOWED_SITE_TYPES.has(fromDetection)) {
      const detConf =
        typeof detectionHint.site_type_confidence === "number"
          ? detectionHint.site_type_confidence
          : 0.85;
      if (siteType == null || detConf >= fromVision.confidence) {
        siteType = fromDetection;
        // S0-3b — the hint wins. Keep the fallback label if the hint itself is weak.
        source =
          detConf < SITE_TYPE_LOW_CONFIDENCE
            ? SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK
            : SITE_TYPE_SOURCE.HINT;
      }
    }
  }

  if (siteType == null) {
    // S0-3b — vision threw AND there was no usable hint. `recycle` is the
    // operational tree key of last resort; the label says it is a guess.
    siteType = "recycle";
    source = SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK;
  }

  return { siteType, suggested_terms, source };
}
```

Note the one behavioural addition in the hint contest: `siteType == null ||` — without it, a
`null` from a thrown vision call would lose the contest against `fromVision.confidence` of `0`
and stay `null`. Import `SITE_TYPE_LOW_CONFIDENCE` alongside `SITE_TYPE_SOURCE`.

**16c — stamp it in `processProductGroup`.** Lines 1930–1946:

```js
  const { siteType: initialSite, suggested_terms: siteSuggested } =
    await resolveSiteTypeForGroup(materializedSubset, language, detectionHint);

  let siteType = initialSite;
  let suggested_terms = { ...siteSuggested };
```
→
```js
  const {
    siteType: initialSite,
    suggested_terms: siteSuggested,
    source: initialSiteSource,
  } = await resolveSiteTypeForGroup(materializedSubset, language, detectionHint);

  let siteType = initialSite;
  let siteTypeSource = initialSiteSource || SITE_TYPE_SOURCE.VISION;
  let suggested_terms = { ...siteSuggested };
```

and the regex-override block just below (lines 1942–1946):

```js
  const inferred = inferSiteTypeFromProduct(data);
  if (inferred && inferred !== siteType) {
    siteType = inferred;
    data.site_type = siteType;
    siteTypeSource = SITE_TYPE_SOURCE.REGEX_OVERRIDE;
  }
```

and at line 2010 where `data.site_type` is already stamped:

```js
  data.site_type = siteType;
  data.site_type_source = siteTypeSource;
```

**16d — the two `runDetectionPass` call sites** (`normalizeDetectedSiteType` at
**`:2124`** — `const batchSite = …` — and **`:2138`** — `const per = …`; both re-opened
2026-08-18, and note the earlier text in this step said `:2139`, which is one line low) now receive
`source`, `detectedSiteType` and `lowConfidence` in the returned object. They already destructure only
what they use (`.siteType`, `.confidence`, `.suggested_terms`), so **no change is required** — the
extra keys are ignored. Verify with:

```bash
grep -n "batchSite\.\|per\." controller/wordPressSmart.js
```

Confirm nothing does `Object.keys` / spread over those objects into the wire payload.

### 5.3 ⚠️ Web regression check — required before this could ever go to prod

`MULTI_MARKETPLACE_PLAN.md` §8.1 flags that S0-3b changes what the **web** smart-upload sees.
It does. There are **three** web consumers of this payload, not one — the plan names none of
them, so here they are, verified:

| Consumer | File | What it does with `site_type` |
|---|---|---|
| **101lab.co storefront** | `nextjs-port/src/features/seller/pages/new-submission-upload/utils/mapAiToForm.ts:128, :137-139` | `siteType: coerceTrimmed(data.site_type) || SITE_TYPE`, then `marketplace: marketplaceFromSiteType(...)` |
| same, review screen | `nextjs-port/.../components/ReviewSubmitScreen.tsx:311-321` | **Force-overrides** `marketplace` to `marketplaceFromSiteType(SITE_TYPE)` in a `useEffect`, "regardless of what the AI suggested" |
| same, grouped editor | `nextjs-port/.../components/grouped-review/GroupedProductItemStep.tsx:215` | same `lockedMarketplace` pattern |
| **Legacy Vite SPA** | `GreenBridgeSeller/src/pages/new-submission-upload/utils/analyzeSmartDetection.ts` + the same `mapAiToForm`/`ReviewSubmitScreen` pair | same |
| **Admin create-on-behalf wizard** | `admin-panel/src/features/admin/pages/agent/create-listing/wizard/AdminAiUpload.tsx:155, :222, :233` | comments read *"Override the AI's guessed site_type with the admin's chosen marketplace"* |

**Conclusion from the code read: the marketplace *field* is overridden on all three web
consumers, so S0-3b cannot mis-route a web listing.** What it *does* change on web is
second-order and must still be checked: `site_type` selects the **server-side category tree** the
AI picks inside (`ensureSmartDetectionCategories`, `wordPressSmart.js:1948`), so a preserved
`machines` guess (instead of a rewritten `recycle`) yields `product_cat` ids from a different
tree, and the web then loads its env site's tree.

The web already handles that gracefully — verified:

```ts
// nextjs-port/.../utils/applyAiCategoryFromResponse.ts:38-43
return { parentCategoryId: "", parentCategoryName: "", categoryId: "", categoryName: "" };
```

An unresolvable / absent `product_cat` yields empty strings, not a crash. **That is also the S0-3a
web regression answer: the web is already safe against a blank category.**

**Run this check anyway, on dev, before anyone proposes a prod flip:**

1. Backend on your machine or on dev, flags on.
2. `cd nextjs-port && npm run dev` — it proxies to the backend via `/proxy-api`.
3. Go to the seller smart-upload, upload the two DEV images that reproduce the failures:
   - `set.json` id **L7** (Waters Alliance control panel — routes to `machines`, picks 5300)
   - `set.json` id **M4** (glass tempering / plating line — routes to `machines`, picks 5300)
4. Assert, on the review screen:
   - marketplace is still the deployment's site (unchanged by the AI) — that is `ReviewSubmitScreen.tsx:311-321` doing its job;
   - the Category field is **empty** and flagged as required, **not** silently "Boring & Drilling Machines";
   - no console error, and the page does not get stuck in a loading state.
5. Repeat once in `admin-panel` (`npm run dev`, Agent → Create listing on behalf) to confirm the
   wizard's marketplace override still wins and its category step renders with an empty pick.
6. Confirm nothing on the submit path matches on category *names*:
   ```bash
   grep -rn "product_cat\|product_category_ids" services/groupedListingSubmitService.js
   ```
   **Verified 2026-08-18: zero matches.** If that ever returns hits, re-check S0-4 too.

**Do not submit a listing during this check** — it is a review-screen assertion only. (Plan
release gate 3's one mixed DEV submit is a separate, later step and is not part of Phase 2.)

### Step 17 — Write the S0-3b test

`__tests__/siteTypeHonestFallback.test.js`:

```js
import {
  normalizeSiteType,
  normalizeDetectedSiteType,
  SITE_TYPE_SOURCE,
  SITE_TYPE_LOW_CONFIDENCE,
} from "../services/smartExtractionValidator.js";

describe("S0-3b: normalizeSiteType no longer defaults silently to recycle", () => {
  it("returns null for an unmappable value when no fallback is given", () => {
    expect(normalizeSiteType("kitchen appliances")).toBeNull();
    expect(normalizeSiteType("")).toBeNull();
    expect(normalizeSiteType(undefined)).toBeNull();
  });

  it("still honours an explicit fallback (the operational last resort)", () => {
    expect(normalizeSiteType("kitchen appliances", "recycle")).toBe("recycle");
    expect(normalizeSiteType("kitchen appliances", "")).toBe("");
  });

  it("maps the four real site types unchanged", () => {
    expect(normalizeSiteType("LabGreenbidz")).toBe("LabGreenbidz");
    expect(normalizeSiteType("machines")).toBe("machines");
    expect(normalizeSiteType("101it")).toBe("101it");
    expect(normalizeSiteType("recycle")).toBe("recycle");
    expect(normalizeSiteType("some lab thing")).toBe("LabGreenbidz");
    expect(normalizeSiteType("machine tools")).toBe("machines");
  });
});

describe("S0-3b: a low-confidence guess keeps its real site_type", () => {
  it("does NOT rewrite machines@0.4 to recycle", () => {
    const out = normalizeDetectedSiteType({
      site_type: "machines",
      site_type_confidence: 0.4,
    });
    expect(out.siteType).toBe("machines");          // was: "recycle"
    expect(out.confidence).toBe(0.4);
    expect(out.source).toBe(SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK);
    // The real guess is still surfaced for the legacy suggested_terms consumer.
    expect(out.suggested_terms.site_type).toEqual(["machines"]);
  });

  it("does NOT rewrite LabGreenbidz@0.1 to recycle", () => {
    const out = normalizeDetectedSiteType({
      site_type: "LabGreenbidz",
      site_type_confidence: 0.1,
    });
    expect(out.siteType).toBe("LabGreenbidz");
    expect(out.source).toBe(SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK);
  });

  it("marks a confident guess as vision", () => {
    const out = normalizeDetectedSiteType({
      site_type: "101it",
      site_type_confidence: 0.93,
    });
    expect(out.siteType).toBe("101it");
    expect(out.source).toBe(SITE_TYPE_SOURCE.VISION);
    expect(out.suggested_terms.site_type).toBeUndefined();
  });

  it("uses the documented 0.6 boundary, inclusive above", () => {
    expect(SITE_TYPE_LOW_CONFIDENCE).toBe(0.6);
    expect(normalizeDetectedSiteType({ site_type: "machines", site_type_confidence: 0.6 }).source)
      .toBe(SITE_TYPE_SOURCE.VISION);
    expect(normalizeDetectedSiteType({ site_type: "machines", site_type_confidence: 0.59 }).source)
      .toBe(SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK);
  });

  it("defaults a missing confidence to 0.75 => vision, as before", () => {
    const out = normalizeDetectedSiteType({ site_type: "machines" });
    expect(out.confidence).toBe(0.75);
    expect(out.source).toBe(SITE_TYPE_SOURCE.VISION);
  });
});

describe("S0-3b: an off-list site type is labelled, not disguised", () => {
  it("returns recycle as the tree key but marks it a fallback with confidence 0", () => {
    const out = normalizeDetectedSiteType({
      site_type: "furniture",
      site_type_confidence: 0.9,
    });
    expect(out.siteType).toBe("recycle");
    expect(out.confidence).toBe(0);
    expect(out.source).toBe(SITE_TYPE_SOURCE.LOW_CONFIDENCE_FALLBACK);
    expect(out.suggested_terms.site_type).toEqual(["furniture"]);
  });
});

describe("S0-3b: the source enum is exactly plan §2.3's four values", () => {
  it("has no fifth member", () => {
    expect(SITE_TYPE_SOURCE).toEqual({
      HINT: "hint",
      VISION: "vision",
      REGEX_OVERRIDE: "regex_override",
      LOW_CONFIDENCE_FALLBACK: "low_confidence_fallback",
    });
  });
});
```

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/siteTypeHonestFallback.test.js --forceExit
```

**Expected: `1 passed, 10 tests`** (3 + 5 + 1 + 1 — the plan previously said 12). Run it *before*
Step 14/15 to watch the "does NOT rewrite
machines@0.4 to recycle" case fail with `Expected "machines", received "recycle"` — that failure
is the bug.

---

## 6. S0-4 — HTML-unescape recycle category names

### 6.1 What is broken and where

Verified 2026-08-18 against dev (`https://testapi.greenbidz.com/api/v1/product/category?lang=en`,
HTTP 200): **18 of 37** names carry HTML entities. `controller/productController.js:244-290`
selects `t.name` straight out of `jos_terms` and returns the rows verbatim
(`:284-286`). The WordPress-fetched trees (lab / machines / 101it) are **not** affected — WP's
REST layer decodes them; the live machines tree came back with `escaped names: none`. It is the
SQL read path only.

Two consumers, both of which need the clean value:

1. **The public endpoint** → the mobile app's category picker (Phase 3 M-1) and the web's.
2. **The AI's own category tree.** `loadSqlCatalog` → `fetchTaxonomyTreeFromDb` also reads
   `t.name` raw (`utils/categoryCache.js:93-99`), and that tree is what
   `buildCompressedCategoryTree` shows the model. It also feeds `catTokenize`, which splits on
   `&` and keeps tokens longer than 2 characters — **proven by running the real function**:

   ```
   catTokenize("Surplus &amp; Scrap")                     → ["surplus","amp;","scrap"]
   catTokenize("Construction &amp; Earthmoving Equipment") → ["construction","amp;","earthmoving","equipment"]
   catTokenize("Construction & Earthmoving Equipment")     → ["construction","earthmoving","equipment"]
   ```

   Every escaped recycle name contributes a junk `amp;` token to `scoreAgainst`, and 3 of 72 DEV
   products shipped `product_cat.name = "Surplus &amp; Scrap Materials"` (id 1281) to the client.

### Step 18 — Create `utils/htmlEntities.js`

```js
/**
 * Decode the HTML entities WordPress stores inside taxonomy term names.
 *
 * `jos_terms.name` holds the ENCODED form — verified 2026-08-18: 18 of the 37 rows
 * returned by GET /api/v1/product/category?lang=en carry entities, e.g.
 * "Construction &amp; Earthmoving Equipment". The WP REST endpoints (lab / machines /
 * 101it) decode on their way out; only the SQL read paths in this repo do not.
 *
 * Left un-decoded, the entities (a) render literally in every client's category
 * picker and (b) poison the deterministic category scorer: catTokenize()
 * (controller/wordPressSmart.js:652-657) splits on "&" and keeps words longer than
 * two characters, so "Surplus &amp; Scrap" tokenizes to
 * ["surplus","amp;","scrap"] — a junk token in every comparison.
 *
 * Scope note: this decodes for READ only. Nothing here writes term names back, and
 * the submit path matches on category IDs, not names (verified: zero product_cat /
 * product_category_ids references in services/groupedListingSubmitService.js).
 *
 * Mirrors the inline chains already in services/batchService.js:1471, :1655, :4287 —
 * this is their single home.
 */
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

export function decodeHtmlEntities(value) {
  if (value == null) return value;
  const str = String(value);
  if (!str.includes("&")) return str;
  return str.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z][a-zA-Z0-9]*));/g,
    (whole, hex, dec, name) => {
      if (hex) {
        const cp = Number.parseInt(hex, 16);
        return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : whole;
      }
      if (dec) {
        const cp = Number.parseInt(dec, 10);
        return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : whole;
      }
      const lower = String(name).toLowerCase();
      // `&amp;amp;` is real in WP data — decode `&amp;` LAST so we do not
      // create a new entity out of the remainder. Handled by re-running below.
      return Object.prototype.hasOwnProperty.call(NAMED, lower)
        ? NAMED[lower]
        : whole;
    }
  );
}

/** Decode repeatedly for double-encoded values ("&amp;amp;" → "&"). Bounded. */
export function decodeHtmlEntitiesDeep(value, maxPasses = 3) {
  let out = value == null ? value : String(value);
  for (let i = 0; i < maxPasses; i++) {
    const next = decodeHtmlEntities(out);
    if (next === out) break;
    out = next;
  }
  return out;
}
```

### Step 19 — Decode in the recycle endpoint

`controller/productController.js` — add the import beside the existing ones and decode the rows
before responding. Anchor: `getCategories`, the `sequelize.query` result at `:280-286`.

```js
import { decodeHtmlEntitiesDeep } from "../utils/htmlEntities.js";
```

```js
    // Pass lang safely as a parameter
    const [rows] = await sequelize.query(sql, {
      replacements: [lang],
    });

    // S0-4 — jos_terms.name stores the HTML-ENCODED form (18 of 37 recycle rows on
    // 2026-08-18, e.g. "Construction &amp; Earthmoving Equipment"). Decode here so
    // every client — mobile picker, web picker, AI tree — gets the real name.
    const decoded = rows.map((r) => ({
      ...r,
      name: decodeHtmlEntitiesDeep(r.name),
      description: decodeHtmlEntitiesDeep(r.description),
    }));

    return res.status(200).json(
      Response.success("Categories fetched successfully", decoded)
    );
```

### Step 20 — Decode in every tree the AI is shown

`utils/categoryCache.js` — add the import, then decode in the two normalisers.

```js
import { decodeHtmlEntitiesDeep } from "./htmlEntities.js";
```

`normalizeCategories` (`:37-48`) — covers the WP trees. They are already clean today, so this is
idempotent insurance:

```js
function normalizeCategories(raw) {
  return (raw || []).map((cat) => ({
    id: cat.id,
    name: decodeHtmlEntitiesDeep(cat.name),
    slug: cat.slug || "",
    subcategories: (cat.subcategories || cat.sub_categories || []).map((s) => ({
      id: s.id,
      name: decodeHtmlEntitiesDeep(s.name),
      slug: s.slug || "",
    })),
  }));
}
```

`buildTreeFromFlatRows` (`:50-84`) — covers **every** SQL tree, which is where the escaped recycle
and machines names come from. Two places, both taking `row.name` / `node.name`:

```js
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      // S0-4 — jos_terms.name is HTML-encoded; decode before it reaches the AI's
      // compressed tree text and catTokenize().
      name: decodeHtmlEntitiesDeep(row.name),
      slug: row.slug || "",
      site_type: row.site_type,
      subcategories: [],
    });
  }
```

The `parent.subcategories.push({ id: node.id, name: node.name, slug: node.slug })` at `:72-76`
already reads the decoded `node.name`, so no second edit is needed there. Confirm by reading it.

### Step 21 — Write the S0-4 test

`__tests__/categoryNameEntities.test.js`:

```js
import { decodeHtmlEntities, decodeHtmlEntitiesDeep } from "../utils/htmlEntities.js";
import { __TEST__ } from "../controller/wordPressSmart.js";

const { catTokenize, scoreAgainst } = __TEST__;

describe("S0-4: decodeHtmlEntities", () => {
  // The real strings, copied from GET /api/v1/product/category?lang=en on 2026-08-18.
  it.each([
    ["Construction &amp; Earthmoving Equipment", "Construction & Earthmoving Equipment"],
    ["Shop &amp; Maintenance Tools", "Shop & Maintenance Tools"],
    ["Test &amp; Measurement Equipment", "Test & Measurement Equipment"],
    ["Industrial Equipment, Parts &amp; Systems", "Industrial Equipment, Parts & Systems"],
    ["IT &amp; Data Center Equipment", "IT & Data Center Equipment"],
    ["Surplus &amp; Scrap Materials", "Surplus & Scrap Materials"],
    ["Lathes (CNC &amp; Conventional)", "Lathes (CNC & Conventional)"],
    ["Laser &amp; Plasma Cutting", "Laser & Plasma Cutting"],
  ])("decodes %p", (input, expected) => {
    expect(decodeHtmlEntities(input)).toBe(expected);
  });

  it("leaves clean names untouched", () => {
    expect(decodeHtmlEntities("Material Handling Equipment")).toBe("Material Handling Equipment");
    expect(decodeHtmlEntities("Metalworking Equipment")).toBe("Metalworking Equipment");
    expect(decodeHtmlEntities("Others")).toBe("Others");
  });

  it("handles the other entities WP emits", () => {
    expect(decodeHtmlEntities("Bob&#039;s Tools")).toBe("Bob's Tools");
    expect(decodeHtmlEntities("A &lt;B&gt; C")).toBe("A <B> C");
    expect(decodeHtmlEntities("&quot;Used&quot;")).toBe('"Used"');
  });

  it("leaves non-entities and CJK alone", () => {
    expect(decodeHtmlEntities("R&D Equipment")).toBe("R&D Equipment");
    expect(decodeHtmlEntities("車床 (CNC 與傳統)")).toBe("車床 (CNC 與傳統)");
  });

  it("is null/undefined safe", () => {
    expect(decodeHtmlEntities(null)).toBeNull();
    expect(decodeHtmlEntities(undefined)).toBeUndefined();
  });

  it("decodeHtmlEntitiesDeep handles double encoding", () => {
    expect(decodeHtmlEntitiesDeep("Surplus &amp;amp; Scrap")).toBe("Surplus & Scrap");
  });
});

describe("S0-4: the junk 'amp;' token is gone from the category scorer", () => {
  it("catTokenize produced 'amp;' before decoding — proof of the defect", () => {
    expect(catTokenize("Surplus &amp; Scrap")).toEqual(["surplus", "amp;", "scrap"]);
  });

  it("and does not after decoding", () => {
    expect(catTokenize(decodeHtmlEntities("Surplus &amp; Scrap")))
      .toEqual(["surplus", "scrap"]);
    expect(catTokenize(decodeHtmlEntities("Construction &amp; Earthmoving Equipment")))
      .toEqual(["construction", "earthmoving", "equipment"]);
  });

  it("scoreAgainst no longer credits a bogus 'amp' overlap", () => {
    // REVIEWER CORRECTION (2026-08-18): the original fixture used
    // catTokenize("amplifier module") and asserted escaped > clean. EXECUTED: both score
    // 0, so the assertion failed. `"amplifier".includes("amp;")` is FALSE — the junk token
    // carries the semicolon. The junk token only scores against a token that IS "amp"
    // (e.g. an "AMP meter" panel), which is the real-world collision.
    const tokens = catTokenize("AMP meter panel");   // -> ["amp","meter","panel"]
    const escaped = scoreAgainst("Surplus &amp; Scrap", "surplus-scrap", tokens);
    const clean = scoreAgainst(decodeHtmlEntities("Surplus &amp; Scrap"), "surplus-scrap", tokens);
    expect(escaped).toBe(1);   // "amp;".includes("amp") -> +1
    expect(clean).toBe(0);
    expect(escaped).toBeGreaterThan(clean);
  });
});
```

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/categoryNameEntities.test.js --forceExit
```

**Expected: `1 passed, 16 tests`** (8 `it.each` rows + 5 + 3 — the plan previously said 19).
The `scoreAgainst` case is the concrete harm: a product whose text contains the token `amp`
(an "AMP meter" panel) partial-matches the junk token `amp;` and scores a point against a
scrap-materials category. Note it is **only** the bare token `amp` — `"amplifier".includes("amp;")`
is false, so the harm is narrower than "any word starting with amp".

### Step 22 — Verify the endpoint, live on dev

After deploying to dev (§7 Step 27):

```bash
curl -s "https://testapi.greenbidz.com/api/v1/product/category?lang=en" \
| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).data;
const e=r.filter(x=>/&(amp|lt|gt|quot|#0?39);/i.test(x.name));
console.log("rows",r.length,"still escaped",e.length);
console.log(r.filter(x=>x.name.includes("&")).slice(0,5).map(x=>x.term_id+" :: "+x.name).join("\n"));});'
```

**Before: `rows 37 still escaped 18`. After: `rows 37 still escaped 0`**, and the `&`-containing
names read `Construction & Earthmoving Equipment`, `Surplus & Scrap Materials`, etc.

---

## 7. S0-5 — Field hygiene: `year` and `co2_emissions`

### 7.1 The real root causes (one of them is not what the audit said)

**`year` — the audit's description is wrong; the bug is real but different.**
`SCAN_FLOW_BACKEND.md:444` says *"emitted as the literal string `"null"`"*. It is not. Proven two
ways:

1. From the recorded DEV runs — `p.year === null` with `typeof "object"` on **19 of 72** products
   (L7, M2, M4, M7, I6, R1–R4 …). Never the string `"null"`.
2. From the code. `services/smartExtractionValidator.js:190-196` is:

   ```js
   const year = normalizeYear(data.year);
   if (year) data.year = year;
   else if (data.year) {
     suggested_terms.year = suggested_terms.year || [];
     suggested_terms.year.push(String(data.year));
     data.year = "";
   }
   ```

   Executed for each input (verified by running `normalizeYear`'s exact body):

   | `data.year` in | `normalizeYear` | `else if (data.year)` | `data.year` out |
   |---|---|---|---|
   | `"null"` (string) | `""` | truthy → runs | `""` ✅ |
   | `null` (JSON null) | `""` | **falsy → skipped** | **`null` ← the bug** |
   | `undefined` | `""` | falsy → skipped | `undefined` |
   | `"2019"` | `"2019"` | — | `"2019"` ✅ |

   So a JSON `null` from the model is never blanked and serialises straight onto the wire.
   A harness or reader that stringifies it prints `"null"` — which is how the audit saw it.

   The mobile app is already immune (`mapSmartDetection.ts:21-26` `coerceTrimmed` returns `''`
   for `null`), so this is a **wire-contract** fix that matters most for the web
   (`nextjs-port/.../mapAiToForm.ts:132` also uses a `coerceTrimmed`, so also defended) and for
   any future consumer. Fix it because the contract should not carry `null` where it documents a
   string, not because a screen is broken today.

   Contributing cause, verified: the extraction prompt (`controller/wordPressSmart.js:552-593`)
   lists `year` in the key list at `:561` and then gives it **no rule at all** — unlike `price`,
   `co2_emissions`, `weight`, `dimensions`, `prices` and `market_metrics`, which all have one.

**`co2_emissions` — never normalised anywhere.** Grep confirms the only occurrences of
`co2_emissions` in live code are the three prompt key-lists
(`controller/wordPress.js:354`, `controller/wordPressSmart.js:561`,
`controller/wordPressSmart.old.js:126`). Nothing validates it. So the model's value reaches the
client verbatim, and the prompt actively invites the placeholder:

```
// controller/wordPressSmart.js:570  (verified)
CO₂ Emissions: vehicles use numeric + "g/km"; other equipment use numeric + "kg". Never "N/A" unless truly zero.
```

Measured: `"0 kg"` on **40 of 72** products (56%); a real value on 11/72 (15%).

**Bonus, verified while checking this:** the placeholder set the identity fields are cleaned
against — `UNKNOWN_BRAND_VALUES` (`controller/wordPressSmart.js:772-790`) — contains `""`,
`unknown`, `n/a`, `na`, `none`, `no brand`, `nobrand`, `generic`, `unbranded`, `unidentified`,
`not specified`, `unspecified`, `not applicable`, `-`, `--` — but **not `null` or `undefined`**.
So `brand: "null"` survives `blankIfPlaceholder` and reaches the seller's form. Two lines to fix.

### Step 23 — Add `normalizeMeasurement` and fix the year branch

`services/smartExtractionValidator.js` — after `normalizeYear` (ends line 87):

```js
/**
 * S0-5 — placeholder measurements the vision model emits when it does not know.
 * "0 kg" was returned on 40 of 72 DEV products (56%) — a placeholder dressed as a
 * measurement. An empty string is honest; a fabricated zero is not.
 *
 * Returns "" for: empty, a bare unit, a placeholder word, or a numeric part of zero.
 * Otherwise returns the trimmed original (unit text preserved verbatim).
 */
const MEASUREMENT_PLACEHOLDERS = new Set([
  "",
  "null",
  "undefined",
  "n/a",
  "na",
  "none",
  "nil",
  "unknown",
  "not specified",
  "unspecified",
  "not applicable",
  "-",
  "--",
]);

export function normalizeMeasurement(value) {
  if (value == null) return "";
  const raw = String(value).trim();
  if (MEASUREMENT_PLACEHOLDERS.has(raw.toLowerCase())) return "";
  // A value whose numeric part is zero ("0 kg", "0kg", "0 g/km", "0.0 kg") carries
  // no information. Blank it. A unit with no number at all ("kg") is blanked too.
  const num = raw.match(/-?\d+(?:[.,]\d+)?/);
  if (!num) return "";
  if (Number.parseFloat(num[0].replace(",", ".")) === 0) return "";
  return raw;
}
```

Then fix the year branch (`:190-196`) and add the CO₂ call in the same function:

```js
  // S0-5 — `normalizeYear(null)` returns "" but the old `else if (data.year)` guard
  // was FALSY for null, so JSON null was left in place and serialised onto the wire
  // on 19 of 72 DEV products. Compare against the normalized value, not truthiness.
  const year = normalizeYear(data.year);
  if (year) {
    data.year = year;
  } else {
    if (data.year != null && data.year !== "") {
      suggested_terms.year = suggested_terms.year || [];
      suggested_terms.year.push(String(data.year));
    }
    data.year = "";
  }

  // S0-5 — co2_emissions was never validated at all. "0 kg" is a placeholder, not a
  // measurement (40 of 72 DEV products). Keep the real value; blank the placeholder.
  const co2 = normalizeMeasurement(data.co2_emissions);
  if (co2 !== String(data.co2_emissions ?? "").trim()) {
    if (data.co2_emissions != null && String(data.co2_emissions).trim() !== "") {
      suggested_terms.co2_emissions = suggested_terms.co2_emissions || [];
      suggested_terms.co2_emissions.push(String(data.co2_emissions));
    }
  }
  data.co2_emissions = co2;
```

`suggested_terms` is the existing mechanism for "the model said X and we rejected it" — the same
shape `condition`, `grade`, `price` and `year` already use (`:153-196`). Keeping the rejected value
there means nothing is silently lost.

### Step 24 — Close the `"null"` gap in the identity placeholder set

`controller/wordPressSmart.js:772-790`, inside `UNKNOWN_BRAND_VALUES`:

```js
  "not applicable",
  // S0-5 — the model emits these as literal text; without them a brand of "null"
  // reaches the seller's form via blankIfPlaceholder (:798-800).
  "null",
  "undefined",
  "nil",
  "-",
  "--",
]);
```

Do **not** add `"0"` — a `0` is a legitimate value elsewhere and `isBrandUnknown` is also used by
`siteTypeUsesBrandSubcategories`'s sibling checks.

### Step 25 — Tell the model what to do, so the normaliser is a backstop not a mop

`controller/wordPressSmart.js` — **replace lines 570-571** (the CO₂ rule *and* the existing
`For weight:` line, which is reproduced verbatim in the block below so it is not duplicated) and add
the missing `year` rule:

```js
CO₂ Emissions: only when you can actually determine it — vehicles use numeric + "g/km", other equipment numeric + "kg". If you cannot determine it, return an EMPTY STRING "". NEVER return "0 kg", "N/A", or "unknown" — an empty string is correct and expected.
year: four-digit year of manufacture ONLY when it is legible on a plate/label or unambiguous from the model. Otherwise return an EMPTY STRING "". Never return null, "null", 0, or a guess.
For weight: numeric + unit (e.g. "1200 kg"). For dimensions: "L x W x H unit".
```

This is a prompt change, so its effect is not deterministic. **The normaliser in Step 23 is the
contract; the prompt is the nudge.** The tests assert the normaliser.

### Step 26 — Write the S0-5 test

`__tests__/smartFieldHygiene.test.js`:

```js
import {
  normalizeYear,
  normalizeMeasurement,
  validateAndNormalizeExtraction,
} from "../services/smartExtractionValidator.js";
import { __TEST__ } from "../controller/wordPressSmart.js";

const { isBrandUnknown } = __TEST__;

// A minimal tree so validateAndNormalizeExtraction's category branch is a no-op.
const TREE = [
  { id: 5316, name: "Milling Machines", slug: "milling-machines", subcategories: [] },
];

function runValidate(patch) {
  const data = {
    name: "Test item",
    site_type: "machines",
    product_cat: { id: 5316, name: "Milling Machines" },
    subcategory: { id: "", name: "" },
    ...patch,
  };
  const suggested = validateAndNormalizeExtraction(data, {
    siteType: "machines",
    tree: TREE,
    language: "en",
  });
  return { data, suggested };
}

describe('S0-5: `year` never leaves as null (was 19/72 on DEV)', () => {
  it("blanks JSON null — the actual bug", () => {
    const { data } = runValidate({ year: null });
    expect(data.year).toBe("");            // was: null
    expect(typeof data.year).toBe("string");
  });

  it("blanks undefined", () => {
    const { data } = runValidate({ year: undefined });
    expect(data.year).toBe("");
  });

  it('blanks the string "null" and records it as a suggested term', () => {
    const { data, suggested } = runValidate({ year: "null" });
    expect(data.year).toBe("");
    expect(suggested.year).toEqual(["null"]);
  });

  it("keeps a real year and does not record a suggestion", () => {
    const { data, suggested } = runValidate({ year: "2019" });
    expect(data.year).toBe("2019");
    expect(suggested.year).toBeUndefined();
  });

  it("keeps normalizeYear's own contract intact", () => {
    expect(normalizeYear(null)).toBe("");
    expect(normalizeYear("null")).toBe("");
    expect(normalizeYear("2019")).toBe("2019");
    expect(normalizeYear("1899")).toBe("");    // below MIN_YEAR
    expect(normalizeYear("3000")).toBe("");    // above current year + 1
    expect(normalizeYear("Built 2018")).toBe("2018");
  });
});

describe('S0-5: `co2_emissions` stops shipping "0 kg" as a measurement', () => {
  it.each(["0 kg", "0kg", "0.0 kg", "0 g/km", "0", "N/A", "unknown", "kg", "", "  "])(
    "blanks %p",
    (v) => expect(normalizeMeasurement(v)).toBe("")
  );

  it.each([
    ["150 kg", "150 kg"],
    ["1500 kg", "1500 kg"],
    ["10 kg", "10 kg"],
    ["120 g/km", "120 g/km"],
    ["  2.5 kg  ", "2.5 kg"],
  ])("keeps %p", (input, expected) => {
    expect(normalizeMeasurement(input)).toBe(expected);
  });

  it("blanks null/undefined", () => {
    expect(normalizeMeasurement(null)).toBe("");
    expect(normalizeMeasurement(undefined)).toBe("");
  });

  it('drops "0 kg" through the real validator and keeps it as a suggested term', () => {
    const { data, suggested } = runValidate({ co2_emissions: "0 kg" });
    expect(data.co2_emissions).toBe("");
    expect(suggested.co2_emissions).toEqual(["0 kg"]);
  });

  it("passes a real CO2 figure through untouched", () => {
    const { data, suggested } = runValidate({ co2_emissions: "1500 kg" });
    expect(data.co2_emissions).toBe("1500 kg");
    expect(suggested.co2_emissions).toBeUndefined();
  });
});

describe('S0-5: "null" is a placeholder brand', () => {
  it.each(["null", "NULL", " null ", "undefined", "nil", "--"])(
    "treats %p as unknown",
    (v) => expect(isBrandUnknown(v)).toBe(true)
  );

  it("still treats real brands as real", () => {
    expect(isBrandUnknown("Nullsoft")).toBe(false);   // substring must not match
    expect(isBrandUnknown("NVIDIA")).toBe(false);
    expect(isBrandUnknown("BINDER")).toBe(false);
  });
});
```

```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/smartFieldHygiene.test.js --forceExit
```

**Expected: `1 passed, 30 tests`** — counted from the file above, not estimated:
**5** (`year`) + **18** (`co2`: a 10-row `it.each` of blanks, a 5-row `it.each` of keeps, plus 3
singles) + **7** (`brand`: a 6-row `it.each` plus 1) = **30**. (The integration plan says 29; it is
one out. If you get 30, you implemented it correctly.) Run it before Step 23: `data.year` comes back as `null` and
`co2_emissions` as `"0 kg"`, and `normalizeMeasurement` does not exist so the suite fails to
import. That is the failure you are fixing.

**Watch out:** `validateAndNormalizeExtraction` also touches `condition`, `grade`, `locations` and
`country`. The `runValidate` helper above deliberately passes a minimal object; if the shared
suite starts failing on `grade` or `country`, it is because the function's other branches ran, not
because of your change. Read `:148-221` before editing the helper.

---

## 8. Deploy to dev and measure

### Step 27 — Push to the backend `dev` branch and restart

Per `DEPLOYMENTS.md`: the Node backend deploys by `git pull` + `pm2 restart`. Dev is branch `dev`,
port **6000**, DB `greenbidz_test`. **Not `main`. Not port 4000.**

Ask before pushing — a push that lands on a deployed branch is a prod-adjacent action and
approval does not carry from one action to the next.

> ### 🔒 GATE ON THE COMMIT, NOT JUST ON THE DEPLOY
>
> **`__tests__/smartCategoryUnresolvedFlagOff.test.js` must be green (5 passed) before you run
> `git commit`, and again before anyone pushes.** It is in the `git add` list below because it ships
> with the change, and it is the only proof that the flag-off path — i.e. **prod** — is unaffected.
> Red there means the kill switch does not kill: do not commit, do not push, do not deploy, do not
> promote the branch. See §4.4 / 10g'.

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"

# 0. THE GATE — must print "Tests: 5 passed, 5 total".
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/smartCategoryUnresolvedFlagOff.test.js --forceExit

# 1. Record the dirty-entry count BEFORE staging, so you can prove you swept up
#    nobody else's file. It was 27 on 2026-08-18 at aabac85.
git status --porcelain | wc -l

# 2. Stage by explicit path only. Never `git add -A`, never `git add .`, never `commit -a`.
git add controller/wordPressSmart.js services/smartExtractionValidator.js \
        utils/categoryCache.js utils/htmlEntities.js controller/productController.js \
        __tests__/smartCategoryUnresolved.test.js \
        __tests__/smartCategoryUnresolvedFlagOff.test.js \
        __tests__/siteTypeHonestFallback.test.js \
        __tests__/categoryNameEntities.test.js __tests__/smartFieldHygiene.test.js \
        __tests__/siteTypeRoutingSignal.test.js __tests__/siteTypeRoutingWire.test.js
# ⚠ ADDED 2026-08-19 — the last two are PHASE 1's suites, and this phase edits 14 assertions
#   across 11 of their tests (§5.2b-5 + §5.2b-5b). Leave them off this line and those edits stay
#   uncommitted: the branch looks green locally and red for the next person who clones it.
#   `git diff --cached --name-only` must list exactly 12 paths after this command, not 10.

# 3. Confirm NOTHING of anyone else's work is staged. Everything still-unstaged must
#    equal what step 1 counted, minus only the 12 paths above (10 as first written, plus the
#    2 Phase 1 suites added 2026-08-19). It was 27 dirty entries at aa0635b / 742d359.
git status --porcelain
git diff --cached --name-only

git commit -m "feat(smart-detect): stop inventing categories and marketplaces (S0-3a/3b/4/5)"
```

**⚠ CORRECTED 2026-08-19.** Phase 1 **has** landed (`aa0635b`), so both of its suites exist and both
are already on the `git add` line above. This commit therefore also carries:

- `__tests__/siteTypeRoutingSignal.test.js` — the **2** assertions named in §5.2b-5
- `__tests__/siteTypeRoutingWire.test.js` — the **12** assertions named in §5.2b-5b, across 9 tests

**14 assertions across 11 tests, every one of them an intended contract change.** List them in the PR
body with the one-line reason from the §5.2b-5b table, so a reviewer can tell an intended change from
a test edited to make red go away. Test #7 needs a **fixture** change, not a number change — read the
warning under §5.2b-5b before touching it.

Then on the server (dev environment only), set the flags before restarting:

```
SMART_CATEGORY_UNRESOLVED=1
```

and restart the **dev** pm2 process. Confirm which one from `DEPLOYMENTS.md` — do not guess a
process name, and do not restart the `:4000` prod process.

Sanity check the right service answered:

```bash
curl -s "https://testapi.greenbidz.com/api/v1/product/category?lang=en" | head -c 200
```

### Step 28 — Re-measure: the after table

> ### ⚠️ THE SHIPPED HARNESS CANNOT MEASURE THIS PHASE'S TWO HEADLINE FIELDS. PATCH IT FIRST.
>
> Verified on this machine, 2026-08-18:
>
> 1. **`/c/tmp/mm-baseline` does not exist.** The recorded baseline and the scorer are at
>    **`/c/tmp/cto-review/`** — `measure.mjs`, `ruleb.mjs`, `machines.json`, `runA.json`, `runB.json`,
>    `runC.json`. **`run.mjs` is not on this machine at either path**, so `node run.mjs` cannot be
>    executed as written. Whoever runs the "after" pass must either recover `run.mjs` or re-write the
>    24-photo poster; either way, do step (2) to it before recording anything.
> 2. **The recorded projection is FIXED and omits both new fields.** Each `products[]` entry in
>    `runA/B/C.json` has exactly these 18 keys — proven by reading them:
>    `site_type, name, brand, model, year, weight, dimensions, condition, grade, operation_status,
>    currency, price, prices, product_cat, subcategory, co2, needs_clearer_photo, desc_len`.
>    Neither `category_source` nor `site_type_source` is among them: **0 of 72 recorded products
>    carry either key.** Run the unpatched harness after this phase and `measure.mjs` will report
>    `{'(absent)': 24}` for both — which looks like your stamp never fired.
> 3. **The projection renames `co2_emissions` to `co2`.** Keep that rename or `measure.mjs`'s
>    `co2 === "0 kg"` counter silently reads zero.
>
> **The patch — two edits, both required.** In the projection that `run.mjs` writes (the block the
> integration plan cites as `run.mjs:57-66`), add the two fields beside `site_type`:
>
> ```js
>   site_type: p.data?.site_type ?? null,
>   site_type_source: p.data?.site_type_source ?? "(absent)",
>   site_type_confidence: p.data?.site_type_confidence ?? "(absent)",   // Phase 1's, per §5.2b-4
>   category_source: p.data?.category_source ?? "(absent)",
> ```
>
> and in `/c/tmp/cto-review/measure.mjs`, beside the existing `site` tally, add two more:
>
> ```js
> const catSrc = {}, siteSrc = {};
> // inside the per-product loop:
> catSrc[p.category_source ?? "(absent)"] = (catSrc[p.category_source ?? "(absent)"] || 0) + 1;
> siteSrc[p.site_type_source ?? "(absent)"] = (siteSrc[p.site_type_source ?? "(absent)"] || 0) + 1;
> // after the loop:
> console.log("category_source", catSrc);
> console.log("site_type_source", siteSrc);
> ```
>
> **Sanity-check the patch against the BEFORE data first.** Re-running the patched `measure.mjs` over
> `runA/B/C.json` must print `category_source {'(absent)': 72}` and `site_type_source {'(absent)': 72}`
> — that is the correct "before" reading and it proves the new counters are wired. The rest of the
> baseline must reproduce **exactly**, and it does today:
>
> ```
> $ cd /c/tmp/cto-review && node measure.mjs runA.json runB.json runC.json
> products 72
> site { LabGreenbidz: 18, machines: 21, '101it': 23, recycle: 10 }
> unresolved cat 0/72 = 0%
> flat first-row 12/72 = 17%
> year null 19/72 = 26% real 16/72 = 22%
> co2 0kg 40/72 = 56% real 11/72 = 15%
> escaped 3/72 = 4% amp; 3/72 = 4%
> ```
>
> If your before-run does not reproduce those seven lines, your harness is not the one these numbers
> came from and the "after" table means nothing.

```bash
cd /c/tmp/cto-review              # NOT /c/tmp/mm-baseline — it does not exist
node measure.mjs runA.json runB.json runC.json    # BEFORE, must match the block above

# after the dev deploy, with the patched projection:
node run.mjs                       # all 24 photos through DEV v2 SSE, read-only
mv results.json after.json
node measure.mjs after.json
```

`run.mjs` posts one `image_urls` field as multipart to
`https://testapi.greenbidz.com/api/v1/wp/analyze-smart-detection-v2` with the shared
`x-system-key` and records the `result` event. **It creates no listing, no draft and no DB row.**
(A urlencoded body arrives empty because of multer — keep the multipart form.)

`after.json` is one run (24 products), the baseline is three (72). Compare **rates**, not counts.
For a like-for-like 3-run comparison, run it three times into `afterA/B/C.json` and pass all
three to `measure.mjs`. Latency is p50 11.1 s / p90 15.6 s, so a 24-photo run takes roughly 5–8
minutes.

**Predicted after-figures, and where each prediction comes from:**

| Metric | Before (n=72, measured) | After (predicted) | Basis of the prediction |
|---|---|---|---|
| unresolved category (`product_cat.id === ""`) | **0/72 = 0%** | **≈ 12/72 = 17%** | Rule B replayed offline over the recorded runs: exactly 12 products picked a flat tree's `tree[0]` with no corroboration (machines 5300 × 12; recycle 1147 × 0). |
| `category_source` present | 0/72 | 72/72 | New field, stamped unconditionally. |
| `category_source: 'unresolved'` | — | ≈ 17% | Same 12. |
| flat-tree first-row pick shipped | **12/72 = 17%** | **0/72 = 0%** | Rule B's definition. |
| `site_type_source` present | 0/72 | 72/72 | New field. |
| `site_type_source: 'low_confidence_fallback'` | — | **≈ 0/72** | The `< 0.6` rewrite fired **0 times in 72** (`suggested_terms.site_type` was absent on every run). S0-3b is a latent-path fix; a zero here is the expected, correct result, not a failed change. |
| `year === null` | **19/72 = 26%** | **0/72 = 0%** | Deterministic normaliser. |
| `co2 === "0 kg"` | **40/72 = 56%** | **0/72 = 0%** | Deterministic normaliser. |
| escaped category name on the wire | 3/72 = 4% | 0/72 = 0% | Deterministic decode. |
| routing accuracy | 64/72 = 89% | **unchanged on this sample; a move is not a failure** | Nothing in this phase changes the vision call or `inferSiteTypeFromProduct` (that is S0-1). **Corrected in CTO review 2026-08-18:** the original wording ("if routing moves, you broke something — stop and diff") is wrong as an acceptance rule. S0-3b changes what `runDetectionPass` stamps per product (`:2124`, `:2138`), which is passed straight back in as the `detectionHint` (`:3262-3265` inside the call at `:3259`) and can win the hint contest (`:1675-1682`). A low-confidence detection guess that used to arrive as `recycle` now arrives as its real value, so routing **can legitimately change, for the better**. On this sample the `<0.6` branch fires 0/72, so expect 89%. **See the per-product improvement-vs-regression table under "Acceptance for this phase" below — it, not this percentage, is the gate.** |

**Acceptance for this phase**

1. The four **deterministic** rows must all read 0%: `year === null`, `co2 === "0 kg"`, escaped
   category name, flat-tree first-row pick. These are normalisers and a decode; there is no honest
   reason for a non-zero.
2. `category_source` and `site_type_source` **present on 72/72** — and per §5.2b-4
   `site_type_confidence` present on 72/72 as well, because Phase 1 already put it there and this
   phase must not drop it.
3. Unresolved category near **17%**. Above ~**25%** means Rule B is firing wider than designed —
   re-read Step 9 and confirm you did not implement one of the two rejected candidate rules from
   §4.1 (one of which blanked **69/72**).
4. **Routing accuracy: a MOVE IS NOT A FAILURE.** *(Corrected 2026-08-18; the original rule here —
   "if routing moves, you broke something — stop and diff" — was wrong and must not be applied.)*

**Why routing can legitimately move, with the anchors.** S0-3b changes what `runDetectionPass` stamps
per product (`:2124` `const batchSite = normalizeDetectedSiteType(parsed)`, `:2138` `const per =
normalizeDetectedSiteType({…})` — both re-opened 2026-08-18). That per-product stamp is handed
straight back in as the `detectionHint` (`:3262-3265`, inside the `processProductGroup` call at
`:3259`), where it can win the hint contest at `:1675-1682`. A low-confidence guess that used to
arrive as `recycle` now arrives as its real value — so the routing that comes out **can change, and
changing toward the truth is the change succeeding.**

**The criterion that distinguishes an improvement from a regression.** Do not compare the aggregate;
compare per product, against ground truth:

| Observation | Verdict | Action |
|---|---|---|
| Aggregate unchanged and no product moved | Expected on this sample — the `<0.6` branch fires **0/72** | Record it and move on |
| A product moved **toward** its `set.json` `truth` value (wrong → right) | **Improvement.** This is S0-3b working | Record the id, the before value, the after value, and why. Keep it |
| A product moved **away** from its `set.json` `truth` (right → wrong) | **Regression.** Only this reverts | Diff that product's `detectionHint` and `site_type_source`; if `source` is `hint`, the hint contest at `:1675-1682` took a weak hint — fix that, do not re-add the `recycle` rewrite |
| A product moved wrong → **differently wrong** | Neutral. Not a gate | Record it; note whether the new value is at least the right *family* |
| Aggregate accuracy **drops** while no individual move is away from truth | Arithmetic error in your scoring, not a behaviour change | Re-score |

Report it as `moved: N (toward truth A, away B, wrong→wrong C)` — a single accuracy percentage
cannot carry that distinction and must not be the gate. **Revert only on `away > 0`.**

### Step 29 — Eyeball it in the app, then put `.env` back

With the app pointed at dev (Step 4) and a dev client on the emulator:

1. Scan the L7 image (`set.json`) — a Waters Alliance control panel.
2. On the review screen the Category field should be **empty** and flagged required. **This is the
   moment §0.1 becomes concrete:** you are now looking at the two nested 240 px scrollers with no
   search that the seller has to use. If that feels unacceptable, it is — that is exactly why
   `SMART_CATEGORY_UNRESOLVED` must stay off on prod until M-2 ships.
3. Confirm the CO₂ field is empty rather than "0 kg", and Year is empty rather than "null".
4. **Restore `GREENBIDZ_API_URL` to production and verify `git diff .env` is empty** (Step 4's
   restore block). Do this before you close the terminal.

Emulator notes that have cost time before: boot with `-dns-server 8.8.8.8` or DNS breaks, and
`CI=1` disables hot reload.

---

## 9. Interfaces this phase produces

Everything below is additive on the wire. 1.0.3 clients read named fields only
(`mapProductData`, `GreenBridgeApp/src/features/scanner/mapSmartDetection.ts:152-230`), so new
keys are ignored by the shipped app.

### 9.1 New fields on `products[].data` (and on `merged_single`)

```
category_source   : 'ai' | 'fuzzy' | 'unresolved'
site_type_source  : 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback'
```

Plus, per §5.2b-4, Phase 1's `site_type_confidence` — this phase threads it through and **must not
drop it**:

```
site_type_confidence : number 0..1
```

Both new fields appear on every product in the `product` SSE event
(`controller/wordPressSmart.js:3272-3278`, key `data`) and inside `merged_single`
(`:3313-3336`) because both are stamped on the same `data` object inside
`processProductGroup`.

**They also appear on the non-streaming v1 response, which nothing in this plan previously said.**
`runSmartDetection` (`:2298`, the v1 HTTP handler's entry, called at `:2606`) calls the *same*
`processProductGroup` at `:2323` and `:2366` — verified by grep, all four call sites listed — so v1
inherits both fields for free, with no extra work and no extra risk. That matters because the **web
still uses v1**: `GreenBridgeSeller/src/pages/new-submission-upload/utils/analyzeSmartDetection.ts`
documents at `:36-39` that v1 is the fallback "for binary/multipart input only … No flag selects v1
anymore — it runs when callers pass a `File[]` because the v2 endpoint can't accept it", and posts to
`/wp/analyze-smart-detection` at `:104`. So a seller who drags a local file rather than a GCS URL
takes the v1 path and gets the same two fields. **Nothing to implement — this is recorded so nobody
"adds v1 support" that already exists, and so the §5.3 web regression check is understood to cover
both transports.**

### 9.2 Changed field semantics

| Field | Before | After |
|---|---|---|
| `product_cat` / `subcategory` | always `{id, name}` with a non-empty id (guaranteed by `ensureCategoryPairForSiteType`) | may be `{id: "", name: ""}`. Consumers must handle empty. The web already does (`applyAiCategoryFromResponse.ts:38-43`); the mobile app's own type comment already documents it (`smartDetectionTypes.ts:38` — *"id === '' means 'no match'"*). |
| `site_type` | `recycle` could mean "genuinely recycle" **or** "we were unsure" | `recycle` means recycle **unless** `site_type_source === 'low_confidence_fallback'`. Read the two together. |
| `year` | `string \| number \| null` | always a `string` (`""` when unknown) |
| `co2_emissions` | any model string, including `"0 kg"` | a real measurement or `""` |
| category `name` (recycle) | HTML-encoded (`Surplus &amp; Scrap Materials`) | decoded (`Surplus & Scrap Materials`) |
| `suggested_terms` | — | may now carry `co2_emissions: [...]` in addition to the existing `year`, `condition`, `grade`, `price`, `site_type`, `product_cat`, `subcategory` keys |

### 9.3 What Phase 3 must add to consume it (task M-6)

`GreenBridgeApp/src/features/scanner/smartDetectionTypes.ts`, in `SmartProductData` (`:10-43`):

```ts
  /** S0-3a — how the server arrived at product_cat/subcategory. 'unresolved' ⇒ both are {id:'',name:''}. */
  category_source?: 'ai' | 'fuzzy' | 'unresolved';
  /** S0-3b — how the server arrived at the FINAL site_type. Both fallback-ish sources ⇒ ask the seller. */
  site_type_source?: 'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback';
```

The app-side rule, from plan §2.3: treat `site_type_source === 'low_confidence_fallback'`
(and `'regex_override'`) as **ask**; treat `category_source === 'unresolved'` as
**do not pre-fill the category**. `needs_clearer_photo` (already on the wire, still 0 references
in `src/` and `app/`) stays the v1 ask-trigger.

> **Integration coupling C6 — the enum, once, the server's.** Phase 4 Step 6-1 types
> `category_source` as `'llm' | 'fuzzy' | 'default_parent' | 'unresolved'`. That is wrong in both
> directions: it **excludes `'ai'`, which is the value this server actually sends**, and it declares
> two values the server can never send (`'llm'` does not exist here; `'default_parent'` is
> unreachable by construction once the substitution is gated). The resolution, already agreed as
> integration Decision 2, is the server's three values verbatim — `smartDetectionTypes.ts`:
> `category_source?: 'ai' | 'fuzzy' | 'unresolved';` and `routingState.ts`:
> `export type CategorySource = 'ai' | 'fuzzy' | 'unresolved';`. Runtime survives the mismatch
> (`data.category_source ?? null` passes `'ai'` through and `deriveRoutingState` only tests
> `!== 'unresolved'`), so this is a **type-truth** fix, not a crash fix — but ship it, because a lying
> union is what makes the next reader add a fourth server value.

### 9.4 New env flags

| Flag | Where read | Dev | Prod | Effect when absent/`0` |
|---|---|---|---|---|
| `SMART_CATEGORY_UNRESOLVED` | `controller/wordPressSmart.js` (§4 Step 9) | `1` | **absent until M-2 ships** | Pre-S0-3a behaviour: always emit some category id. **This only holds if Steps 10a'-10e' (§4.4) are implemented instead of 10a-10e** — as originally drafted the default substitution was removed unconditionally and a blank category could ship with the flag off. `__tests__/smartCategoryUnresolvedFlagOff.test.js` (§4.4 / 10g') is what proves the claim; treat a red there as "do not deploy". `category_source` is still emitted with the flag off (it reads `'ai'`/`'fuzzy'`), so Phase 3 can be built and tested against the field either way. |

> ### What the dev flag does to Phase 3's on-device trap check (integration coupling C10)
>
> **Read this before you tell the app engineer anything.** With `SMART_CATEGORY_UNRESOLVED=1` on dev —
> which is what this phase deploys — a **legitimately blank category is the expected result on roughly
> 17% of scans** (measured: flat-tree first-row pick 12/72). Phase 3's on-device check **#11**
> (`PHASE_3_APP_CATEGORY_AND_RECYCLE.md:2087`) reads:
>
> > *"Run an AI scan that returns a category, open `detail.tsx` → The category is **pre-filled**. This
> > is the trap check. If it is blank you broke the hydrate/bridge effect — revert (e) and (f) and
> > re-apply without touching `:92-169`"*
>
> Against a dev server carrying this phase, **that check can fail for a completely legitimate reason**,
> and its instruction is to *revert working code* and go hunting a hydration bug that does not exist.
>
> **Two ways to run it honestly — do one of them, and say which:**
> 1. **Use a photo known to resolve.** From the recorded replay, lab items **L1–L7 all resolved a
>    category and all have `needs_clearer_photo: false`.** Use one of those; a blank category then
>    really does mean the bridge is broken.
> 2. **Set `SMART_CATEGORY_UNRESOLVED=0` on dev for that one check** and note it in the Phase 3 log.
>    One env var and a `pm2 restart`; put it back to `1` afterwards.
>
> Do **not** "fix" this by shipping the flag off permanently on dev — that would leave S0-3a
> unexercised, which is the one thing dev exists to exercise.

S0-3b, S0-4 and S0-5 are **not** flagged: S0-3b's measured behaviour change on this sample is
zero (the rewrite never fired), S0-4 is a pure display/tokenisation fix, and S0-5 removes
fabricated values. If a reviewer wants a flag on S0-3b, wrap the two `normalizeDetectedSiteType`
early returns in `process.env.SMART_SITE_TYPE_HONEST !== "0"` — one condition, same shape as
Step 9.

---

## 10. Verification

Run all of it. Paste the output into the PR.

> ### 🔒 THE ONE GATE IN THIS LIST
>
> `smartCategoryUnresolvedFlagOff` (§4.4 / 10g') is a **hard gate**, not a line item.
> **Green (5 passed) or the branch does not move** — no commit, no push, no merge, no dev deploy, no
> promotion. It is the only executable proof that with `SMART_CATEGORY_UNRESOLVED` absent — the prod
> configuration — the pipeline still ships a category id, and therefore that this phase cannot
> submit-block the 1.0.3 app currently in Apple review. The flag-OFF path **has never been executed
> against a running server by anyone**; this suite is the whole of the evidence. Run it first.

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"

# 0. 🔒 THE GATE. Run this BEFORE anything else and again before any push.
#    Must print: Tests: 5 passed, 5 total.
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/smartCategoryUnresolvedFlagOff.test.js --forceExit

# 1. The five new suites, individually (fast loop).
#    smartCategoryUnresolvedFlagOff is the kill-switch guard from §4.4 (10g') — it MUST be here.
for f in smartCategoryUnresolved smartCategoryUnresolvedFlagOff siteTypeHonestFallback categoryNameEntities smartFieldHygiene; do
  echo "=== $f ==="
  node --experimental-vm-modules node_modules/jest/bin/jest.js "__tests__/$f.test.js" --forceExit
done
```

**Expected counts — every one of these was recounted from the test bodies in this document on
2026-08-18. Earlier drafts were wrong five times; these are the numbers.**

| Suite | Tests | Arithmetic | Gate? |
|---|---|---|---|
| `smartCategoryUnresolved` (S0-3a) | **12** | 5 + 6 + 1 | no (earlier text said 14) |
| `smartCategoryUnresolvedFlagOff` (S0-3a kill switch) | **5** | 3 + the 2 nested-tree tests §4.4/10g' adds | **🔒 YES** (earlier text said 3) |
| `siteTypeHonestFallback` (S0-3b) | **10** | 3 + 5 + 1 + 1; §5.2b-6 adds assertions inside existing `it`s, so the count does not change | no (earlier text said 12) |
| `categoryNameEntities` (S0-4) | **16** | 8 `it.each` rows + 5 + 3 | no (earlier text said 19) |
| `smartFieldHygiene` (S0-5) | **30** | 5 + 18 + 7 | no (earlier text said ~30; exact is 30, and the integration plan's 29 is one out) |
| **new tests added by this phase** | **73** | 12 + 5 + 10 + 16 + 30 | |

If a suite reports a *different* number, count the `it` / `it.each` rows in the file before assuming
you mis-implemented. A wrong expected count has cost time on this programme five times already.

```bash
cd "c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend"

# 1b. ⚠ ADDED 2026-08-19 — Phase 1's two suites. This phase EDITS 14 assertions in them
#     (§5.2b-5 + §5.2b-5b). Expected AFTER your edits: 19/19 and 20/20 green. Any red test
#     here that is NOT on §5.2b-5b's list of 11 is yours.
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/siteTypeRoutingSignal.test.js \
  __tests__/siteTypeRoutingWire.test.js
# Baseline for both, BEFORE your edits, at aa0635b: 19/19 and 20/20 green. Under the merged
# §5.2b bodies with the assertions NOT yet updated: 2 red and 9 red respectively (measured).

# 2. The suites most likely to be collateral damage.
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/brandUnknownGuard.test.js \
  __tests__/wordPressSmart.controller.test.js \
  __tests__/smartDetectI18n.test.js \
  __tests__/smartDetectValidateInput.test.js \
  __tests__/officeDocs.test.js \
  __tests__/recognitionRunner.test.js --forceExit

# 3. The full suite.
npm test 2>&1 | tail -40
```

**Known baselines:**

- **Backend full suite, MEASURED 2026-08-18 at `aabac85` (see Step 3 for the full breakdown):
  `Test Suites: 2 failed, 56 passed, 58 total` · `Tests: 3 failed, 1 skipped, 720 passed, 724
  total`.** The 2 red suites are `zohoListingSyncPublished` (stale mock: missing `createZohoOffer`)
  and `uploadValidationService` (3 red tests, all asserting a *specific* document-rejection reason
  against a generic one). Both are unrelated to this phase. **Any third red suite is yours.**
  After this phase, expect `58 + 5 = 63` suites and `724 + 73 = 797` tests, with the same 2 red.
  (`uploadValidationService.js:415` calls `normalizeSiteType(item.marketplace, "")` — an
  **explicit** fallback, so Step 14 does not touch it. If that suite's failure *changes shape*
  after your edit, look there first.)
- `brandUnknownGuard.test.js` was **19 passing tests** before Step 24; Step 24 adds placeholder
  values, so if that file uses an exhaustive `it.each` list it may need the new values appended.
  It currently asserts specific values, not exhaustiveness — verified — so it should stay green.
- **App: 0 tsc errors, 92 suites / 825 tests.** This phase changes **no app code**, so those
  numbers must be unchanged. Confirm cheaply:
  ```bash
  cd "c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp"
  git status --porcelain          # expect ONLY docs/multi-marketplace/ — and .env back to clean
  npx tsc --noEmit                # expect 0 errors
  npm test 2>&1 | tail -10        # expect 92 suites / 825 tests
  ```

**Live dev checks:**

```bash
# S0-4 — 37 rows, 0 escaped
curl -s "https://testapi.greenbidz.com/api/v1/product/category?lang=en" \
| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).data;
console.log("rows",r.length,"escaped",r.filter(x=>/&(amp|lt|gt|quot|#0?39);/i.test(x.name)).length);});'

# S0-3a/3b/5 — the measurement table
cd /c/tmp/mm-baseline && node run.mjs && mv results.json after.json && node measure.mjs after.json
```

**Manual checks that have no command:**

- The web regression pass, §5.3 steps 1–6 (three consumers; review screen only, no submit).
- The app eyeball, Step 29.
- `.env` restored: `cd GreenBridgeApp && head -1 .env && git diff --stat .env` — the URL must read
  `https://api.101recycle.greenbidz.com/api/v1` and the diff must be empty.
- `git status` in the backend still shows the other developers' uncommitted work, unstaged and
  unmodified by you.

---

## 11. What this phase does NOT do

- **It does not ship anything to production.** Not one step here requires prod access. Flipping
  `SMART_CATEGORY_UNRESOLVED` on prod is a separate, owner-approved action gated on Phase 3's M-2
  being live in a shipped build.
- **It does not touch S0-1** (`inferSiteTypeFromProduct` / `IT_PRODUCT_RE`, the centrifuge-as-GPU
  class and the 9% false-101it rate). That is its own task with its own 800-listing replay gate.
  This phase deliberately leaves the regex override in place and only *labels* it
  (`site_type_source: 'regex_override'`).
- ~~**It does not emit `site_type_confidence`.**~~ **CORRECTED 2026-08-18 (integration coupling
  C5).** That was true only while this phase was assumed to land *first*. With Phase 1 landing first,
  `site_type_confidence` is **already on the wire** and this phase **threads it through and must not
  drop it** — see §5.2b-3 and §5.2b-4. This phase still does not *originate* the field (S0-2 does); it
  originates `site_type_source`, because "mark it `low_confidence_fallback`" needs a field to live in.
  Following the old Step 16b/16c bodies would have deleted `site_type_confidence` silently.
- **It does not fix the 101it `Components` dumping ground.** `tree[0]` = 5523 `Components` with
  exactly one child (`GPU Accelerators` 5524) took 8 of 72 DEV products including an AOI
  inspection system and a dual-monitor-plus-keyboard lot. Rule B is restricted to flat trees on
  purpose (§4.1). The fixes are taxonomy content (S0-6 / Decision 6) and the M-2 picker.
- **It does not add the missing taxonomy rows.** /machines has 13 flat parents and 0
  subcategories — no surface treatment, no glass machinery, no inspection/metrology. That is
  owner content work (Decision 6) and it is why 8 of 11 category errors were
  unreachable-correct-answer errors.
- **It does not fix `fetchRecycle`'s wrong URL, and that is a deliberate scope call.** Verified
  bug: `utils/categoryCache.js:167` requests `http://localhost:${process.env.PORT || 8081}/product/category?lang=en`,
  but the router is mounted at `/api/v1/product` (`app.js:340`) and there is **no bare `/product`
  mount** in `app.js`. So `cache.recycle` is never populated by `warmCategoryCache`, and
  `ensureSmartDetectionCategories('recycle')` falls through to the SQL catalog. Step 20 decodes
  the SQL path too, so S0-4 is complete either way. **Fixing the URL would change which tree the
  AI picks from for recycle — a behaviour change beyond S0-4 — so it is reported, not fixed.**
  (Code-read only; not confirmed by running the server and observing the 404.)
- **It does not touch the recycle taxonomy's data quality problems** found while measuring:
  `5334 車床 (CNC 與傳統)` is an untranslated Chinese name in the EN tree, `5366 test` is a test
  row, and there are two overlapping general buckets (`1918 Others`, `5288 Other Equipment`).
  Owner content work.
- **It does not change any UI, any app file, any translation, or `greenbidz-ai-assistant/`.**
- **It does not ship a numeric confidence threshold.** Plan §2.1: v1 confirms always.

---

## 12. What must land before / after

### Before this phase

**CORRECTED 2026-08-18 (integration coupling C5). The earlier claim "nothing blocks it" was wrong.**

**Phase 1 (S0-1 / S0-2) must land first**, on the same backend branch. Not because this phase depends
on Phase 1's behaviour — it does not — but because the two rewrite the **same three functions**
(`normalizeDetectedSiteType`, `detectSiteTypeForGroup`'s `catch`, `resolveSiteTypeForGroup`) and
whoever lands second wins the file. With Phase 1 first, this phase's job is to **add branches**, which
is what §5.2b specifies. With Phase 1 second, Phase 1 would have to redo the merge, and its author
would have to discover the conflict rather than being handed it.

S0-4 and S0-5 are genuinely independent of everything and can be written in any order.

The coordination item is therefore mandatory, not advisory: **run §5.2b-pre's grep before Step 14.**
If `site_type_source` / `buildRoutingSignal` already exist, merge into them — one field, one enum, in
`services/smartExtractionValidator.js` (coupling C13). Never declare either twice.

### After this phase, before prod

1. **S0-1** (narrow `inferSiteTypeFromProduct`) — independent, but it is the change that removes
   the worst routing failure class; shipping the honesty labels without it means labelling a known
   bug rather than fixing it. Its gate is the 800-listing replay (false-101it 9% → ~0%).
2. **S0-2** (`site_type_confidence` per product, describing the **final** site type) — turns
   `site_type_source` into a calibratable signal and starts the logging that plan §2.3's v1.1
   threshold needs.
3. **Phase 3 / M-2 — the searchable category sheet. Hard blocker on the prod flip of
   `SMART_CATEGORY_UNRESOLVED`.** See §0.1. Nothing else in this list is a gate on a flag; this one
   is.
4. **Phase 3 / M-1** (101recycle category endpoint + `{term_id,name,slug}` → `LabCategory` shape +
   `flattenCategoryOptions` handling a flat tree). Without it, recycle category ids still fail the
   app's validity check (`CategoryConditionCard.tsx:124`) and get cleared
   (`fetchCategories.ts:157`). S0-4 makes the *names* correct; M-1 makes the *tree reachable*.
   `endpointForMarketplace` is at `fetchCategories.ts:24-29` and its comment still says lab and
   recycle share a tree — they do not (zero id overlap).
5. **Phase 3 / M-6** (add the two new fields to `SmartProductData` and carry them through
   `mapProductData`). Until then both fields are inert on mobile — which is the point of shipping
   the server first.
6. **Web regression sign-off** (§5.3) — required before anyone proposes a prod flip, and it covers
   three apps, not one.
7. **Prod re-measurement** (plan release gate 1). Every number in this document is DEV. Prod runs
   a different vision-provider configuration (`IMAGE_SEARCH_VISION_PROVIDER=vertex`,
   `GEMINI_API_KEY` empty). **Prod accuracy is unverified.**

### Never, on the current timeline

**No `eas update` while 1.0.3 is in App Review** (build 19, `WAITING_FOR_REVIEW`; Play
versionCode 6). `runtimeVersion: appVersion` means an OTA published for 1.0.3 reaches the build
Apple is testing. The app half of this work is **1.0.4**, a binary.

---

## 13. Honest limits of this plan

- **Every measurement is DEV**, n = 24 photos × 3 runs = 72 products, replayed from the recorded
  `result` events in `runA/B/C.json`. Indicative, not statistically tight. **Prod is unverified.**
- **The "after" figures in Step 28 are predictions**, computed by replaying the proposed rules
  offline over those recorded runs — not observed from a patched server. Two of them (`year`,
  `co2_emissions`) are deterministic normalisers and I would be surprised to be wrong. The
  unresolved-category rate (≈17%) depends on the model continuing to pick `tree[0]` at the same
  rate; if the vision provider changes, so will it.
- **Rule B's zero-false-blank result is a property of this 24-photo sample.** The sample contains
  no genuine boring or drilling machine, so the escape hatch (`findBestParent` independently
  agreeing) was never exercised positively. It is untested against a true positive.
- **S0-3b's behaviour change is unobservable on this sample.** The `< 0.6 → recycle` rewrite fired
  0 times in 72 runs. I am confident it is correct from the code read; I have **not** seen it fire
  and therefore have not seen the new label appear on a live response. To force it, you would have
  to stub `callOpenAIJson`.
- **The `year: null` root cause is proven** two independent ways (recorded runs + executing
  `normalizeYear`'s exact body). The audit's "literal string" wording is wrong; the fix here
  targets what actually happens.
- **The `fetchRecycle` 404 is code-read only** — I did not run the server and observe the failed
  request.
- **Rule B's escape hatch never sees a category hint at runtime** (CTO review, 2026-08-18).
  `isUnevidencedFirstRowPick` passes `data._parent_category_hint` into `findBestParent`, but
  `validateAndNormalizeExtraction` already `delete`s that key at
  `services/smartExtractionValidator.js:205`, which runs at `:1972`
  (`let catSuggested = validateAndNormalizeExtraction(data, {`) — before Rule B's insertion point in
  the Step 11 block that replaces `:1993`. So the hint is always `undefined` there and `findBestParent`'s exact-name shortcut
  cannot fire. This is *why* the offline replay over the recorded runs (which never carried the hint)
  reproduces the runtime result exactly — the 12/72 figure is trustworthy for that reason, not by
  luck. Keep the argument in the call for when the hint outlives the validator; do not "improve" the
  hint into scope without re-running §4.1's comparison.
- **The kill switch as originally drafted gated only part of S0-3a** — see §4.4. The corrected
  Steps 10a'-10g' are a code read plus a new test; the flag-off path has **not** been executed
  against a running server by anyone yet.
- **The web regression conclusion is code-read only.** No web page was loaded, no listing
  submitted, on any marketplace. §5.3 is written as a manual step precisely because I could not
  execute it.
- ~~**`brandUnknownGuard.test.js` was the only Jest suite I actually ran.**~~ **SUPERSEDED
  2026-08-18: the full backend suite was re-run for real** on branch `fix/seller-gate-existing-sellers`
  at `aabac85`, with the 27 pre-existing dirty entries in the tree — `2 failed / 56 passed` suites,
  `3 failed / 1 skipped / 720 passed / 724 total` tests, ~9.6 s. Step 3 and §10 carry the breakdown and
  the root cause of each red. The earlier second-hand "2 failing suites" line happened to be right
  about the *count* and said nothing about *why*, which is the part an implementer needs in order not
  to chase someone else's breakage. `brandUnknownGuard` is still 19 tests, still green.
- **The v1 (non-streaming) path inherits both new fields for free, and that was previously
  undocumented.** `runSmartDetection` (`:2298`, entered from the v1 HTTP handler at `:2606`) calls the
  same `processProductGroup` at `:2323` and `:2366` — all four `processProductGroup(` call sites were
  grepped, the other two being the v2 SSE paths at `:3259` and `:3327`. So `category_source`,
  `site_type_source` and `site_type_confidence` appear on the v1 response too, with no extra code. The
  web still reaches v1 whenever a caller passes a `File[]`
  (`GreenBridgeSeller/src/pages/new-submission-upload/utils/analyzeSmartDetection.ts:36-39`, POST at
  `:104`), so the §5.3 web check exercises both transports. **Nothing to implement — recorded so
  nobody builds what already works, and so §5.3 is understood to cover v1 as well as v2.**
- **The `run.mjs` / `measure.mjs` harness cannot measure this phase's two headline fields without the
  patch in Step 28**, and `/c/tmp/mm-baseline` does not exist on this machine at all — the recorded
  runs and the scorer are at `/c/tmp/cto-review/`, and `run.mjs` is absent from both. The recorded
  per-product projection has exactly 18 fixed keys and **0 of 72 products carry `category_source` or
  `site_type_source`**; verified by reading the JSON, not inferred. An unpatched "after" run therefore
  reports `{'(absent)': 24}` and looks exactly like a failed implementation.
- **The 10g' kill-switch expectations are measured, not predicted.** The five gated call sites'
  flag-off behaviour was executed on 2026-08-18 against the *unmodified* function bodies extracted
  verbatim from `controller/wordPressSmart.js` (`:640-770`, `:833-877`, `:1525-1547`, `:1560-1602`):
  flat tree → `5300`, nested tree → `5523` / `5524`, and `findBestParent` on the unmatchable fixture
  scores **0**, so the Rule B escape hatch does not fire. What is *still* unproven is the flag-off path
  end-to-end through a live `processProductGroup` with a forced vision failure — that needs a running
  server and a stub, and nobody has done it. That is why 10g' is a gate rather than a warning.
- No production write, publish, submit, push, commit, branch switch, stash, reset or migration was
  performed in producing this document. `greenbidz-ai-assistant/` was not touched. No `.ts`,
  `.tsx` or `.js` source file was modified.

---

## 14. Post-implementation closeout — recorded 2026-08-19

Written by the engineer who implemented the phase. Tree: `101recycle-greenbidz-backend` on
`fix/seller-gate-existing-sellers`, four new commits on top of `742d359`, with the **27**
pre-existing dirty entries of §0.2 untouched throughout. **No push, no deploy, no `pm2`, no ssh, no
migration, no prod anything.**

```
a1951dc  S0-3a: let the category picker say "I don't know"
96be9cf  S0-3b: stop `recycle` being the silent bucket for "unknown"
2a32c0c  S0-4: HTML-unescape category names on the SQL read paths
d19e105  S0-5: field hygiene for `year`, `co2_emissions` and placeholder brands
```

**Measured baseline before any edit** (at `742d359`, using the plan's own command):
`61 suites / 2 failed / 59 passed; 789 tests / 3 failed / 1 skipped / 785 passed`. Note this is
**789**, not the 784 Phase 1 §13 records — `742d359` added 5 tests after that figure was taken.
**After this phase:** `68 suites / 2 failed / 66 passed; 878 tests / 3 failed / 1 skipped / 874
passed`, the same 2 pre-existing red suites (`uploadValidationService`, `zohoListingSyncPublished`)
and no third.

All 67 anchors in §1.2b were re-verified against the working tree before editing. **Every one
matched** — that re-derivation was correct.

### 14.1 THE ONE DELIBERATE DEVIATION — Step 10b' as written implements a rule §4.1 REJECTED

**Do not "restore" 10b' to its plan text without re-reading this.**

10b' says: when `bestCat` is null, `if (CATEGORY_UNRESOLVED_ENABLED) clearCategoryPair(data)`. On a
**flat** tree that clears far more than Rule B intends, because of an ordering fact the plan never
states:

> `fuzzyCategoryFallback` runs for **every** flat-tree product. Its caller's condition is
> `catEmpty || (!data.subcategory?.id && data.product_cat?.id)`, and a flat tree has no subcategory
> to fill, so the second clause is **always** true. Inside, the early guard
> `if (hasCatId && hasSubId) return {}` is likewise never taken. So the function **re-derives the
> parent from `findBestParent` on every machines product**, and an unconditional clear there blanks
> any pick the token-overlap scorer cannot corroborate.

Replayed offline over the recorded 72-product DEV runs, same method as §4.1's candidate comparison:

| Gate | Blanked | Verdict |
|---|---|---|
| 10b' as written (clear whenever `bestCat` is null) | **18/72 = 25%** | 6 of the 18 are **correct** picks |
| 10b' plus a `!hasCatId` condition (**implemented**) | **12/72 = 17%** | exactly §4.1's 12, on exactly its named products |

The 6 extra blanks are **M1** *"Surface Grinding Machine"* to 5301 Grinding & Finishing
(`scoreAgainst` = 3) and **M2** *"Industrial Metal Lathe Machine"* to 5299 Lathes (score 1), each in
all 3 runs. Both are the AI getting it right and the scorer being a token-overlap counter — which is
exactly why §4.1 rejected its candidate #2 (*"blanks correct picks: BINDER BD 53 Incubator … scores
1"*). §4.1 also asserts *"Rule A alone changes nothing on the 72-product DEV sample … `bestCat` /
`parentFromData` was never null"*. That premise is **false for `fuzzyCategoryFallback`** on 18 of the
21 machines products, and it becomes true as stated only once the `!hasCatId` condition is added.

**Implemented form**, at the 🔒 gate-1 site in `fuzzyCategoryFallback`:

```js
    if (hint) suggested.product_cat = [hint];
    if (CATEGORY_UNRESOLVED_ENABLED && !hasCatId) clearCategoryPair(data);
    return suggested;
```

Safe because `validateCategoryIds` (`services/smartExtractionValidator.js:106-116`) blanks any
`product_cat.id` that is **not** in the tree, and it runs immediately before this block — so a
non-empty `hasCatId` here is guaranteed in-tree. Rejecting an unevidenced `tree[0]` pick stays Rule
B's job. Pinned by `smartCategoryUnresolvedWire.test.js`, test *"an in-tree pick the token scorer
cannot corroborate is KEPT, not blanked"*.

`ensureCategoryPairForSiteType` (10e') needed **no** equivalent change: its
`parentFromData || bestCat || …` already preserves an existing in-tree parent.

### 14.2 §5.2b-5b's register is one short: **15 assertions across 12 tests**, not 14 across 11

`__tests__/siteTypeRoutingSignal.test.js`, test *"a confident, mappable type is not a fallback"*, is a
`toEqual` **deep-equality** assertion, so it has to name the new `source` key. It was not on
§5.2b-5's list of two. Measured under the merged bodies: `siteTypeRoutingSignal` **3** red (not 2),
`siteTypeRoutingWire` **9** red — exactly the nine, at exactly the lines §5.2b-5b names
(`:266 :296 :316 :343 :398 :496 :609 :694 :717`).

That `toEqual` was kept as a `toEqual` rather than loosened to `objectContaining`: it is what stops a
*fifth* key appearing on that return unnoticed. Every changed assertion carries its reason inline in
the test file. §5.2b-5b's warning on #7 was followed — the **fixture** changed (group b is now
`recycle`@0.95, an ALLOWED type) and a **second** test pins the new "an off-list group at confidence 0
loses the merge" fact. All 11 must-stay-green tests are green, including *empty-products fallback uses
the SITE-TYPE confidence*: `buildBatchDetectionHint` was **not** re-pointed at `detection.confidence`,
and the ALLOWED-type >= 0.92 case still skips vision.

### 14.3 Three §5.2b-3 deltas are no-ops in every endpoint-reachable state

Reverting each of these left **all 51** routing tests green. They were kept (the plan mandates them,
and they cost nothing) but **nobody should claim they are pinned**:

| Delta | Why it cannot be observed |
|---|---|
| the `catch` returning `siteType: null` instead of `"recycle"` | on that path `fromVision.confidence` is `0`, so if a usable hint exists `detConf >= 0` is true and the hint wins either way; if none exists, the new `if (siteType == null)` block produces exactly the `recycle` / 0 / low that the old literal produced |
| `siteType == null ||` in the hint contest | same reason. It bites only when `detConf` is non-comparable (`NaN`), which `JSON.parse` cannot produce |
| *(pinned after the fact)* `|| detConf < SITE_TYPE_LOW_CONFIDENCE` | reachable only for a **hand-built** hint, because builder-made hints already carry `site_type_low_confidence: true` below 0.6. A test was ADDED to `siteTypeRoutingWire.test.js` for the exported function's own contract, and it does go red on revert |

### 14.4 Suites, counts, and the three tests added beyond the plan

| Suite | Tests | Plan said | Gate? |
|---|---|---|---|
| `smartCategoryUnresolved` | **14** | 12 | no |
| `smartCategoryUnresolvedFlagOff` | **5** | 5 | **🔒 GREEN** |
| `smartCategoryUnresolvedWire` | **8** | *(new)* | no |
| `siteTypeHonestFallback` | **10** | 10 | no |
| `categoryNameEntities` | **16** | 16 | no |
| `categoryNameEntitiesWire` | **4** | *(new)* | no |
| `smartFieldHygiene` | **30** | 30 (the integration plan's 29 is one out — confirmed 30) | no |
| **total added by this phase** | **87** | 73 | |

**Why the two `*Wire` suites exist, and why `smartCategoryUnresolved` gained 2.** Revert experiments,
not taste:

| Deletion | Plan's suites | With the added suite |
|---|---|---|
| Rule B's **call site** in `processProductGroup` | GREEN | RED (2) |
| the three-branch `data.category_source` stamp | GREEN | RED (8) |
| both **subcategory** gates (🔒 2 and 🔒 5) | GREEN | RED (2) |
| all three `decodeHtmlEntitiesDeep(...)` **call sites** | GREEN | RED (2 / 1 / 1) |

That is the same hole Phase 1's verifier found in S0-2: the helper is perfect and unused, and every
suite is green.

Full revert-proof register — each mutation applied, suite run, then the file restored **byte-exact**
with the md5 re-checked:

`RP1` Rule B call site → RED · `RP2` `category_source` stamp → RED · `RP3` the `!hasCatId` guard → RED ·
`RP4` gate 1 un-gated → RED · `RP5` gate 3 un-gated → RED · `RP6` gates 2 + 5 un-gated → RED ·
`RP7` the `<0.6 → recycle` rewrite restored → RED · `RP8` off-list keeps its claimed confidence → RED ·
`RP11` the `if (siteType == null)` block deleted → RED · `RP12` `normalizeSiteType` default back to
`"recycle"` → RED · `RP13` the C13 enum **comparison** in `buildRoutingSignal`'s cap typo'd → RED ·
`RP14` weak-hint demotion → RED · `RP15 / 16 / 17` the three S0-4 decode call sites → RED ·
`RP18` year branch → RED · `RP19` co2 normalization → RED · `RP20` brand placeholders → RED.
`RP9`, `RP10` → **GREEN**; see §14.3.

One process note: a first pass of the revert harness reported RED for everything because it searched
the whole Jest output for the word "failed", which also appears in *"A worker process has failed to
exit gracefully"*. The verdicts above come from parsing the `Tests:` summary line only. A revert
harness that cannot report GREEN is worse than none.

### 14.5 Committing one file that holds another engineer's uncommitted work

`controller/wordPressSmart.js` is dirty at `HEAD + 8` with four hunks of an unrelated
AI-description change (`services/descriptionStyleRule.js`) — one **inside `export const __TEST__`**
and one **two lines above** S0-5's prompt edit. `git add <file>` would have committed all of it, and
`git add -p` is interactive and unavailable.

Method used: read the working tree, reverse-apply exactly those four hunks by literal string, write the
result into the **index only** (`git hash-object -w --stdin` + `git update-index --cacheinfo`), then
assert that no staged `+`/`-` line mentions `descriptionRule` / `buildDescriptionRule` /
`descriptionStyleRule`. The working tree is left byte-identical. `core.autocrlf=true` here, so the blob
must be LF-normalized or the entire file appears changed. Each commit's staged hunk list was read
before committing, and `git status --porcelain | wc -l` returned to **27** after every one.

A consequence worth knowing: **no test in this phase may call `buildExtractionSystemPrompt`**, because
in the committed tree it does not call `buildDescriptionRule` — such a test would pass in this working
tree and fail for the next clone. That is why S0-5's prompt change (Step 25) has no test, over and
above the plan's own "the prompt is a nudge, the normaliser is the contract".

### 14.6 What was NOT done, and what is still owed

| Plan step / gate | Status |
|---|---|
| Step 22 — live dev `escaped 0` check | **NOT RUN.** Needs the dev deploy. Read-only baseline re-confirmed today: `rows 37 escaped 18` |
| Step 27 — push to `dev` + `pm2 restart` | **NOT DONE, deliberately.** Out of scope for this work; the commits are local only |
| Step 28 — the after-table (`run.mjs` / `measure.mjs`) | **NOT RUN** (needs the deploy). Replaced by an offline replay for the one number that decides Rule B's width — §14.1. `year` / `co2` / escaped-name are deterministic normalisers pinned by unit tests |
| Step 29 — the app eyeball | **NOT DONE** — the app engineer's job per C9 |
| §5.3 — the web regression pass (3 consumers) | **NOT DONE.** No web page was loaded. Still required before anyone proposes a prod flip |
| **G7 / G8-live / G9 / G10** | **ALL OUTSTANDING** — every one needs a dev deploy. **G8's static half is GREEN**: the 5-test hard gate passes |

`GreenBridgeApp` was not touched: no app source file was edited by this work. Note for whoever runs
C9's check — `GreenBridgeApp/.env` line 1 currently reads `https://testapi.greenbidz.com/api/v1`, i.e.
**dev**, set by the concurrent app engineer and not by this phase.

### 14.7 For the downstream phases

- **C6 is satisfied on the server side.** `category_source` ships exactly `'ai' | 'fuzzy' |
  'unresolved'`; `CATEGORY_SOURCE` has no fourth member and a test asserts the enum by deep equality.
  Phase 4 must drop `'llm'` and `'default_parent'`.
- **C13 is satisfied.** `SITE_TYPE_SOURCE` is declared exactly once, in
  `services/smartExtractionValidator.js`, and all six former literals in the controller — including
  the **cap comparison** in `buildRoutingSignal` — reference it.
  `grep -c siteTypeSource controller/wordPressSmart.js` = **0**: no competing local variable exists.
- **C5 is satisfied.** `buildRoutingSignal` is still the single stamping seam (raw 5 / code 3 hits,
  unchanged from Phase 1) and `site_type_confidence` is still on the wire.
- **C10 stands as §9.4 states it, and the number is now firm at 12/72 = 17%** for a flat-tree
  first-row blank. Phase 3's on-device check #11 must use an **L1–L7** lab photo, or run with the flag
  at `0` and say so.
- **New fact for Phase 3 / Phase 4:** `site_type_confidence` is now **0**, not 0.5, whenever the
  marketplace was never identified — an off-list type, or a failed vision call with no usable hint. A
  client rule written as `confidence <= 0.5 ⇒ ask` still holds; one written as `confidence === 0.5`
  does not.
