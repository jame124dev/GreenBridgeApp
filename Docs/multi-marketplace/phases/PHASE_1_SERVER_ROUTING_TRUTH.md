# Phase 1 — Server: make routing honest and observable

**Implements:** `MULTI_MARKETPLACE_PLAN.md` §7 Stage 0, tasks **S0-1** and **S0-2**.
**Repo:** `c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend/` (Node ESM, `"type":"module"`).
**Target environment:** **DEV ONLY** — `https://testapi.greenbidz.com`, DB `greenbidz_test`.
**Date written:** 2026-08-18 · **Author:** senior engineer (plan only — this document changed no code).

Everything below was opened and confirmed today. Where a claim is *not* verified it says so in those
words. §11 is the drift register: the approved plan's line numbers for `controller/wordPressSmart.js`
were written against a **working tree that is 8 lines longer than every committed ref**, and three of
them are off by a further 1–4 lines.

---

## 0. Read this before you touch anything

Four facts that will waste your day if you learn them later.

1. **The line numbers in the approved plan do not match `git show main:`.** The local backend working
   tree has an **uncommitted** 9-line addition to `controller/wordPressSmart.js` (the AI-description
   fix). Everything after line ~570 in the working tree sits **+8** relative to `origin/main` /
   `main` / `dev` / `HEAD` (all four are byte-identical for this file today). This document gives
   **both** numbers and a `grep` anchor for every edit. Anchor on the `grep`, never on the number.
   §1.3 has the re-verify command.
2. **Uncommitted work in the backend tree must survive.** `git status --porcelain` today:
   `M controller/chatController.js`, `M controller/wordPress.js`,
   `M controller/wordPressGroupedSubmit.js`, `M controller/wordPressSmart.js`,
   `M middleware/chatAccess.js`, `M routes/chatRoute.js`, `M routes/wpProductRoutes.js`,
   `M socket/socket.js`, plus untracked `socket/socketAuth.js`, `services/descriptionStyleRule.js`
   and four untracked test files. That is the chat-IDOR fix, socket auth and the AI-description fix.
   **No `git stash`, no `git reset`, no `git checkout --`, no branch switch.** The local branch is
   `fix/seller-gate-existing-sellers` at `aabac85`.
3. **`config/dbConnection.js` opens a real Sequelize pool at import time**
   (`await sequelize.authenticate()`, `config/dbConnection.js:38-43`) and never closes it. Any Jest
   suite that transitively imports it **passes but does not exit**. Measured today:
   `__tests__/brandUnknownGuard.test.js` → 19 passed in 3.676 s, then hangs; with `--forceExit` it
   returns in the same 3.7 s. That is why one of the two new suites below mocks
   `../utils/categoryCache.js` (the *only* import `services/smartExtractionValidator.js` has —
   verified: `grep -c '^import' services/smartExtractionValidator.js` → **1**) and the other mocks
   `../config/dbConnection.js` as well.
4. **`dotenv.config()` in `config/dbConnection.js` takes no path**, so it loads `.env` from
   `process.cwd()`. Run every measurement script **with the backend directory as cwd**, or dotenv
   injects 0 variables, `DB_HOST` is undefined, and you get a misleading
   `ECONNREFUSED 127.0.0.1:3306`. I hit exactly this today; TCP to `34.44.20.223:3306` is open.

**Prohibited in this phase:** production writes, prod deploy, any migration, pushing `main` /
`101lab-main` / `admin-panel`, and touching `greenbidz-ai-assistant/`. Nothing here needs any of them.
`controller/wordPressSmart.old.js` is **dead** — nothing imports it
(`grep -rn "wordPressSmart.old" --include=*.js .` returns only the file itself). Do not edit it.

---

## 1. Scope, files, and how to re-verify the anchors

### 1.1 What this phase delivers

| Task | Outcome |
|---|---|
| **S0-1** | `inferSiteTypeFromProduct` may only override the vision result on a hit in `name` / `brand` / `model`. It no longer reads the AI-written `equipment_description`. Lab and machines beat IT on ties. **Measured on the DEV DB: false-101it overrides over 800 published lab listings drop 75 → 7 (9.4% → 0.9%), and all 7 residuals are genuinely IT hardware mis-filed into the lab bucket.** |
| **S0-2** | Every product on the wire carries `site_type_confidence` (number, 2 dp) and `site_type_source` (`'hint' \| 'vision' \| 'regex_override' \| 'low_confidence_fallback'`), **both describing the FINAL `site_type`** — after S0-1's override and after the `< 0.6 → recycle` rewrite. |

### 1.2 Files created and modified

**Modified — production code (2 files):**

| File | Responsibility of the change |
|---|---|
| `services/smartExtractionValidator.js` | **S0-1:** split `IT_PRODUCT_RE` into a strong and a weak half; rewrite `inferSiteTypeFromProduct` to read identity fields only and to let lab/machines win. **S0-2:** `normalizeDetectedSiteType` additively returns `detectedSiteType` + `lowConfidence` so a caller can tell "genuinely recycle" from "we were unsure". |
| `controller/wordPressSmart.js` | **S0-2 only:** thread the confidence and a source label from `runDetectionPass` → `detectionHint` → `resolveSiteTypeForGroup` → `processProductGroup`, collapse it in one **pure** helper `buildRoutingSignal`, and stamp the two fields onto `data`. Also copy the two new hint keys in `mergeTwoDetectionGroups`, and export three symbols on `__TEST__`. |

**Created — tests (2 files):**

| File | Covers |
|---|---|
| `__tests__/inferSiteTypeNarrowing.test.js` | S0-1. Hermetic: mocks `../utils/categoryCache.js`, so no DB and no `--forceExit`. Includes the four measured real-world regressions (N1 ×2, M6 ×2) as fixtures. |
| `__tests__/siteTypeRoutingSignal.test.js` | S0-2. Exhaustive table over the pure `buildRoutingSignal`, plus `normalizeDetectedSiteType`'s new keys, plus the one `resolveSiteTypeForGroup` branch reachable with zero IO (the ≥ 0.92 hint-skip path). |

**Created — measurement harness (scratchpad, NOT the repo):** in
`C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/`
alongside the backend audit's existing scripts. Full source in §2 and §6. Never commit these.

| File | Purpose |
|---|---|
| `rawkeys.mjs` | One DEV smart-detect call that dumps the **raw** key set of `products[0].data`, proving the two new fields absent before and present after. |
| `infer_ba.mjs` | Offline BEFORE/AFTER replay of the **real** exported function vs the S0-1 candidate over the audit's retained AI output (n = 57). |
| `scale_ba.mjs` | Large-N BEFORE/AFTER replay over 800 published lab listings; read-only `SELECT` on `greenbidz_test`. |
| `score.mjs` | Scores the live before/after runs and asserts the S0-2 contract. |
| `run2.mjs`, `set.json`, `set2.json` | **Already exist** from the backend audit. `run2.mjs` is re-used unchanged; **`set2.json` must be rewritten** — it currently holds only 3 photos, see §6.2/§6.3. |

> **`infer_ba.mjs` and `scale_ba.mjs` already exist on disk as well, holding an EARLIER
> candidate function.** Overwrite both with the source in §2.2 / §2.3 before running them, or
> you will measure the wrong candidate and conclude the numbers do not reproduce.

**Not modified by this phase:** `utils/categoryCache.js`, the **payload-building** statements in
`runSmartDetection` (main `:2341-2346`, `:2368-2382`) and in v2 (main `:3264-3270`, `:3346-3364`), the
SSE `product` event object, any route, any migration, any app source file,
`controller/wordPressSmart.old.js`. — Note `runSmartDetection` **is** edited, twice: its
`detectionHint` (§4.9) and its empty-products-fallback hint (§4.9(iii)). What stays untouched is how
either endpoint *serialises* `data`.

> **Why the payload builders need no edit — this is the point of the design.** Both payload builders
> put the same `data` object on the wire: v1 in `runSmartDetection` (main `:2341-2346`, wt
> `:2349-2354` — `data: result.data`) and v2 in the `product` event (main `:3264-3270`, wt
> `:3272-3278`), with `merged_single` being one of those same `data` objects (main `:3305-3328`, wt
> `:3313-3336`). Nothing between the stamp site and the wire rebuilds or whitelists `data` — verified
> by reading main `:2002-2014` → `:3264-3270` → `:3346-3364`, and corroborated by the live key dump in
> §2.1 (`data` arrives with all 23 keys including `market_metrics`, which no client reads). So
> stamping the fields onto `data` inside `processProductGroup` publishes them on **both** endpoints at
> once.

### 1.3 Re-verify the anchors before you edit (mandatory — `main` moves)

`main` is at `2c088bf` today and other developers landed Buy Now orders, DHL shipments, reseller
storefronts and a batch-feed fix. Run this first, from the backend directory:

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend

# 1. Confirm the uncommitted work is still there and you are not on a prod branch.
git status --porcelain
git rev-parse --abbrev-ref HEAD

# 2. Confirm the working tree's +8 offset, and that the uncommitted diff still sits
#    ABOVE the code you are about to edit.
git diff -U0 controller/wordPressSmart.js | grep '^@@'
# Expected today: @@ -33,0 +34 @@, @@ -233,0 +235,6 @@, @@ -548,0 +556 @@, @@ -560 +568 @@
# All four are < 600, so every S0-2 edit site is offset by exactly +8. If a hunk
# appears ABOVE line 600 that is no longer true — recompute with the greps below.

# 3. Anchor every edit site by content, not by number.
grep -n 'const IT_PRODUCT_RE\|^export function inferSiteTypeFromProduct\|^export function normalizeDetectedSiteType' services/smartExtractionValidator.js
grep -n '^const SITE_HINT_SKIP_VISION_MIN_CONF\|^export const __TEST__\|^function mergeTwoDetectionGroups\|^async function detectSiteTypeForGroup\|^function resolveSiteTypeFromHintOnly\|^async function resolveSiteTypeForGroup\|^async function processProductGroup\|^async function runDetectionPass\|^export async function runSmartDetection' controller/wordPressSmart.js
grep -n 'site_type_confidence: batchSite.confidence\|site_type_confidence: per.confidence\|site_type_confidence: group.site_type_confidence\|const inferred = inferSiteTypeFromProduct\|^  data.site_type = siteType;' controller/wordPressSmart.js
```

**Anchor table — committed ref (`origin/main` = `main` = `dev` = `HEAD`, verified identical today) and
working tree (wt = committed + 8):**

| Symbol | main | wt |
|---|---|---|
| `SITE_HINT_SKIP_VISION_MIN_CONF = 0.92` | 65 | 66 (`+1` — sits above the first hunk) |
| `export const __TEST__ = {` | 217 | 218 |
| `normalizeIdentityAndConfidence` (stamps `needs_clearer_photo`) | 802–813 | 810–821 |
| `mergeTwoDetectionGroups` — copies `site_type` / `site_type_confidence` | 946–963 (copy at 956–957) | 954–971 (copy at 964–965) |
| `detectSiteTypeForGroup` (returns; `catch` → `recycle`, conf 0) | 1596–1632 | 1604–1640 |
| `resolveSiteTypeFromHintOnly` | 1634–1647 | 1642–1655 |
| `resolveSiteTypeForGroup` (both returns) | 1649–1680 | 1657–1688 |
| `processProductGroup` (declaration / destructure) | 1914 / 1922–1923 | 1922 / 1930–1931 |
| the regex override | 1934–1938 | 1942–1946 |
| `data.site_type = siteType;` (the emit site) | 2002 | 2010 |
| `runDetectionPass` — zero-products fallback | 2116–2127 | 2124–2135 |
| `runDetectionPass` — per-product map (`site_type_confidence: per.confidence`) | 2130–2154 (2151) | 2138–2162 (2159) |
| v1 `runSmartDetection` — `detectionHint` | 2318–2321 | 2326–2329 |
| v2 — `detectionHint` | 3254–3257 | 3262–3265 |
| v2 — `product` event | 3264–3270 | 3272–3278 |
| v2 — final `payload` | 3346–3364 | 3354–3372 |

`services/smartExtractionValidator.js` is **byte-identical on `origin/main` and in the working tree**
(`git diff origin/main -- services/smartExtractionValidator.js` → empty). Its numbers need no offset:
`IT_PRODUCT_RE` **223-224**, `LAB_PRODUCT_RE` **226-227**, `MACHINE_PRODUCT_RE` **229-230**,
`inferSiteTypeFromProduct` **235-268** (IT tie-win at **258-260**), `normalizeSiteType` **41-50**,
`normalizeDetectedSiteType` **282-304** (off-list branch **291-296**, `< 0.6` branch **298-301**).

---

## 2. STEP 1 — Prove the bug is live, before you change anything

Do these three in order. Each produces an artifact you re-produce after the fix.

### 2.1 Step 1a — one live DEV call reproduces the centrifuge-as-GPU failure

Create the raw-key prober in the scratchpad (it is also the S0-2 before/after probe):

```bash
mkdir -p "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm"
cd "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm"
```

`rawkeys.mjs`:

```js
// READ-ONLY: one DEV smart-detect call; dumps the RAW key set of products[0].data
// so the presence/absence of site_type_confidence / site_type_source is provable.
// Creates no listing and no draft. DEV ONLY.
const BASE = "https://testapi.greenbidz.com/api/v1";
const url = process.argv[2];
const form = new FormData();
form.append("image_urls", url);
form.append("language", "en");
const res = await fetch(`${BASE}/wp/analyze-smart-detection-v2`, {
  method: "POST",
  headers: { "x-system-key": "fa39812fec", Accept: "text/event-stream" },
  body: form,
});
console.log("HTTP", res.status);
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "", result = null;
outer: while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  const frames = buf.split("\n\n");
  buf = frames.pop() ?? "";
  for (const f of frames) {
    const ev = /^event:\s*(.+)$/m.exec(f)?.[1]?.trim();
    const dl = f.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
    if (!dl) continue;
    let p;
    try { p = JSON.parse(dl); } catch { continue; }
    if (ev === "result") { result = p; break outer; }
  }
}
const d = result?.products?.[0]?.data ?? {};
console.log("top-level payload keys :", Object.keys(result || {}).join(","));
console.log("detection keys         :", Object.keys(result?.detection || {}).join(","));
console.log("products[0].data keys  :", Object.keys(d).sort().join(","));
console.log("site_type              :", d.site_type);
console.log("product_cat            :", JSON.stringify(d.product_cat), "/", JSON.stringify(d.subcategory));
console.log("site_type_confidence   :", "site_type_confidence" in d ? d.site_type_confidence : "*** ABSENT ***");
console.log("site_type_source       :", "site_type_source" in d ? d.site_type_source : "*** ABSENT ***");
```

Run it on the Sigma 3K15 benchtop centrifuge (the audit's N1):

```bash
node rawkeys.mjs "https://greenbidz.com/wp-content/uploads/2026/07/1785242820501-0-ITEM-50784-001.jpg"
```

**Measured output today, 2026-08-18, against DEV** — this exact command, recorded verbatim:

```
HTTP 200
top-level payload keys : success,language,detection,merged_single,products,suggested_terms,needs_clearer_photo,image_urls
detection keys         : suggested_mode,confidence,summary
products[0].data keys  : auc-location,auction_group,brand,co2_emissions,condition,country,currency,
                         dimensions,equipment_description,grade,locations,market_metrics,model,name,
                         needs_clearer_photo,operation_status,price,prices,product_cat,site_type,
                         subcategory,weight,year
site_type              : LabGreenbidz
site_type_confidence   : *** ABSENT ***
site_type_source       : *** ABSENT ***
```

That run is the **S0-2 baseline**: both fields absent from `products[].data`, and the only
`confidence` on the wire lives inside `detection`, where it is the how-many-products confidence.

Now the **S0-1 baseline**. Re-run the audit's harness on the same photo — it records the category too:

```bash
node run2.mjs N1 phase1_baseline_N1.json
```

**Measured output today**, also verbatim:

```
N1 truth=LabGreenbidz -> got=101it cat=Components/GPU Accelerators brand="SIGMA" model="3K1S"
   price=1800 prices={"new":"4000-6000","used":"1500-2500","scrap":"50-100"} ncp=false sugg=null 8392ms
```

**A laboratory centrifuge was sold as a "GPU Accelerator" on 101it, on DEV, today.** This photo flips
run to run (the audit measured 1/3 correct; my two runs today went `LabGreenbidz` once and `101it`
once), so **run it 3 times and record all three** before concluding anything.

### 2.2 Step 1b — the offline replay: 4 false overrides out of 57, deterministic

This is the reproduction that does not depend on the model. It imports the **real** exported function
(not a replica) and replays it over the AI text the audit retained on disk: `runB.json`, `runC.json`
(24 photos each) and `nA1.json`, `nA2.json`, `nA3.json` (the 3-centrifuge nameplate set × 3 runs) —
57 products.

> If those five JSON files are gone, regenerate them with `run2.mjs` over the sets in §6.2.
> **`runA.json` is not usable** — it kept only `desc_len`, not `desc`.

`infer_ba.mjs`:

```js
// PHASE-1 BEFORE/AFTER replay of inferSiteTypeFromProduct over the audit artifacts.
// READ-ONLY: reads JSON on disk only. No network, no DB, no source edits.
import fs from "node:fs";

// --- BEFORE: the real module, imported (not a replica) -------------------
const { inferSiteTypeFromProduct: before } = await import(
  "file:///C:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend/services/smartExtractionValidator.js"
);

// --- AFTER: the S0-1 candidate. MUST stay byte-identical to §3.1. --------
const IT_STRONG_RE =
  /\b(gpu|graphics\s*card|video\s*card|geforce|rtx|gtx|radeon|imac|macbook|mac\s*mini|laptop|notebook|iphone|ipad|android\s*phone|ssd|motherboard|desktop\s*pc)\b/i;
const IT_WEAK_RE =
  /\b(server|switch|router|firewall|monitor|printer|graphics|tablet|all[- ]in[- ]one)\b/i;
const IT_BRAND_RE = /\b(msi|nvidia|amd|apple|dell|hp|lenovo|asus)\b/i;
const LAB_PRODUCT_RE =
  /\b(centrifuge|microscope|hplc|spectrometer|pcr|autoclave|fermenter|bioreactor|incubator|chromatograph|mass\s*spec|flow\s*cytometer|laboratory|lab\s*equipment|fume\s*hood)\b/i;
const MACHINE_PRODUCT_RE =
  /\b(cnc|lathe|milling|surface\s*grind|grinder|press\b|forklift|compressor|excavator|industrial\s*machine|boring\s*machine|drilling\s*machine|machine\s*tool)\b/i;

function after(data) {
  const identity = [data?.name, data?.brand, data?.model].filter(Boolean).join(" ").toLowerCase();
  if (!identity.trim()) return null;
  const lab = LAB_PRODUCT_RE.test(identity);
  const machine = MACHINE_PRODUCT_RE.test(identity);
  const it = IT_STRONG_RE.test(identity) || (IT_WEAK_RE.test(identity) && IT_BRAND_RE.test(identity));
  if (lab) return it ? null : "LabGreenbidz";
  if (machine) return it ? null : "machines";
  if (it) return "101it";
  return null;
}

// Resolved against THIS SCRIPT's directory, not process.cwd(). That matters: the
// run command below sets cwd to the backend dir (so dotenv finds .env), and a plain
// relative `readFileSync("runB.json")` then dies with ENOENT. Measured.
const files = ["runB.json", "runC.json", "nA1.json", "nA2.json", "nA3.json"];
const rows = [];
for (const f of files)
  for (const r of JSON.parse(fs.readFileSync(new URL(f, import.meta.url), "utf8"))) {
    const d = r.products[0];
    if (!d) continue;
    const arg = { name: d.name, brand: d.brand, model: d.model, equipment_description: d.desc };
    rows.push({ f, id: r.id, truth: r.truth, final: d.site_type, before: before(arg), after: after(arg) });
  }
const tally = (k) => rows.reduce((a, r) => (a[String(r[k])] = (a[String(r[k])] || 0) + 1, a), {});
const falseIt = (k) => rows.filter((r) => r[k] === "101it" && r.truth !== "101it");
const trueIt = (k) => rows.filter((r) => r[k] === "101it" && r.truth === "101it");
console.log("n =", rows.length);
console.log("BEFORE tally:", JSON.stringify(tally("before")));
console.log("AFTER  tally:", JSON.stringify(tally("after")));
console.log("BEFORE false-101it:", falseIt("before").map((r) => r.f + ":" + r.id).join(", ") || "(none)");
console.log("AFTER  false-101it:", falseIt("after").map((r) => r.f + ":" + r.id).join(", ") || "(none)");
console.log("true-101it overrides kept: before=" + trueIt("before").length + " after=" + trueIt("after").length);
console.log("\n-- rows where before != after --");
for (const r of rows.filter((r) => String(r.before) !== String(r.after)))
  console.log(
    `${r.f.padEnd(10)} ${r.id.padEnd(3)} truth=${r.truth.padEnd(13)} final=${String(r.final).padEnd(13)} before=${String(r.before).padEnd(13)} after=${r.after}`
  );
```

> **A STALE `infer_ba.mjs` ALREADY EXISTS in `mm/`. Overwrite it with the source above
> before you run anything.** The copy left on disk by the audit session implements an
> **earlier** candidate (one `IT_PRODUCT_RE`, no strong/weak split, no `IT_BRAND_RE` gate,
> and `labHit` returning `LabGreenbidz` unconditionally). It runs clean and prints
> *different* numbers — true-101it overrides `8 -> 8` instead of `8 -> 6`, and the two `I5`
> rows missing from the diff — which reads as "the measurement does not reproduce".
> `scale_ba.mjs` in §2.3 is stale in the same way. Paste both from this document first.

Run it **from the backend directory** so dotenv finds `.env` (the import chain reaches
`config/dbConnection.js`; the DB is not used, but a wrong cwd produces a scary `ECONNREFUSED`).
With the `new URL(...)` reads above, cwd no longer decides whether the JSON files are found:

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/infer_ba.mjs"
```

**Measured today, before any source change.** `before` is the shipped function and `after` is the
§3.1 candidate, so one run gives you both halves:

```
n = 57
BEFORE tally: {"LabGreenbidz":16,"null":23,"machines":6,"101it":12}
AFTER  tally: {"LabGreenbidz":16,"null":31,"machines":4,"101it":6}
BEFORE false-101it: runB.json:M6, runC.json:M6, nA2.json:N1, nA3.json:N1
AFTER  false-101it: (none)
true-101it overrides kept: before=8 after=6

-- rows where before != after --
runB.json  M6  truth=machines      final=101it         before=101it         after=null
runB.json  M7  truth=machines      final=machines      before=machines      after=null
runB.json  I5  truth=101it         final=101it         before=101it         after=null
runC.json  L2  truth=LabGreenbidz  final=LabGreenbidz  before=LabGreenbidz  after=null
runC.json  L4  truth=LabGreenbidz  final=LabGreenbidz  before=LabGreenbidz  after=null
runC.json  M1  truth=machines      final=machines      before=machines      after=null
runC.json  M6  truth=machines      final=101it         before=101it         after=null
runC.json  I5  truth=101it         final=101it         before=101it         after=null
nA2.json   N1  truth=LabGreenbidz  final=101it         before=101it         after=LabGreenbidz
nA3.json   N1  truth=LabGreenbidz  final=101it         before=101it         after=LabGreenbidz
```

Read it like this — two of these rows are the whole point:

- **N1 (twice): `101it` → `LabGreenbidz`.** The trigger sentences are in the AI's own prose: nA3's is
  *"The power switch is located on the back of the unit."*, nA2's is *"An 'ON/OFF SWITCH' label
  indicates its location at the back of the centrifuge."* The identity fields are
  `name: "Laboratory Centrifuge"`, `brand: "SIGMA"`, `model: "3K1S"` — no IT word anywhere in them.
  Fixed.
- **M6 (twice): `101it` → `null`.** The trigger is *"…with a monitor attached to the left side."*;
  identity is `name: "Automated Optical Inspection (AOI) System"`, `brand: "TRI"`,
  `model: "TR7700 SIII 3D"`. `null` means *no override* — the vision answer stands.
- **6 rows lose an override that agreed with the final answer** (M7, I5 ×2, L2, L4, M1). For those the
  recorded `final` was already correct, but the artifacts **do not record the pre-override site
  type**, so it is **not knowable from disk** whether vision alone produces the same answer. That
  ambiguity is exactly what S0-2 removes, and §6 re-measures it live. Say so in the PR rather than
  claiming those six are neutral.

### 2.3 Step 1c — the large-N replay: 9.4% of 800 lab listings falsely overridden

`scale_ba.mjs` — read-only `SELECT`s against `greenbidz_test`; no writes, no DDL:

```js
// PHASE-1 large-N BEFORE/AFTER replay. READ-ONLY SELECTs against the DEV DB
// (greenbidz_test). Run from the backend dir so dotenv finds .env.
const NM = "file:///C:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend/node_modules";
const mysql = (await import(`${NM}/mysql2/promise.js`)).default;
const dotenv = (await import(`${NM}/dotenv/lib/main.js`)).default;
dotenv.config({ path: "C:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend/.env" });

const { inferSiteTypeFromProduct: before } = await import(
  "file:///C:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend/services/smartExtractionValidator.js"
);

const IT_STRONG_RE =
  /\b(gpu|graphics\s*card|video\s*card|geforce|rtx|gtx|radeon|imac|macbook|mac\s*mini|laptop|notebook|iphone|ipad|android\s*phone|ssd|motherboard|desktop\s*pc)\b/i;
const IT_WEAK_RE = /\b(server|switch|router|firewall|monitor|printer|graphics|tablet|all[- ]in[- ]one)\b/i;
const IT_BRAND_RE = /\b(msi|nvidia|amd|apple|dell|hp|lenovo|asus)\b/i;
const LAB_PRODUCT_RE =
  /\b(centrifuge|microscope|hplc|spectrometer|pcr|autoclave|fermenter|bioreactor|incubator|chromatograph|mass\s*spec|flow\s*cytometer|laboratory|lab\s*equipment|fume\s*hood)\b/i;
const MACHINE_PRODUCT_RE =
  /\b(cnc|lathe|milling|surface\s*grind|grinder|press\b|forklift|compressor|excavator|industrial\s*machine|boring\s*machine|drilling\s*machine|machine\s*tool)\b/i;

function after(data) {
  const identity = [data?.name, data?.brand, data?.model].filter(Boolean).join(" ").toLowerCase();
  if (!identity.trim()) return null;
  const lab = LAB_PRODUCT_RE.test(identity), machine = MACHINE_PRODUCT_RE.test(identity);
  const it = IT_STRONG_RE.test(identity) || (IT_WEAK_RE.test(identity) && IT_BRAND_RE.test(identity));
  if (lab) return it ? null : "LabGreenbidz";
  if (machine) return it ? null : "machines";
  if (it) return "101it";
  return null;
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
console.log("DB:", process.env.DB_DATABASE, "@", process.env.DB_HOST, "(must be greenbidz_test)");
for (const site of ["LabGreenbidz", "machines", "101it", "recycle"]) {
  const [rs] = await conn.query(
    `SELECT p.post_title t, LEFT(p.post_content,900) c FROM jos_posts p
     JOIN jos_postmeta ms ON ms.post_id=p.ID AND ms.meta_key='site_type' AND ms.meta_value=?
     WHERE p.post_type='product' AND p.post_status='publish' AND CHAR_LENGTH(p.post_content)>80 LIMIT 800`,
    [site]
  );
  let nb = 0, na = 0;
  const eg = [];
  for (const r of rs) {
    const desc = String(r.c).replace(/<[^>]+>/g, " ");
    if (before({ name: r.t, equipment_description: desc }) === "101it") nb++;
    if (after({ name: r.t }) === "101it") { na++; if (eg.length < 12) eg.push(r.t.slice(0, 64)); }
  }
  const pc = (n) => (n / rs.length * 100).toFixed(1) + "%";
  console.log(
    `${site.padEnd(13)} n=${String(rs.length).padEnd(4)} ->101it before=${String(nb).padEnd(4)}(${pc(nb)})  after=${String(na).padEnd(4)}(${pc(na)})`
  );
  if (site === "LabGreenbidz") eg.forEach((x) => console.log("      after-residual:", x));
}
await conn.end();
```

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/scale_ba.mjs"
```

**Measured today:**

```
DB: greenbidz_test @ 34.44.20.223 (must be greenbidz_test)
LabGreenbidz  n=800  ->101it before=75  (9.4%)  after=7   (0.9%)
      after-residual: MacBook Pro
      after-residual: GIGABYTE Graphics Card
      after-residual: ASUS Vivobook Laptop
      after-residual: HP Colour Laser Jet Flow MFP M880 Series Printer   (x4)
machines      n=65   ->101it before=0   (0.0%)  after=0   (0.0%)
101it         n=39   ->101it before=12  (30.8%) after=8   (20.5%)
recycle       n=5    ->101it before=0   (0.0%)  after=0   (0.0%)
```

**Reading it honestly:**

- **9.4% → 0.9%** on the lab bucket, and **all 7 residuals are real IT hardware mis-filed into lab** —
  a MacBook Pro, a GIGABYTE graphics card, an ASUS Vivobook, and the same HP office MFP four times. On
  those the override is arguably *right* and the ground-truth tag is wrong. Clear false positives
  after S0-1: **0 of 800.**
- `machines` and `recycle` gain **no** new false 101it — the gate's "no new false-machines/lab"
  condition holds on this sample.
- **The `101it` row understates retention; do not read it as a 4-listing regression.** This replay can
  only feed `post_title` as `name`; there is no `brand` or `model` column, and the live function sees
  all three. A real 101it listing usually carries `brand: "ASUS" / "Dell" / "HP"`, which is exactly
  what re-arms the weak-word branch. Honest statement: *the title-only proxy retains 8 of 12; live
  retention is higher by an unmeasured amount, and §6 measures it properly on real photos.*
- **Correction to the approved plan.** `MULTI_MARKETPLACE_PLAN.md` §8.3 gate 2 says the false-101it
  rate should drop "from 9% to ~0". Measured: **9.4% → 0.9%**, with 0 clear false positives. Restate
  the gate as **"≤ 1%, and every residual explainable as a genuinely mis-tagged listing"**.

---

## 3. STEP 2 — S0-1: narrow `inferSiteTypeFromProduct`

One file, two edits, both in `services/smartExtractionValidator.js`. No line offset — this file is
identical on every ref.

### 3.1 Step 2a — replace the regex block and the function

Replace lines **223-230** (the three `const … _RE` declarations; anchor:
`grep -n 'const IT_PRODUCT_RE' services/smartExtractionValidator.js`) with:

```js
// S0-1 (multi-marketplace Phase 1). `IT_PRODUCT_RE` used to be ONE regex whose
// members included the bare English words `switch`, `monitor`, `printer`,
// `server`, `graphics` and `tablet`. Because `inferSiteTypeFromProduct` matched
// it against the AI's own `equipment_description`, a single incidental sentence
// ("The power switch is located on the back of the unit.") routed a Sigma
// benchtop centrifuge to 101it and categorised it as a GPU Accelerator — live on
// DEV. Measured over 800 published lab listings: 75 (9.4%) falsely overridden.
//
// The split below is the fix, together with the identity-only text in
// `inferSiteTypeFromProduct`: a STRONG token is unambiguous IT hardware and may
// override on its own; a WEAK token is a word that industrial and laboratory
// equipment also uses for its own parts, and may only override when an IT brand
// stands beside it in the SAME identity fields.
const IT_STRONG_RE =
  /\b(gpu|graphics\s*card|video\s*card|geforce|rtx|gtx|radeon|imac|macbook|mac\s*mini|laptop|notebook|iphone|ipad|android\s*phone|ssd|motherboard|desktop\s*pc)\b/i;

const IT_WEAK_RE =
  /\b(server|switch|router|firewall|monitor|printer|graphics|tablet|all[- ]in[- ]one)\b/i;

const IT_BRAND_RE = /\b(msi|nvidia|amd|apple|dell|hp|lenovo|asus)\b/i;

const LAB_PRODUCT_RE =
  /\b(centrifuge|microscope|hplc|spectrometer|pcr|autoclave|fermenter|bioreactor|incubator|chromatograph|mass\s*spec|flow\s*cytometer|laboratory|lab\s*equipment|fume\s*hood)\b/i;

const MACHINE_PRODUCT_RE =
  /\b(cnc|lathe|milling|surface\s*grind|grinder|press\b|forklift|compressor|excavator|industrial\s*machine|boring\s*machine|drilling\s*machine|machine\s*tool)\b/i;
```

`LAB_PRODUCT_RE` and `MACHINE_PRODUCT_RE` are **unchanged** — copy them verbatim so the diff shows
they were not touched. `IT_PRODUCT_RE` disappears; confirm it has no other reader:

```bash
grep -rn 'IT_PRODUCT_RE' --include=*.js . | grep -v node_modules
# Before the edit the only hits are lines 223, 250, 252, 263, 264 of
# services/smartExtractionValidator.js (verified today). After the edit: only the
# two new names, in that same file.
```

Then replace lines **232-268** (the jsdoc plus the whole function; anchor:
`grep -n '^export function inferSiteTypeFromProduct' services/smartExtractionValidator.js`) with:

```js
/**
 * Rule-based marketplace guess from the product's IDENTITY fields, used to
 * override a wrong vision result (see processProductGroup in
 * controller/wordPressSmart.js).
 *
 * S0-1 changed two things and both are load-bearing:
 *
 *   1. It reads `name` / `brand` / `model` ONLY. It deliberately no longer reads
 *      `equipment_description` (AI-written prose — the proven source of the
 *      failure) or `_parent_category_hint` (a category name the SAME model
 *      guessed, so using it to overrule that model's site_type is circular).
 *   2. An explicit lab or machine noun in the identity now WINS. Previously the
 *      IT branch was tested first with `>=`, so IT took every tie.
 *
 * Returns `null` for "no opinion" — the caller then keeps the vision answer,
 * which is the right behaviour for an ambiguous identity. `null` is the common
 * case: 31 of 57 real products in the audit's replay.
 */
export function inferSiteTypeFromProduct(data) {
  const identityText = [data?.name, data?.brand, data?.model]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!identityText.trim()) return null;

  const labHit = LAB_PRODUCT_RE.test(identityText);
  const machineHit = MACHINE_PRODUCT_RE.test(identityText);
  // A weak IT word only counts with an IT brand beside it in the identity.
  const itHit =
    IT_STRONG_RE.test(identityText) ||
    (IT_WEAK_RE.test(identityText) && IT_BRAND_RE.test(identityText));

  // Lab and machine nouns are far more specific than IT's, so they win. When
  // BOTH an IT signal and a lab/machine signal are present the identity is
  // genuinely ambiguous — return null and let vision decide, rather than
  // picking a side on a coin flip.
  if (labHit) return itHit ? null : "LabGreenbidz";
  if (machineHit) return itHit ? null : "machines";
  if (itHit) return "101it";

  return null;
}
```

**Note on the three lines this deletes.** The old function ended with

```js
  if (IT_PRODUCT_RE.test(text) && !MACHINE_PRODUCT_RE.test(text)) return "101it";    // :263
  if (MACHINE_PRODUCT_RE.test(text) && !IT_PRODUCT_RE.test(text)) return "machines"; // :264
  if (LAB_PRODUCT_RE.test(text)) return "LabGreenbidz";                              // :265
```

Those three were **provably unreachable** and removing them changes nothing. `itScore` was
`IT_PRODUCT_RE.test(text) ? 3 : 0` (+1 brand bonus), so reaching `:263` required
`IT_PRODUCT_RE.test(text)` to be false — which makes `:263` itself false. Reaching `:264` then
required `MACHINE_PRODUCT_RE.test(text)` false, otherwise `machineScore = 3 > itScore = 0` returned at
`:262`. Reaching `:265` required `LAB_PRODUCT_RE.test(text)` false, otherwise `:261` returned. Put
this in the PR description so a reviewer does not read the deletion as a behaviour change.

**Also gone: the `+1` IT-brand score bonus** (old `:249-254`). It only ever mattered for breaking a
tie at 3 against lab/machine, and lab/machine now win those outright. The same brand signal is
re-used, more precisely, as the `IT_BRAND_RE` gate on weak words.

### 3.2 Step 2b — confirm the single caller

```bash
grep -rn 'inferSiteTypeFromProduct' --include=*.js . | grep -v node_modules
# Expected: services/smartExtractionValidator.js (definition)
#           controller/wordPressSmart.js:12 (import), :1942 wt / :1934 main (call)
#           controller/wordPressSmart.old.js:11,:954  <- DEAD FILE, nothing imports it. Ignore.
```

The signature (`data` object in, `string | null` out) is unchanged, so the caller needs no edit for
S0-1. It is edited by S0-2 in §4.

### 3.3 Step 2c — the S0-1 test

Create `__tests__/inferSiteTypeNarrowing.test.js`. It mocks `../utils/categoryCache.js`, which is
`services/smartExtractionValidator.js`'s **only** import — so nothing reaches
`config/dbConnection.js`, no DB connection opens, and the suite exits on its own with no
`--forceExit`.

```js
/**
 * S0-1 — `inferSiteTypeFromProduct` may only override on the IDENTITY fields.
 *
 * Why this suite exists: the shipped function matched a single regex containing
 * the bare words `switch` / `monitor` / `printer` / `server` / `graphics` /
 * `tablet` against the AI's own `equipment_description`, and IT won every tie.
 * That routed a Sigma benchtop centrifuge to 101it under the category "GPU
 * Accelerators", reproducibly, on DEV (audit artifacts nA2.json / nA3.json), and
 * falsely overrode 75 of 800 published lab listings (9.4%). The four cases in
 * `describe('regression fixtures')` are those exact real inputs.
 *
 * Hermetic: `services/smartExtractionValidator.js` has exactly ONE import
 * (`../utils/categoryCache.js`). Mocking it keeps `config/dbConnection.js` — which
 * opens a Sequelize pool at import time and never closes it — out of the module
 * graph, so this suite needs no `--forceExit`.
 *
 * Run: node --experimental-vm-modules node_modules/jest/bin/jest.js
 *      __tests__/inferSiteTypeNarrowing.test.js
 */

import { jest } from "@jest/globals";

jest.unstable_mockModule("../utils/categoryCache.js", () => ({
  ALLOWED_SITE_TYPES: new Set(["LabGreenbidz", "machines", "101it", "recycle"]),
  getCategoriesForPlatform: () => [],
  getSqlCategoriesForSiteType: () => [],
}));

const { inferSiteTypeFromProduct } = await import(
  "../services/smartExtractionValidator.js"
);

describe("inferSiteTypeFromProduct — identity fields only", () => {
  test("an IT keyword in equipment_description alone never overrides", () => {
    expect(
      inferSiteTypeFromProduct({
        name: "Laboratory Centrifuge",
        brand: "SIGMA",
        model: "3K1S",
        equipment_description:
          "The power switch is located on the back of the unit. A monitor shows the speed.",
      })
    ).toBe("LabGreenbidz");
  });

  test("_parent_category_hint is not read either (it is the same model's guess)", () => {
    expect(
      inferSiteTypeFromProduct({
        name: "Benchtop Autoclave",
        brand: "Tuttnauer",
        model: "3870EA",
        _parent_category_hint: "Components",
        equipment_description: "Rack-mount server room sterilizer.",
      })
    ).toBe("LabGreenbidz");
  });

  test("an IT keyword in the name still overrides", () => {
    expect(
      inferSiteTypeFromProduct({ name: "NVIDIA H100 NVL PCIe GPU", brand: "NVIDIA", model: "H100" })
    ).toBe("101it");
  });

  test("an IT keyword in the brand or model still overrides", () => {
    expect(
      inferSiteTypeFromProduct({ name: "Workstation", brand: "Apple", model: "MacBook Pro 16" })
    ).toBe("101it");
  });

  test("empty identity returns null even when the description is full of keywords", () => {
    expect(
      inferSiteTypeFromProduct({
        name: "",
        brand: "",
        model: "",
        equipment_description: "server switch monitor printer graphics tablet laptop",
      })
    ).toBeNull();
  });

  test("no recognised token anywhere returns null (vision keeps the decision)", () => {
    expect(
      inferSiteTypeFromProduct({ name: "Alliance Control Panel", brand: "Alliance", model: "" })
    ).toBeNull();
  });
});

describe("inferSiteTypeFromProduct — lab and machines win against IT", () => {
  test("lab noun beats a weak IT word in the same identity", () => {
    expect(
      inferSiteTypeFromProduct({ name: "Laboratory Incubator Monitor Unit", brand: "Binder", model: "BD 53" })
    ).toBe("LabGreenbidz");
  });

  test("machine noun beats a weak IT word in the same identity", () => {
    expect(
      inferSiteTypeFromProduct({ name: "CNC Lathe with Monitor", brand: "Mazak", model: "QT-10" })
    ).toBe("machines");
  });

  test("a lab noun beside a STRONG IT token is ambiguous → null, never 101it", () => {
    expect(
      inferSiteTypeFromProduct({ name: "Microscope Camera Laptop Bundle", brand: "Dell", model: "" })
    ).toBeNull();
  });

  test("a machine noun beside a STRONG IT token is ambiguous → null", () => {
    expect(
      inferSiteTypeFromProduct({ name: "Grinder Controller with SSD", brand: "", model: "" })
    ).toBeNull();
  });
});

describe("inferSiteTypeFromProduct — weak IT words need an IT brand", () => {
  test.each([
    ["Server Rack 46W x 52D x 213H cm", "", ""],
    ["Sartorius YDP30 Thermal Transfer Printer", "Sartorius", "YDP30"],
    ["AKTA UPC-900 UV Absorption Monitor", "GE", "UPC-900"],
    ["Creality CR-10 Smart Pro 3D Printer", "Creality", "CR-10"],
  ])("%p does not override on a weak word alone", (name, brand, model) => {
    expect(inferSiteTypeFromProduct({ name, brand, model })).toBeNull();
  });

  test.each([
    ["HP Colour Laser Jet Flow MFP M880 Printer", "HP", "M880"],
    ["Dell UltraSharp Monitor U2723QE", "Dell", "U2723QE"],
  ])("%p overrides when an IT brand stands beside the weak word", (name, brand, model) => {
    expect(inferSiteTypeFromProduct({ name, brand, model })).toBe("101it");
  });
});

describe("regression fixtures — the exact inputs measured on DEV", () => {
  // nA3.json / nA2.json, product 0. Ground truth LabGreenbidz; shipped code
  // returned 101it and the listing was categorised "Components / GPU Accelerators".
  test.each([
    "The power switch is located on the back of the unit.",
    "An 'ON/OFF SWITCH' label indicates its location at the back of the centrifuge.",
  ])("N1 Sigma 3K15 centrifuge stays lab despite: %p", (desc) => {
    expect(
      inferSiteTypeFromProduct({
        name: "Laboratory Centrifuge",
        brand: "SIGMA",
        model: "3K1S",
        equipment_description: desc,
      })
    ).toBe("LabGreenbidz");
  });

  // runB.json / runC.json, id M6. Ground truth machines; shipped code returned 101it.
  test.each([
    "The machine features a white and silver-colored casing with a monitor attached to the left side.",
    "A monitor is attached to the left side for operation.",
  ])("M6 TRI AOI machine is no longer forced to 101it despite: %p", (desc) => {
    expect(
      inferSiteTypeFromProduct({
        name: "Automated Optical Inspection (AOI) System",
        brand: "TRI",
        model: "TR7700 SIII 3D",
        equipment_description: desc,
      })
    ).toBeNull();
  });

  // runB.json / runC.json, id I5. Ground truth 101it. "monitor" is a WEAK token
  // and "SHARP" is not in IT_BRAND_RE, so the override correctly steps aside and
  // vision keeps the decision. Documented as intended, not as a regression.
  test("I5 dual-monitor desk yields no override (SHARP is not an IT brand token)", () => {
    expect(
      inferSiteTypeFromProduct({
        name: "Dual Monitor Setup with Logitech Keyboard and Mouse",
        brand: "SHARP",
        model: "",
      })
    ).toBeNull();
  });
});
```

Run it:

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/inferSiteTypeNarrowing.test.js
```

**Expected:** `Test Suites: 1 passed`, `Tests: 21 passed` (6 + 4 + 6 + 5, counting every
`test.each` row as its own test — counted from the code above, not observed), and the process exits without
`--forceExit`. If it hangs, the `categoryCache` mock did not take — check the relative path is exactly
`../utils/categoryCache.js`; `--forceExit` is a safe fallback and does not invalidate the result.

**Run this suite BEFORE the §3.1 edit too.** It must fail — the first case returns `"101it"`. That is
your proof the suite is bound to the real function and not to a stale copy.

### 3.4 Step 2d — re-run the two replays and diff against §2

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node ".../scratchpad/mm/infer_ba.mjs"     # BEFORE column must now equal the AFTER column
node ".../scratchpad/mm/scale_ba.mjs"     # LabGreenbidz: before=7 (0.9%)  after=7 (0.9%)
```

After the edit, `infer_ba.mjs`'s "BEFORE" column *is* the new shipped function, so the two columns
converge and `-- rows where before != after --` prints nothing. That convergence is the check: it
proves the source now behaves exactly like the candidate you measured in §2.

---

## 4. STEP 3 — S0-2: emit the routing signal per product

Two edits in `services/smartExtractionValidator.js` (§4.2 is the only one; the other is S0-1's §3.1)
and **seventeen edit sites** in `controller/wordPressSmart.js`, laid out one per sub-section §4.3–§4.10:
2 in §4.3, 1 each in §4.4/§4.5/§4.6, 3 in §4.7, 4 in §4.8, 4 in §4.9, 1 in §4.10. Work through them in
order — §4.8(iv) and §4.9(iii) exist only to feed each other, so skipping either leaves the
empty-products fallback emitting a confident `hint` for an unsure `recycle`.
All working-tree numbers assume the +8 offset from §1.3 still holds.

### 4.1 The contract you are implementing (plan §2.3, plus the types)

```
products[].data.site_type              string  — already shipped, unchanged
products[].data.site_type_confidence   number  — NEW. 0..1, 2 decimal places.
                                                 Describes the FINAL site_type.
products[].data.site_type_source       string  — NEW. Exactly one of:
                                                 'hint' | 'vision' | 'regex_override'
                                                 | 'low_confidence_fallback'
```

Three rules; the task fails if any is broken:

1. **`site_type_confidence` describes the FINAL `site_type`, not the pre-override one.** Naively
   returning the number `resolveSiteTypeForGroup` already computes ships a confidence about a
   *different* marketplace, because (a) `normalizeDetectedSiteType` rewrites a `< 0.6` answer to
   `recycle` while leaving `confidence` at the model's original value
   (`services/smartExtractionValidator.js:298-301` — verified: the branch touches `siteType`, never
   `confidence`), and (b) `inferSiteTypeFromProduct` overrides the result **afterwards**
   (`controller/wordPressSmart.js` wt `:1942-1946` / main `:1934-1938`).
2. **`regex_override` and `low_confidence_fallback` must carry a LOW confidence (≤ 0.5).** The regex
   has no confidence of its own, and a `recycle` produced by the fallback is a statement about the
   *absence* of evidence. The app treats both as **ask**.
3. `site_type === 'recycle'` is ambiguous on the wire — "genuinely recycle" *or* "we were unsure" —
   which is why `site_type_source` is not optional.

### 4.2 Step 3a — `normalizeDetectedSiteType` reports whether it fell back

`services/smartExtractionValidator.js`, replace lines **282-304** (anchor:
`grep -n '^export function normalizeDetectedSiteType' services/smartExtractionValidator.js`):

```js
/**
 * Normalize one detected site type.
 *
 * S0-2 added `detectedSiteType` and `lowConfidence` to the return value. They are
 * ADDITIVE — the three existing keys keep their exact previous meaning and
 * values, and all three call sites in controller/wordPressSmart.js destructure by
 * name. `lowConfidence: true` means "the site type on the way out is the `recycle`
 * fallback bucket, not a positive identification" — the only way a downstream
 * caller can tell "genuinely recycle" from "we were unsure", since both leave
 * `siteType === 'recycle'`.
 */
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
    return {
      siteType: "recycle",
      confidence,
      suggested_terms,
      detectedSiteType: siteType || null,
      lowConfidence: true,
    };
  }

  if (confidence < 0.6) {
    suggested_terms.site_type = [siteType];
    return {
      siteType: "recycle",
      confidence,
      suggested_terms,
      detectedSiteType: siteType,
      lowConfidence: true,
    };
  }

  return {
    siteType,
    confidence,
    suggested_terms,
    detectedSiteType: siteType,
    lowConfidence: false,
  };
}
```

The `< 0.6` branch used to mutate `siteType` and fall through to the shared `return`; this version
returns early. Values for `siteType`, `confidence` and `suggested_terms` are identical in all three
branches — check that against the original before moving on. Callers (verified today):
`controller/wordPressSmart.js` wt `:1627` / main `:1619`, wt `:2124` / main `:2116`, wt `:2139` /
main `:2131` — all destructure by name, so the two new keys break nothing.

### 4.3 Step 3b — the pure signal builder (this is what the tests pin)

`controller/wordPressSmart.js`. Add immediately after
`const SITE_HINT_SKIP_VISION_MIN_CONF = 0.92;` (wt `:66`, main `:65`):

```js
// S0-2 — the confidence a regex override is allowed to claim. The override has no
// confidence of its own, and the `<0.6 -> recycle` fallback is a statement about
// the ABSENCE of evidence, so both are capped here and the client treats both as
// "ask". Also the ceiling used by `buildRoutingSignal`.
const REGEX_OVERRIDE_CONFIDENCE = 0.5;
```

Then add this immediately **above** `async function processProductGroup(` (wt `:1922`, main `:1914`).
It must be a `function` declaration, not a `const`, so the `__TEST__` object at wt `:218` / main
`:217` can reference it at module-eval time — the comment already inside `__TEST__` explains that TDZ
trap.

```js
/**
 * S0-2 — collapse the routing decision into the two wire fields.
 *
 * PURE: no IO, no await, no module state. That is deliberate — it is the only
 * place the "which site_type does the confidence describe" rule lives, and it can
 * therefore be unit-tested exhaustively without mocking OpenAI or MySQL.
 *
 * @param {object}  a
 * @param {string}  a.siteType    the site type BEFORE the regex override
 * @param {number}  a.confidence  confidence for that pre-override site type
 * @param {string}  a.source      'hint' | 'vision' | 'low_confidence_fallback'
 * @param {?string} a.inferred    inferSiteTypeFromProduct's answer, or null
 * @returns {{site_type: string, site_type_confidence: number, site_type_source: string}}
 */
function buildRoutingSignal({ siteType, confidence, source, inferred }) {
  let finalSiteType = siteType;
  let finalConfidence =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? Math.min(1, Math.max(0, confidence))
      : 0.75;
  let finalSource = source || "vision";

  // The override runs AFTER extraction and replaces the vision answer, so the
  // confidence must be re-stated for the marketplace we actually deliver.
  if (inferred && inferred !== siteType) {
    finalSiteType = inferred;
    finalConfidence = REGEX_OVERRIDE_CONFIDENCE;
    finalSource = "regex_override";
  }

  // A `recycle` produced by the unknown/low-confidence fallback may never look
  // confident, even when the model claimed 0.95 for an off-list type it named.
  if (finalSource === "low_confidence_fallback") {
    finalConfidence = Math.min(finalConfidence, REGEX_OVERRIDE_CONFIDENCE);
  }

  return {
    site_type: finalSiteType,
    site_type_confidence: Math.round(finalConfidence * 100) / 100,
    site_type_source: finalSource,
  };
}
```

### 4.4 Step 3c — `detectSiteTypeForGroup` reports the fallback

Replace the `return` and the `catch` inside `detectSiteTypeForGroup` (wt `:1625-1639`, main
`:1617-1631`; anchor: `grep -n '^async function detectSiteTypeForGroup' controller/wordPressSmart.js`):

```js
  try {
    const parsed = await callOpenAIJson(messages, 220, 0);
    const normalized = normalizeDetectedSiteType(parsed);
    return {
      siteType: normalized.siteType,
      suggested_terms: normalized.suggested_terms,
      confidence:
        typeof parsed.site_type_confidence === "number"
          ? parsed.site_type_confidence
          : normalized.confidence,
      // S0-2: true when `siteType` above is the recycle fallback bucket rather
      // than a positive identification. NOTE the `confidence` on the lines above
      // is deliberately the model's RAW number, which can be < 0.6 while
      // `siteType` already reads "recycle" — that mismatch is exactly what this
      // flag exists to label.
      lowConfidence: normalized.lowConfidence === true,
    };
  } catch (err) {
    console.warn("detectSiteTypeForGroup failed:", err.message);
    return {
      siteType: "recycle",
      suggested_terms: {},
      confidence: 0,
      lowConfidence: true,
    };
  }
```

### 4.5 Step 3d — `resolveSiteTypeFromHintOnly` passes the flag through

Replace the `return` block of `resolveSiteTypeFromHintOnly` (wt `:1650-1654`, main `:1642-1646`):

```js
  return {
    siteType: fromDetection,
    confidence,
    suggested_terms: {},
    // S0-2: carried per product from runDetectionPass — see the detectionHint
    // objects at the two processProductGroup call sites (§4.9).
    lowConfidence: detectionHint.site_type_low_confidence === true,
  };
```

### 4.6 Step 3e — `resolveSiteTypeForGroup` returns confidence + source

Replace the whole body of `resolveSiteTypeForGroup` (wt `:1657-1688`, main `:1649-1680`; anchor:
`grep -n '^async function resolveSiteTypeForGroup' controller/wordPressSmart.js`). The **routing
behaviour is unchanged** — only the return shape grows:

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
      confidence: hinted.confidence,
      // Reachable WITH a high confidence: an off-list site_type named with
      // confidence 0.95 becomes `recycle` + lowConfidence, and `recycle` is
      // itself a mappable value, so it can pass the 0.92 skip gate.
      source: hinted.lowConfidence ? "low_confidence_fallback" : "hint",
    };
  }

  const fromVision = await detectSiteTypeForGroup(
    materializedSubset,
    language
  );
  let siteType = fromVision.siteType;
  let confidence = fromVision.confidence;
  let lowConfidence = fromVision.lowConfidence === true;
  let source = "vision";
  const suggested_terms = { ...(fromVision.suggested_terms || {}) };

  if (detectionHint?.site_type) {
    const fromDetection = normalizeSiteType(detectionHint.site_type, "");
    if (fromDetection && ALLOWED_SITE_TYPES.has(fromDetection)) {
      const detConf =
        typeof detectionHint.site_type_confidence === "number"
          ? detectionHint.site_type_confidence
          : 0.85;
      if (detConf >= fromVision.confidence) {
        siteType = fromDetection;
        confidence = detConf;
        lowConfidence = detectionHint.site_type_low_confidence === true;
        source = "hint";
      }
    }
  }

  if (lowConfidence) source = "low_confidence_fallback";

  return { siteType, suggested_terms, confidence, source };
}
```

### 4.7 Step 3f — `processProductGroup` stamps the two fields

Three edits inside `processProductGroup`.

**(i)** Replace the destructure (wt `:1930-1934`, main `:1922-1926`):

```js
  const {
    siteType: initialSite,
    suggested_terms: siteSuggested,
    confidence: initialConfidence,
    source: initialSource,
  } = await resolveSiteTypeForGroup(materializedSubset, language, detectionHint);

  let siteType = initialSite;
  let suggested_terms = { ...siteSuggested };
  // S0-2 — filled in below, once the regex override has had its say.
  let routingSignal = null;
```

**(ii)** Replace the override block (wt `:1942-1946`, main `:1934-1938`; anchor:
`grep -n 'const inferred = inferSiteTypeFromProduct' controller/wordPressSmart.js`):

```js
  const inferred = inferSiteTypeFromProduct(data);
  routingSignal = buildRoutingSignal({
    siteType,
    confidence: initialConfidence,
    source: initialSource,
    inferred,
  });
  // Keep the existing behaviour: the override must land on `data.site_type`
  // BEFORE pickCategoryFromTree / validateAndNormalizeExtraction read it, since
  // they load and validate that marketplace's category tree. When there is no
  // override, `routingSignal.site_type === siteType`, so this is a no-op.
  siteType = routingSignal.site_type;
  data.site_type = siteType;
```

**(iii)** Replace the stamp line (wt `:2010`, main `:2002`). There are **three**
`data.site_type = siteType;` lines in the file (main `:1857` inside `extractAttributes`, `:1937`
inside the override, `:2002` here) and there are **still three after edit (ii)** — the replacement
block in (ii) ends with that same line, unconditionally. So `grep` cannot disambiguate: match on the
surrounding two lines, which are `if (siteTypeUsesBrandSubcategories(...)) { … }` above and
`const subCount = (treeForSite || []).reduce(` below:

```js
  data.site_type = siteType;
  // S0-2 — the routing signal on the wire. Both fields describe the FINAL
  // site_type on the line above: after the regex override AND after the
  // `<0.6 -> recycle` rewrite. Stamped here, at the end of the function, so
  // nothing downstream can rewrite site_type without rewriting these too.
  // Both v1 (runSmartDetection) and v2 (SSE) put this same `data` object on the
  // wire, so no payload builder needs to change.
  data.site_type_confidence = routingSignal.site_type_confidence;
  data.site_type_source = routingSignal.site_type_source;
```

### 4.8 Step 3g — carry the flag on the detection groups

Three small edits in `runDetectionPass` and its merge helper. Without them a merged or zero-product
group silently loses the label.

**(i)** `mergeTwoDetectionGroups` (wt `:964-965`, main `:956-957`; anchor:
`grep -n 'target.site_type_confidence = source.site_type_confidence' controller/wordPressSmart.js`):

```js
    target.site_type = source.site_type;
    target.site_type_confidence = source.site_type_confidence;
    // S0-2 — must travel with the pair above, or a merged group loses the "this
    // was the fallback bucket" label. Reached from applyMergePairIndexes, which
    // mergeLikelyDuplicateGroups calls (wt :2192, :2194) AFTER the per-product
    // map below has stamped these keys.
    target.site_type_low_confidence = source.site_type_low_confidence;
    target.site_type_detected = source.site_type_detected;
```

**(ii)** the zero-products fallback (wt `:2128-2135`, main `:2120-2127`; anchor:
`grep -n 'site_type_confidence: batchSite.confidence' controller/wordPressSmart.js`):

```js
    products = [
      {
        id: "p-1",
        image_indexes: materialized.map((_, i) => i),
        site_type: batchSite.siteType,
        site_type_confidence: batchSite.confidence,
        site_type_low_confidence: batchSite.lowConfidence === true,
        site_type_detected: batchSite.detectedSiteType ?? null,
      },
    ];
```

**(iii)** the per-product map (wt `:2158-2160`, main `:2150-2152`; anchor:
`grep -n 'site_type_confidence: per.confidence' controller/wordPressSmart.js`):

```js
      site_type: per.siteType,
      site_type_confidence: per.confidence,
      site_type_low_confidence: per.lowConfidence === true,
      site_type_detected: per.detectedSiteType ?? null,
      siteSuggested: per.suggested_terms,
```

**(iv)** `runDetectionPass`'s own `return` (main `:2195-2210`; anchor:
`grep -n 'siteType: batchSite.siteType' controller/wordPressSmart.js`). The batch-level flag has to
leave the function, because the two **empty-products fallbacks** in §4.9(iii) read it from here:

```js
    products,
    siteType: batchSite.siteType,
    siteSuggested: batchSite.suggested_terms,
    // S0-2 — the batch-level "this was the recycle fallback bucket" flag. Its only
    // consumer is the empty-products-fallback detectionHint in §4.9(iii); without it
    // that path emits a confident-looking `hint` for a `recycle` that is really the
    // `<0.6` bucket.
    siteLowConfidence: batchSite.lowConfidence === true,
```

`applyMergePairIndexes` (main `:998-1030`) spreads `...p` at both ends — main `:1001-1004` when it
copies the working list and `:1026-1029` when it returns it — so the two new keys survive the
merge/split machinery on their own. Verified by reading it.

### 4.9 Step 3h — pass the flag into **all four** `detectionHint` objects

**v2 (SSE)** — wt `:3262-3265`, main `:3254-3257`:

```js
                {
                  site_type: group.site_type,
                  site_type_confidence: group.site_type_confidence,
                  site_type_low_confidence: group.site_type_low_confidence,
                },
```

**v1 (`runSmartDetection`, `POST /wp/analyze-smart-detection`)** — wt `:2326-2329`, main
`:2318-2321`, the identical object. **Do both.** The mobile app uses v2
(`EXPO_PUBLIC_SMART_DETECT_V2=1` in `GreenBridgeApp/.env`), but v1 is still mounted at
`routes/wpProductRoutes.js:165-169` and the web smart-upload reaches it; leaving v1 out would give
the two endpoints different contracts. **The approved plan's S0-2 file list omits v1 — see drift
item 17.**

**(iii) The two empty-products fallbacks — there are FOUR `processProductGroup` call sites, not
two.** `grep -n 'processProductGroup(' controller/wordPressSmart.js` → main `:1914` (the
declaration), `:2315` (v1 main), **`:2358` (v1 empty-products fallback)**, `:3251` (v2 main),
**`:3319` (v2 empty-products fallback)**. Both fallbacks pass a one-key hint:

```js
            { site_type: detection.siteType },
```

`detection.siteType` **is** defined — it is `batchSite.siteType` (main `:2208`), so it can already be
the `< 0.6 → recycle` bucket. With no confidence key, `resolveSiteTypeFromHintOnly` scores it 0,
vision runs, and then the contest substitutes `detConf = 0.85` (main `:1669-1672`) while
`site_type_low_confidence` reads `undefined`. Result: a `recycle` that really means "we were unsure"
ships as `site_type_source: 'hint'`, `site_type_confidence: 0.85` — exactly the mislabel contract
rule 3 exists to prevent, on the `merged_single` the app reads on the single-item path. Replace BOTH
hints (main `:2361` and main `:3322`) with:

```js
            {
              site_type: detection.siteType,
              site_type_confidence: detection.confidence,
              // S0-2 — from runDetectionPass's return (§4.8(iv)). Without this the
              // fallback path labels an unsure `recycle` as a confident `hint`.
              site_type_low_confidence: detection.siteLowConfidence === true,
            },
```

`detection.confidence` here is the **how-many-products** confidence, not a site-type confidence — it
is passed only so the contest has a real number instead of the hard-coded 0.85, and the
`site_type_low_confidence` flag is what actually makes the emitted `source` honest. Both fallbacks are
error-recovery paths (every product group has to fail to reach them), which is precisely why they must
not be the one path that lies.

### 4.10 Step 3i — export the three symbols for the tests

`controller/wordPressSmart.js`, inside `export const __TEST__ = {` (wt `:218`, main `:217`). Add all
three names to the **function-declarations** part of the object (immediately after `resolveEventSink`
is fine). All three are hoisted `function` / `async function` declarations, so no TDZ:

```js
  resolveEventSink,
  // S0-2 — routing-signal seam. `buildRoutingSignal` is pure; the other two are
  // exported so the branches reachable without IO can be asserted directly.
  buildRoutingSignal,
  resolveSiteTypeForGroup,
  resolveSiteTypeFromHintOnly,
```

`REGEX_OVERRIDE_CONFIDENCE` is a `const` at wt `:67` — **above** `__TEST__`, so it may also be added
safely if you prefer asserting against it rather than the literal `0.5`. Never add anything declared
*below* `__TEST__`; the comment already in that object says why.

### 4.11 Step 3j — the S0-2 test

Create `__tests__/siteTypeRoutingSignal.test.js`.

```js
/**
 * S0-2 — the per-product routing signal on the wire.
 *
 * The rule this suite defends is the one a reviewer specifically flagged:
 * `site_type_confidence` must describe the FINAL `site_type`. Two things rewrite
 * the site type after the number is computed — `normalizeDetectedSiteType`'s
 * `<0.6 -> recycle` fallback (which leaves `confidence` untouched) and
 * `inferSiteTypeFromProduct`'s override (which runs after extraction). Emitting
 * the pre-override number would ship a confidence about a marketplace the seller
 * is not being offered.
 *
 * `config/dbConnection.js` opens a Sequelize pool at import time and never closes
 * it, so it is mocked here — otherwise this suite passes and then hangs. If a
 * future import makes the mock insufficient, `--forceExit` is a valid fallback
 * (measured: brandUnknownGuard passes in 3.7 s either way).
 *
 * Run: node --experimental-vm-modules node_modules/jest/bin/jest.js
 *      __tests__/siteTypeRoutingSignal.test.js
 */

import { jest } from "@jest/globals";

jest.unstable_mockModule("../config/dbConnection.js", () => ({
  default: { query: jest.fn(async () => []) },
}));
jest.unstable_mockModule("../utils/categoryCache.js", () => ({
  ALLOWED_SITE_TYPES: new Set(["LabGreenbidz", "machines", "101it", "recycle"]),
  buildCompressedCategoryTree: () => "",
  ensureSmartDetectionCategories: async () => [],
  getCategoriesForPlatform: () => [],
  getSqlCategoriesForSiteType: () => [],
  startCategoryCacheRefresh: () => {},
}));

const { __TEST__ } = await import("../controller/wordPressSmart.js");
const { normalizeDetectedSiteType } = await import(
  "../services/smartExtractionValidator.js"
);
const { buildRoutingSignal, resolveSiteTypeForGroup } = __TEST__;

const VALID_SOURCES = ["hint", "vision", "regex_override", "low_confidence_fallback"];

describe("buildRoutingSignal — the emitted value describes the FINAL site type", () => {
  test("vision agrees with the regex: confidence and source pass through", () => {
    expect(
      buildRoutingSignal({
        siteType: "LabGreenbidz",
        confidence: 0.94,
        source: "vision",
        inferred: "LabGreenbidz",
      })
    ).toEqual({
      site_type: "LabGreenbidz",
      site_type_confidence: 0.94,
      site_type_source: "vision",
    });
  });

  test("no regex opinion (null): confidence and source pass through", () => {
    expect(
      buildRoutingSignal({ siteType: "machines", confidence: 0.88, source: "hint", inferred: null })
    ).toEqual({
      site_type: "machines",
      site_type_confidence: 0.88,
      site_type_source: "hint",
    });
  });

  test("THE BUG THIS TASK EXISTS FOR: an override re-states the confidence for the NEW site type", () => {
    const out = buildRoutingSignal({
      siteType: "LabGreenbidz",
      confidence: 0.97, // vision was very sure about LAB
      source: "vision",
      inferred: "101it", // ...and the regex overruled it
    });
    expect(out.site_type).toBe("101it");
    expect(out.site_type_source).toBe("regex_override");
    // It must NOT be 0.97 — that number was about LabGreenbidz.
    expect(out.site_type_confidence).toBe(0.5);
    expect(out.site_type_confidence).toBeLessThanOrEqual(0.5);
  });

  test("low_confidence_fallback is capped even when the model claimed high confidence", () => {
    // Reachable: an off-list site_type named with confidence 0.95 becomes
    // recycle + lowConfidence in normalizeDetectedSiteType.
    expect(
      buildRoutingSignal({
        siteType: "recycle",
        confidence: 0.95,
        source: "low_confidence_fallback",
        inferred: null,
      })
    ).toEqual({
      site_type: "recycle",
      site_type_confidence: 0.5,
      site_type_source: "low_confidence_fallback",
    });
  });

  test("an override on top of a fallback is labelled regex_override, still low", () => {
    expect(
      buildRoutingSignal({
        siteType: "recycle",
        confidence: 0.4,
        source: "low_confidence_fallback",
        inferred: "LabGreenbidz",
      })
    ).toEqual({
      site_type: "LabGreenbidz",
      site_type_confidence: 0.5,
      site_type_source: "regex_override",
    });
  });

  test("a missing or non-finite confidence defaults to the pipeline's own 0.75", () => {
    for (const bad of [undefined, null, NaN, Infinity, "0.9"]) {
      expect(
        buildRoutingSignal({ siteType: "machines", confidence: bad, source: "vision", inferred: null })
          .site_type_confidence
      ).toBe(0.75);
    }
  });

  test("out-of-range confidences are clamped to [0,1]", () => {
    expect(
      buildRoutingSignal({ siteType: "101it", confidence: 95, source: "vision", inferred: null })
        .site_type_confidence
    ).toBe(1);
    expect(
      buildRoutingSignal({ siteType: "101it", confidence: -3, source: "vision", inferred: null })
        .site_type_confidence
    ).toBe(0);
  });

  test("confidence is rounded to 2 dp so the wire value is stable", () => {
    expect(
      buildRoutingSignal({ siteType: "recycle", confidence: 0.8266666, source: "vision", inferred: null })
        .site_type_confidence
    ).toBe(0.83);
  });

  test("a missing source defaults to 'vision', never to undefined", () => {
    expect(
      buildRoutingSignal({ siteType: "recycle", confidence: 0.7, inferred: null }).site_type_source
    ).toBe("vision");
  });

  test.each([
    ["vision", null],
    ["hint", null],
    ["low_confidence_fallback", null],
    ["vision", "101it"],
  ])("source stays inside the contract's enum (%s / inferred=%s)", (source, inferred) => {
    const out = buildRoutingSignal({ siteType: "LabGreenbidz", confidence: 0.8, source, inferred });
    expect(VALID_SOURCES).toContain(out.site_type_source);
    expect(typeof out.site_type_confidence).toBe("number");
    expect(out.site_type_confidence).toBeGreaterThanOrEqual(0);
    expect(out.site_type_confidence).toBeLessThanOrEqual(1);
  });
});

describe("normalizeDetectedSiteType — the new additive keys", () => {
  test("a confident, mappable type is not a fallback", () => {
    expect(
      normalizeDetectedSiteType({ site_type: "LabGreenbidz", site_type_confidence: 0.9 })
    ).toEqual({
      siteType: "LabGreenbidz",
      confidence: 0.9,
      suggested_terms: {},
      detectedSiteType: "LabGreenbidz",
      lowConfidence: false,
    });
  });

  test("confidence < 0.6 rewrites to recycle, flags it, and keeps the real answer", () => {
    const out = normalizeDetectedSiteType({ site_type: "machines", site_type_confidence: 0.42 });
    expect(out.siteType).toBe("recycle");
    expect(out.lowConfidence).toBe(true);
    expect(out.detectedSiteType).toBe("machines");
    // The pre-existing contract must not move: confidence is NOT rewritten here.
    expect(out.confidence).toBe(0.42);
    expect(out.suggested_terms).toEqual({ site_type: ["machines"] });
  });

  test("an off-list type is a fallback even at high confidence", () => {
    const out = normalizeDetectedSiteType({ site_type: "electronics", site_type_confidence: 0.95 });
    expect(out.siteType).toBe("recycle");
    expect(out.lowConfidence).toBe(true);
    expect(out.confidence).toBe(0.95);
    expect(out.suggested_terms).toEqual({ site_type: ["electronics"] });
  });

  test("a missing confidence still defaults to 0.75 and is not a fallback", () => {
    const out = normalizeDetectedSiteType({ site_type: "101it" });
    expect(out.confidence).toBe(0.75);
    expect(out.lowConfidence).toBe(false);
  });
});

describe("resolveSiteTypeForGroup — the hint-skip path (the only branch with no IO)", () => {
  test("a >= 0.92 hint returns source 'hint' and its own confidence, with no vision call", async () => {
    const out = await resolveSiteTypeForGroup([], "en", {
      site_type: "machines",
      site_type_confidence: 0.96,
      site_type_low_confidence: false,
    });
    expect(out).toEqual({
      siteType: "machines",
      suggested_terms: {},
      confidence: 0.96,
      source: "hint",
    });
  });

  test("a >= 0.92 hint that came from the fallback bucket is labelled low_confidence_fallback", async () => {
    const out = await resolveSiteTypeForGroup([], "en", {
      site_type: "recycle",
      site_type_confidence: 0.95,
      site_type_low_confidence: true,
    });
    expect(out.siteType).toBe("recycle");
    expect(out.source).toBe("low_confidence_fallback");
  });
});
```

Run it:

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/siteTypeRoutingSignal.test.js
```

**Expected:** `Test Suites: 1 passed`, `Tests: 19 passed` (13 + 4 + 2, counting every
`test.each` row — counted from the code above, not observed). If the process does not return, add
`--forceExit` and note it in the PR — the pass/fail result is still valid.

**Run it before the §4 edits too.** It must fail — `__TEST__.buildRoutingSignal` is `undefined`
before the edit, so every `buildRoutingSignal(...)` call throws `TypeError: buildRoutingSignal is not
a function`. (The destructure itself does **not** throw, so the failure is at first call, not at
import.) That proves the suite is bound to the real controller and not to a copy.

---

## 5. Interfaces this phase produces

Nothing else in Phase 1 consumes these; later phases do. Exact names and types:

**On the wire — `products[].data` and `merged_single`, on BOTH endpoints**
(`POST /api/v1/wp/analyze-smart-detection-v2` SSE `product` **and** `result` events, and
`POST /api/v1/wp/analyze-smart-detection`):

```ts
site_type:            string   // unchanged: 'LabGreenbidz' | 'machines' | '101it' | 'recycle'
site_type_confidence: number   // NEW: 0..1, 2 dp, describes site_type above
site_type_source:     'hint' | 'vision' | 'regex_override' | 'low_confidence_fallback'  // NEW
```

**Additive and backward-compatible.** 1.0.3 clients are unaffected: `mapProductData` builds an
explicit object literal and never spreads the response
(`GreenBridgeApp/src/features/scanner/mapSmartDetection.ts:192-228`, verified today), so unknown keys
are dropped on the floor.

**Consumed by (later phases — do not build these here):**

| Consumer | What it must add |
|---|---|
| **M-6** — `GreenBridgeApp/src/features/scanner/smartDetectionTypes.ts` | `site_type_confidence?: number` and `site_type_source?: string` on `SmartProductData`, beside the existing `site_type?: string` (verified at `:37`). Carry both through `mapProductData` next to `suggestedMarketplace` (`smartDetectionTypes.ts:125`, `mapSmartDetection.ts:188`, `:209`, `:225`). |
| **M-3 / M-4** — the routing chip | Treat `site_type_source === 'regex_override'` **or** `'low_confidence_fallback'` as **ask**, regardless of the number. Treat `'hint'` / `'vision'` with the plan §2.3 bands once they are calibrated. |
| **v1.1 threshold calibration** (plan §2.3) | Log `site_type_confidence` + `site_type_source` against the marketplace the seller finally submitted, then set the bands from the agreement rate. Phase 1 exists to start that log. |

**Internal seams other server tasks reuse:**

| Symbol | Where | Shape |
|---|---|---|
| `buildRoutingSignal({siteType, confidence, source, inferred})` | `controller/wordPressSmart.js`, on `__TEST__` | pure → `{site_type, site_type_confidence, site_type_source}` |
| `REGEX_OVERRIDE_CONFIDENCE` | same file, `= 0.5` | the single ceiling for both low-trust sources |
| `normalizeDetectedSiteType(parsed).lowConfidence` / `.detectedSiteType` | `services/smartExtractionValidator.js` | **S0-3b builds directly on these** — it is the task that stops `recycle` being the silent bucket, and `detectedSiteType` is the real guess it will preserve. |

---

## 6. Measuring before/after on DEV with real photos

Offline replay proves the deterministic half. This proves the live half — including the six rows in
§2.2 whose pre-override site type the artifacts cannot tell us.

### 6.1 Point the app at DEV — and put it back afterwards

**Only needed for the optional on-device confirmation in §6.4.** §6.2/§6.3 are endpoint-level
measurement and need no app change. Do not edit `.env` unless you are actually running the app.

`GreenBridgeApp/.env` line 1 today, verified:

```
GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
```

That is **production**. `.env` is gitignored, so `git status` will not warn you and `git checkout`
will not restore it. An earlier session left this file on a localhost URL and it had to be recovered
from a backup. So:

```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp

# 1. BACK IT UP FIRST, under a name you will recognise.
cp .env "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/app.env.PHASE1BACKUP"

# 2. Verify the backup is byte-identical BEFORE editing anything.
diff .env "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/app.env.PHASE1BACKUP" && echo IDENTICAL

# 3. Point line 1 at DEV. Change ONLY that line; leave every other key alone.
#    GREENBIDZ_API_URL=https://testapi.greenbidz.com/api/v1

# 4. Restart Metro with --clear. `extra` is inlined at bundle time
#    (app.config.ts:255 -> src/lib/env.ts:9), so a hot reload is not enough.
npx expo start --clear
```

**RESTORE IT THE MOMENT YOU ARE DONE — same session, not "later":**

```bash
cd c:/Users/Pc/Desktop/greenBridge/GreenBridgeApp
cp "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/app.env.PHASE1BACKUP" .env
head -1 .env    # MUST read: GREENBIDZ_API_URL=https://api.101recycle.greenbidz.com/api/v1
```

A pristine copy of the production `.env` already exists at
`…/scratchpad/app.env.PRODBACKUP` — verified today as byte-identical to the current `.env`. That is
your second recovery path if the first backup is lost.

**Do not publish an EAS Update during this phase.** 1.0.3 is `WAITING_FOR_REVIEW` (build 19) and
`runtimeVersion` policy is `appVersion` (`app.config.ts:90-92`, verified), so an OTA for 1.0.3 would
reach the build Apple is testing. The app half of this work is 1.0.4.

### 6.2 The photo set (self-contained, so it survives a wiped scratchpad)

`run2.mjs` reads **`set2.json`** and nothing else — the filename is hard-coded at its line 5. The
`set2.json` on disk today holds **only N1, N2, N3** (the three centrifuge nameplates, 544 bytes), so
running it as-is measures three photos and **cannot evaluate pass conditions 2, 5 or 6** in §6.3,
which need I1, I5 and M6.

**So this is a required step, not a fallback:** copy the existing `set2.json` aside and write the
15-row array below over it. It is a superset — it keeps N1/N2/N3 and adds the routing-critical rows of
the audit's 24-photo `set.json` (`set.json` itself stays untouched and is the authority on URLs).

```bash
cd "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm"
cp set2.json set2.nameplates3.json     # keep the original 3-photo set
# then write the JSON below to set2.json
```

```json
[
 {"id":"N1","truth":"LabGreenbidz","title":"Sigma 3K15 Benchtop Centrifuge","url":"https://greenbidz.com/wp-content/uploads/2026/07/1785242820501-0-ITEM-50784-001.jpg"},
 {"id":"N2","truth":"LabGreenbidz","title":"Sigma 4K10 Refrigerated Centrifuge","url":"https://greenbidz.com/wp-content/uploads/2026/07/1785242688636-0-ITEM-38131-001.jpg"},
 {"id":"N3","truth":"LabGreenbidz","title":"Beckman Coulter Avanti JXN-26","url":"https://greenbidz.com/wp-content/uploads/2026/07/1785241971289-0-ITEM-52597-001.jpg"},
 {"id":"M6","truth":"machines","title":"TRI TR7700 3D AOI Inspection Machine","url":"https://storage.googleapis.com/greenbidz/sellers/768/2026/07/c246db122426/Image_29-07-2026_at_17.50_(1).png"},
 {"id":"M1","truth":"machines","title":"Surface grinder 500x1000","url":"https://greenbidz.com/wp-content/uploads/2026/07/1784174399115-photo-0.jpg"},
 {"id":"M7","truth":"machines","title":"Waldrich Coburg rail planing machine","url":"https://greenbidz.com/wp-content/uploads/2026/07/1783514157867-0-1781260353446-ItemA_Waldrich_Coburg_Rail_Planing_Machine_01.jpg"},
 {"id":"L2","truth":"LabGreenbidz","title":"Nikon SMZ800 Stereo Microscope","url":"https://greenbidz.com/wp-content/uploads/2026/07/1785242900509-0-ITEM-54205-001.jpg"},
 {"id":"L4","truth":"LabGreenbidz","title":"Philips PU 8620 UV/VIS Spectrophotometer","url":"https://greenbidz.com/wp-content/uploads/2026/07/1785242898981-0-ITEM-45439-001.jpg"},
 {"id":"L7","truth":"LabGreenbidz","title":"Waters Alliance e2695 control panel","url":"https://storage.googleapis.com/greenbidz/sellers/1058/2026/08/16565ff87e2c/186fdda6-864c-4bc5-bfbc-a5e4d49edc48.webp"},
 {"id":"I1","truth":"101it","title":"NVIDIA H100 NVL PCIe GPU","url":"https://storage.googleapis.com/greenbidz/sellers/768/2026/07/bd01a18e928a/H100_images.png"},
 {"id":"I2","truth":"101it","title":"TP-Link Omada EAP610 access point","url":"https://storage.googleapis.com/greenbidz/sellers/574/2026/07/a54bb8881c48/17848595424755679234897012379173.jpg"},
 {"id":"I3","truth":"101it","title":"ASUS Vivobook laptop","url":"https://storage.googleapis.com/greenbidz/sellers/574/2026/07/077be2eedbff/17848591253228419948999014579135.jpg"},
 {"id":"I5","truth":"101it","title":"Dual monitors on a desk","url":"https://greenbidz.com/wp-content/uploads/2026/07/1784025555094-product-6-photo-0.jpg"},
 {"id":"R2","truth":"recycle","title":"Two upholstered office chairs","url":"https://greenbidz.com/wp-content/uploads/2026/07/1784025555089-product-4-photo-0.jpg"},
 {"id":"R4","truth":"recycle","title":"Conference table + chairs + wall TV","url":"https://greenbidz.com/wp-content/uploads/2026/07/1784025555092-product-5-photo-0.jpg"}
]
```

These URLs are transcribed from `set.json` / `set2.json` as they stand on disk today. **I did not
re-fetch any of them.** `set.json` is present, so cross-check each URL against it before you run —
where they differ, `set.json` wins. Confirm the rewrite took with
`node -e "console.log(require('./set2.json').length)"` → must print **15**.

### 6.3 The run — 3× before, 3× after, same photos, same order

`run2.mjs` itself needs no edit, **but it only runs whatever is in `set2.json` — do §6.2 first.**
It reads `set2.json` (hard-coded, its line 5), POSTs one `image_urls` field as **multipart** (a
urlencoded body arrives empty — multer), consumes the SSE stream and records the `result` event. It
creates **no listing and no draft**. `argv[2]` is a comma-separated id filter and an empty string
means "all"; `argv[3]` is the output file.

```bash
cd "C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm"

# BEFORE — run this at Step 1, on unmodified source, against dev.
node run2.mjs "" p1_before_1.json && node run2.mjs "" p1_before_2.json && node run2.mjs "" p1_before_3.json

# ... apply §3 + §4, restart the dev backend (§7.3) ...

# AFTER
node run2.mjs "" p1_after_1.json && node run2.mjs "" p1_after_2.json && node run2.mjs "" p1_after_3.json
```

`run2.mjs` records only a whitelist of `data` keys, so for the S0-2 half also run the raw prober on
two photos before and after:

```bash
node rawkeys.mjs "https://greenbidz.com/wp-content/uploads/2026/07/1785242820501-0-ITEM-50784-001.jpg"
node rawkeys.mjs "https://greenbidz.com/wp-content/uploads/2026/07/1784025555092-product-5-photo-0.jpg"
```

Then score it. `score.mjs`:

```js
// PHASE-1 scoring of the live before/after runs. READ-ONLY (reads JSON on disk).
import fs from "node:fs";
const load = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const sets = {
  before: ["p1_before_1.json", "p1_before_2.json", "p1_before_3.json"],
  after: ["p1_after_1.json", "p1_after_2.json", "p1_after_3.json"],
};
for (const [phase, files] of Object.entries(sets)) {
  let hit = 0, tot = 0;
  const wrong = [];
  for (const f of files)
    for (const rec of load(f)) {
      const d = rec.products[0] || {};
      tot++;
      if (d.site_type === rec.truth) hit++;
      else wrong.push(`${rec.id}:${rec.truth}->${d.site_type}`);
    }
  console.log(`${phase}: routing ${hit}/${tot} = ${(hit / tot * 100).toFixed(0)}%`);
  console.log(`   misroutes: ${wrong.join(", ") || "(none)"}`);
}
```

**Pass conditions:**

| # | Condition |
|---|---|
| 1 | N1 routes to `LabGreenbidz` in **3/3** after runs (before: 1/3 in the audit; 1 of my 2 ad-hoc runs today). Its category must stop being `Components / GPU Accelerators`. |
| 2 | Overall routing on this set is **≥ the before number you measured**, and no *new* misroute class appears. Restate the plan's "≥ 85%" against your own before number, not against the audit's 89%. |
| 3 | Every product in every after run carries `site_type_confidence` (number, 0–1) and `site_type_source` ∈ the four-value enum. Prove it with `rawkeys.mjs`, whose output is the raw key set. |
| 4 | **Wherever `site_type_source` is `regex_override` or `low_confidence_fallback`, `site_type_confidence <= 0.5`.** This is the contract check — assert it, do not eyeball it. |
| 5 | I5 (dual monitors) and I1 (H100 GPU) still route to `101it`. §2.2 shows I5 loses its *override*; this confirms vision alone keeps it right. If I5 flips, record it — that is the one honest cost of S0-1 and it is a product decision, not something to hide. |
| 6 | M6 lands on `machines` **or** stays wrong. If it stays wrong, `site_type_source` must now read `vision`, not `regex_override` — converting a silent deterministic bug into a visible model limitation. That is the phase succeeding, not failing. |

### 6.4 Optional on-device confirmation

Only if you want to see it end to end. Point `.env` at dev per §6.1, scan the Sigma centrifuge photo,
confirm the review screen shows a lab category rather than "GPU Accelerators", **restore `.env`**.
Nothing in Phase 1 changes the app, so this is confirmation, not a gate. No UI is added or altered in
this phase, so `UX_DESIGN_RULES.md` has no applicable checklist item here — the UX work lands in M-3 /
M-8 / M-10.

### 6.5 Web regression check before anyone talks about prod

S0-1 changes what the **web** smart-upload sees too (same `processProductGroup`). Per plan §8.1,
regression-check the web smart-upload on dev before prod is even discussed. Prod is a separate,
owner-approved step and is **out of scope for this phase**.

---

## 7. Verification

### 7.1 Commands, in order

```bash
cd c:/Users/Pc/Desktop/greenBridge/101recycle-greenbidz-backend

# 1. Nothing was lost. Compare against the §0.2 list.
git status --porcelain
git rev-parse --abbrev-ref HEAD        # must NOT be main / dev / a prod branch

# 2. Only the intended files changed.
git diff --stat
# Expected modified: controller/wordPressSmart.js, services/smartExtractionValidator.js
#                    (plus the pre-existing modifications from §0.2, untouched)
# Expected new untracked: __tests__/inferSiteTypeNarrowing.test.js
#                         __tests__/siteTypeRoutingSignal.test.js

# 3. The two new suites.
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/inferSiteTypeNarrowing.test.js
node --experimental-vm-modules node_modules/jest/bin/jest.js __tests__/siteTypeRoutingSignal.test.js

# 4. The suites that touch this controller and validator.
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  __tests__/brandUnknownGuard.test.js \
  __tests__/wordPressSmart.controller.test.js \
  __tests__/descriptionStyleRule.test.js \
  __tests__/smartDetectI18n.test.js \
  __tests__/smartDetectValidateInput.test.js \
  --forceExit

# 5. Neither new suite can catch a MISSING stamp — both test the pure helper, not
#    processProductGroup. So check the five edit sites landed, by content:
grep -n 'data.site_type_confidence = routingSignal' controller/wordPressSmart.js   # expect 1
grep -n 'data.site_type_source = routingSignal' controller/wordPressSmart.js       # expect 1
# ⚠ CORRECTED 2026-08-19 — the three counts below were WRONG as first written and are
#   now restated as CODE-ONLY counts (comment lines excluded), because raw `grep -c`
#   counts prose too and this file's prose names its own symbols. Measured on the
#   working tree at aa0635b. See §13.3 for the reconciliation.
grep -c 'site_type_low_confidence' controller/wordPressSmart.js                    # raw 7  -> code 6
grep -c 'siteLowConfidence' controller/wordPressSmart.js                           # raw 2  -> code 2
grep -c 'buildRoutingSignal' controller/wordPressSmart.js                          # raw 5  -> code 3
# Code-only, if you want the number the comments cannot move:
grep -n 'site_type_low_confidence' controller/wordPressSmart.js | grep -vE '^[0-9]+: *(//|\*|/\*)' | wc -l   # 6
grep -n 'siteLowConfidence'        controller/wordPressSmart.js | grep -vE '^[0-9]+: *(//|\*|/\*)' | wc -l   # 2
grep -n 'buildRoutingSignal'       controller/wordPressSmart.js | grep -vE '^[0-9]+: *(//|\*|/\*)' | wc -l   # 3
# Two more, added by the authorised builder refactor — both must be present:
grep -c 'buildGroupDetectionHint' controller/wordPressSmart.js                     # 4 (all code)
grep -c 'buildBatchDetectionHint' controller/wordPressSmart.js                     # raw 6 -> code 4
# NOTE this whole step is now largely redundant: __tests__/siteTypeRoutingWire.test.js
# asserts the stamp AT THE ENDPOINT, so a missing stamp is a red test, not a grep miss.
# The greps remain only as a fast pre-test smoke check.
# The only real proof of LIVE emission is still the rawkeys.mjs run in §6.3 (conditions
# 3-4) — and per §13.4 that run was never performed. See §13.4 before deploying.

# 6. Full suite.
npm test

# 7. Offline replays converge (§3.4).
node ".../scratchpad/mm/infer_ba.mjs"
node ".../scratchpad/mm/scale_ba.mjs"

# 8. Live before/after on dev (§6.3), then:
node ".../scratchpad/mm/score.mjs"
```

### 7.2 Known baselines — do not chase these

- **Backend full suite (`npm test`): 2 pre-existing failing suites — `zohoListingSyncPublished` and
  `uploadValidationService`.** They fail before this phase and must still be the *only* failures
  after. Anything else is yours. *(Given as the project baseline; I did not re-run the full suite —
  see §10.)*
- **Any suite that transitively imports `config/dbConnection.js` passes and then hangs**, because the
  Sequelize pool stays open. Measured: `brandUnknownGuard.test.js` → 19 passed in 3.676 s, no exit;
  with `--forceExit`, identical result in the same time. Use `--forceExit` for single-file runs of
  those suites. `__tests__/inferSiteTypeNarrowing.test.js` avoids the need by mocking
  `../utils/categoryCache.js`.
- **App: 0 `tsc` errors, 92 suites / 825 tests.** Unchanged by this phase — **no app source file is
  touched.** The only app-side action is the temporary `.env` edit in §6.1, which is gitignored and
  must be restored. *(Given as the project baseline; not re-run.)*
- Jest must be launched as `node --experimental-vm-modules node_modules/jest/bin/jest.js …`. Calling
  `jest` directly fails on `import` — `jest.config.js:1-7` says exactly that.

### 7.3 Deploying to dev for §6.3's "after" runs

`testapi.greenbidz.com` is the dev backend: port **6000**, DB `greenbidz_test`. Prod is port 4000 /
`greenbidz`, and a `PORT=4000` collision once made "prod" serve the test DB — so verify port↔DB if
the numbers look wrong. Deploying dev is `git pull` + `pm2 restart` on the server per
`DEPLOYMENTS.md`. **Confirm with the owner before the SSH restart** — it is a deploy action, and per
the standing rule earlier approval does not carry to the next action. Do not push `main`.

---

## 8. What this phase does NOT do

- **It does not improve the model.** It removes a deterministic wrong override and labels the rest. L7
  (a bare HPLC control panel) and R4 (conference furniture with a wall TV) were vision's own errors
  before and remain vision's own errors after — `infer()` returned `null` on both, before and after
  (§2.2). No prompt, no model, no vision-provider change.
- **It does not make the category stop guessing.** "Boring & Drilling Machines" on a welding fixture
  is **S0-3a** (`fuzzyCategoryFallback` / `ensureCategoryPairForSiteType` / `pickDefaultParent`), a
  separate task. This phase does not touch `category_source`.
- **It does not stop `recycle` being the silent bucket for "unknown".** That is **S0-3b**. Phase 1
  only *labels* the bucket (`site_type_source: 'low_confidence_fallback'`, plus
  `normalizeDetectedSiteType`'s new `detectedSiteType`, the value S0-3b will preserve). The
  `< 0.6 → recycle` rewrite still happens, with byte-identical values for the three original keys.
- **It does not add a top-level rollup field** to the payload. The signal is per product, on `data`,
  by design — the audit's finding was that the existing top-level `suggested_terms.site_type` loses
  which product it belonged to (main `:3356` / wt `:3364`).
- **It does not ship a confidence threshold.** Plan §2.1: v1 confirms always; the §2.3 bands get
  calibrated from logged agreement once this emission has been running.
- **It does not unlock any marketplace in the app.** All three switch-off sites plus the currency lock
  are untouched: `MarketplaceCard.tsx:22`, `scanDraftStore.ts:413`, `app/scan/processing.tsx:504-508`,
  `mapSmartDetection.ts:157`. That is **M-4**. *(Those four references are quoted from the approved
  plan; I did not re-open them — see §10.)*
- **It does not HTML-unescape the recycle category names** (S0-4), fix `year: "null"` /
  `co2_emissions: "0 kg"` (S0-5), or add taxonomy rows (S0-6).
- **It does not touch prod.** No prod write, no prod deploy, no migration, no push of `main`. Prod is
  a separate owner-approved step after dev measurement.
- **It does not touch `greenbidz-ai-assistant/`.**
- **It does not submit a listing.** The mixed-submit release gate (plan §8.3 gate 3) is not this
  phase's job.

---

## 9. What must land before / after

### Before (all satisfied today — re-check §1.3 anyway)

1. **Nothing.** Phase 1 has no upstream code dependency. It is the first Stage-0 task and can start
   immediately.
2. Preconditions, not dependencies: the backend tree's uncommitted work is intact (§0.2); the audit
   artifacts `runB.json`, `runC.json`, `nA1-3.json`, `set.json`, `set2.json` and `run2.mjs` are
   present in `…/scratchpad/mm/` (verified today) or regenerable per §2.2 / §6.2; the DEV DB
   `greenbidz_test` is reachable (verified: `34.44.20.223:3306` open, 87 vars loaded from `.env`).

### After — in this order

1. **S0-3b** — *stop `recycle` being the silent bucket.* Consumes
   `normalizeDetectedSiteType(...).detectedSiteType` and `.lowConfidence` directly. Sequencing it
   after Phase 1 means it starts from a return value that already carries the real guess.
2. **S0-3a** — *let the category picker say "I don't know."* Logically independent of Phase 1 but it
   edits the same function (`processProductGroup`) in the same file. Land Phase 1 first to keep the
   diffs reviewable; the two collide textually, not logically.
3. **S0-4 / S0-5** — recycle name unescaping and field hygiene. Fully independent; any order.
4. **Dev measurement (§6) → owner approval → prod.** Non-negotiable, and explicitly out of this
   phase's scope. Regression-check the **web** smart-upload before prod is discussed (§6.5), because
   S0-1 changes what the web sees too.
5. **M-6** (app) — add the two fields to `SmartProductData` and carry them through `mapProductData`.
   Cannot start meaningfully until Phase 1 is on dev, since there is nothing to read.
6. **M-3 / M-4** (app) — the routing chip and the three locks. **Both depend on M-6**, which depends
   on this phase. They ship in **1.0.4**, never as an OTA while 1.0.3 is in review.
7. **v1.1 threshold calibration** — needs weeks of logged `site_type_confidence` + `site_type_source`
   against the seller's final marketplace. This phase starts that clock.

---

## 10. Honest limits of this document

- **I wrote no code.** Both source edits and both test files are given in full and are ready to paste,
  but **the two test files were never created or executed** — this phase's ground rules forbid editing
  `.js` in the repo. What I *did* verify by running: `brandUnknownGuard.test.js` passes (19 tests,
  3.676 s) and needs `--forceExit`; `services/smartExtractionValidator.js` has exactly one import, so
  mocking `../utils/categoryCache.js` fully isolates it; `utils/categoryCache.js` has no import-time
  IO of its own, so mocking `../config/dbConnection.js` is sufficient for the controller suite. The
  suites' **expected counts** (25 and 20) are counted from the code above, **not observed**.
- **The full backend suite was not re-run.** The "2 pre-existing failing suites" baseline is taken
  from the brief, not re-measured by me. The app baseline (0 tsc errors, 92 suites / 825 tests) is
  likewise taken from the brief; no app file is touched by this phase.
- **The S0-1 candidate function was measured, not the edited source.** `infer_ba.mjs` and
  `scale_ba.mjs` compare the real shipped export against a byte-identical *copy* of the §3.1 body.
  Step §3.4 closes that gap by re-running the same scripts after the edit and requiring the two
  columns to converge.
- **The 800-listing replay uses `post_title` as a stand-in for `name` and has no `brand` / `model`
  column.** It therefore **understates** how often the fixed function keeps a true 101it override
  (measured 12 → 8 on the 101it bucket) and cannot exercise the `IT_BRAND_RE` gate the way live data
  will. The lab-bucket number (9.4% → 0.9%, 0 clear false positives) is the trustworthy half.
- **The artifacts do not record the pre-override site type**, so for the six rows in §2.2 that lose an
  override which agreed with the final answer, I cannot prove the outcome is unchanged. §6 is the only
  way to settle it. This is the largest residual risk in the phase — and it is precisely the
  observability gap S0-2 closes.
- **S0-2's runtime behaviour is designed and reviewed against source, not executed.** I did not run a
  modified backend. In particular, "no payload builder needs to change" is a code-read of
  `processProductGroup` → `products[].data` → both payload builders, corroborated by the live
  `rawkeys.mjs` key dump showing `data` passes through whole (23 keys, including `market_metrics`,
  which no client mapper reads).
- **`resolveSiteTypeForGroup`'s `vision` and `hint`-contest branches are not covered by a unit test**,
  because both require a live `callOpenAIJson`. Only the hint-skip branch is asserted. The pure
  `buildRoutingSignal` carries all the contract logic precisely so this gap is not load-bearing, and
  §6.3 pass conditions 3 and 4 cover the uncovered branches end to end on dev.
- **The §6.2 photo URLs are transcribed from disk, not re-fetched.** Prefer `set.json` / `set2.json`
  if present.
- **The four app references in §8 (`MarketplaceCard.tsx:22`, `scanDraftStore.ts:413`,
  `app/scan/processing.tsx:504-508`, `mapSmartDetection.ts:157`) are quoted from the approved plan and
  were not re-opened by me** — they are out of this phase's scope. The app references I *did* verify
  today are `smartDetectionTypes.ts:37` and `:125`, `mapSmartDetection.ts:188` and `:192-228`,
  `app.config.ts:34` (`version: '1.0.3'`), `:90-92` (`runtimeVersion: appVersion`), `:255`
  (`GREENBIDZ_API_URL`), `src/lib/env.ts:9`, and `.env` line 1.
- **Every accuracy figure here is DEV** (`testapi.greenbidz.com`, `greenbidz_test`). Prod runs a
  different vision-provider configuration. **Prod accuracy is not verified by this document.**
- No production write, publish, submit, push, commit, branch switch, stash, reset or migration was
  performed in producing this document. `greenbidz-ai-assistant/` was not touched. No `.ts`, `.tsx` or
  `.js` file was edited anywhere.

---

## 11. Drift register — plan reference vs. what the file says today

`main`, `origin/main`, `dev` and `HEAD` are byte-identical for both files today, and the working tree
is `main + 8` for `controller/wordPressSmart.js` (the uncommitted AI-description fix). The approved
plan was written against the **working tree**, then drifted a further 1–4 lines. Corrected:

| # | Cited in `MULTI_MARKETPLACE_PLAN.md` | Claim | Verdict | Correct reference |
|---|---|---|---|---|
| 1 | §7 S0-1, §1: `smartExtractionValidator.js:234-267` = `inferSiteTypeFromProduct` | **Off by one.** | The function is **235-268**; `:234` is the jsdoc's closing `*/`. `SCAN_FLOW_BACKEND.md`'s `:235-268` was right. | `services/smartExtractionValidator.js:235-268` (all refs) |
| 2 | §1: `:223` = `IT_PRODUCT_RE` contains bare `switch`/`monitor`/`printer`/`server`/`graphics`/`tablet` | ✅ correct | Declaration spans **223-224**; all six bare words present. | `:223-224` |
| 3 | §1: `:259-261` = "IT wins ties" | **Off by one.** | The IT tie-win branch is **258-260** (`if (itScore >= 3 && itScore >= machineScore && itScore >= labScore) { return "101it"; }`). `:261` is the lab branch. | `:258-260` |
| 4 | §7 S0-2: `wordPressSmart.js:1656-1685` = `resolveSiteTypeForGroup` | **Drifted.** | wt **1657-1688**; committed **1649-1680**. | main `:1649-1680` / wt `:1657-1688` |
| 5 | §2.1: the two returns drop the confidence at `:1663` and `:1684` | **Drifted.** The claim itself is correct — both return only `{siteType, suggested_terms}`. | wt `:1664` (hint-skip) and `:1687` (contest). | main `:1656` and `:1679` |
| 6 | §7 S0-2 / §2.3: `:1944-1948` = the regex override | **Drifted.** | wt **1942-1946**; committed **1934-1938**. (wt `:1948` is the `ensureSmartDetectionCategories` call, which plan §3 cites correctly.) | main `:1934-1938` / wt `:1942-1946` |
| 7 | §7 S0-2 / §2.1: `:2010` = `data.site_type = siteType` | ✅ correct in the **working tree**. | main `:2002`. There are **three** such lines (main `:1857`, `:1937`, `:2002`) — anchor on context, not on grep alone. | main `:2002` / wt `:2010` |
| 8 | §7 S0-2 / §2.3: `:3263-3278` = product-event construction + the in-scope confidence | ✅ substantively correct. | wt: hint object `3262-3265`, `product` object `3272-3278`. main: `3254-3257` and `3264-3270`. | main `:3254-3270` |
| 9 | §7 S0-2 / §2.3: `:3358-3372` = the `result` payload / `detection` / `needs_clearer_photo` | ✅ correct in the working tree. | wt: `payload` 3354-3372, `detection` 3357-3361, `needs_clearer_photo` 3367-3369. | main `:3346-3364` (detection 3349-3353, ncp 3359-3361) |
| 10 | §2.3: "`runDetectionPass` stamps `site_type_confidence` per product (`:2137-2160`)" | **Drifted.** Claim correct. | wt **2138-2162** (stamp at wt `:2159`); main **2130-2154** (stamp at `:2151`). | main `:2130-2154` |
| 11 | §2.3 / §5: `smartExtractionValidator.js:298-301` = `< 0.6 → recycle` | ✅ **correct.** | Branch is exactly **298-301**. (`SCAN_FLOW_BACKEND.md`'s `:299-303` is the one that is off.) | `:298-301` |
| 12 | §2.2 / §5: `smartExtractionValidator.js:291-295` = off-list → `recycle` | ✅ correct. | Branch body **291-296** (closing brace 296). | `:291-296` |
| 13 | §2.3: `SITE_HINT_SKIP_VISION_MIN_CONF = 0.92` at `wordPressSmart.js:66` | ✅ correct in the working tree; value 0.92 confirmed. | main `:65`. | main `:65` / wt `:66` |
| 14 | §2.3: the contest substitutes 0.85 at `:1677-1679` | ✅ correct in the working tree. | wt `:1677-1680`; main `:1669-1672`. | main `:1669-1672` |
| 15 | §2.2: `needs_clearer_photo` set at `:818-819` | ✅ correct in the working tree. | Inside `normalizeIdentityAndConfidence` (wt `:810-821` / main `:802-813`). | main `:810-811` |
| 16 | §2.2: `needs_clearer_photo` aggregated at `:3367-3372` | ✅ correct in the working tree. | wt `:3367-3369`. | main `:3359-3361` |
| 17 | §7 S0-2 — the file list is **incomplete** | **Gap, not drift.** | It names only the **v2** emit path. `runSmartDetection` (v1) builds its own `detectionHint` (main `:2318-2321`) and its own payload (main `:2368-2382`), and `POST /wp/analyze-smart-detection` is still mounted (`routes/wpProductRoutes.js:165-169`). §4.9 fixes v1 too. | add main `:2318-2321` |
| 18 | §7 S0-2 — `mergeTwoDetectionGroups` is **not mentioned** | **Gap.** | It copies `site_type` + `site_type_confidence` between merged detection groups (main `:956-957`) and runs *after* the per-product stamp (`mergeLikelyDuplicateGroups`, wt `:2192` / `:2194`). Without §4.8(i) a merged group loses the new label. | add main `:946-963` |
| 19 | §8.3 gate 2: false-101it "drops from 9% to ~0" | **Measured too optimistic.** | 9.4% → **0.9%** (75 → 7 of 800). All 7 residuals are genuinely IT hardware mis-filed into lab, so clear false positives = 0. Restate the gate as **≤ 1% with every residual explainable**. | §2.3 |
| 20 | §12 / §8.3: `MARKETPLACE_LOCKED` at `MarketplaceCard.tsx:22` | **Not re-verified by me.** | Out of this phase's scope (M-4); flagged so nobody assumes I checked it. | — |

| 21 | §7 S0-2 — the emit path is described as one v2 site | **Gap, found in review.** | There are **four** `processProductGroup` call sites, not two: main `:2315` (v1), `:2358` (v1 empty-products fallback), `:3251` (v2), `:3319` (v2 empty-products fallback). The two fallbacks pass `{ site_type: detection.siteType }` — no confidence, no low-confidence flag — so an unsure `recycle` would ship as a confident `hint`. §4.8(iv) + §4.9(iii) fix it. | add main `:2358-2362`, `:3319-3325`, `:2195-2210` |
| 22 | — (harness, not the plan) | **Stale on disk.** | `mm/infer_ba.mjs` and `mm/scale_ba.mjs` implement an **earlier** candidate than §3.1 (no strong/weak split, no `IT_BRAND_RE` gate, `labHit` unconditional). Running them prints true-101it `8 -> 8` and omits the `I5` rows. Overwrite both from §2.2 / §2.3. | — |
| 23 | — (harness, not the plan) | **Wrong photo set.** | `run2.mjs` hard-codes `set2.json` (its line 5) and the on-disk `set2.json` holds only N1/N2/N3, so §6.3 as first written could not evaluate pass conditions 2, 5, 6. §6.2 now makes rewriting `set2.json` to the 15-row array a required step. | — |

Two things the plan got exactly right, and this phase is built on both:
`SCAN_FLOW_BACKEND.md` §1.3's statement that **N1 and M6 are deterministic backend bugs provable
without the model** (reproduced in §2.2), and `MULTI_MARKETPLACE_PLAN.md` §2.3's warning that emitting
the **pre-override** confidence would ship a mismatched value (implemented as `buildRoutingSignal`,
§4.3, and pinned by the third test in §4.11).

---

## 12. Reviewer pass — CTO review, 2026-08-18

Independent re-verification of this document, read-only, on the same working tree. **No `.js`, `.ts`
or `.tsx` file was edited; no commit, push, branch switch, stash, deploy, migration or production
write was performed.** Only this markdown file changed.

### 12.1 Re-verified as cited (opened against `git show main:` and the working tree)

`services/smartExtractionValidator.js` — `IT_PRODUCT_RE` **223-224** with all six bare words;
`LAB_PRODUCT_RE` **226-227**; `MACHINE_PRODUCT_RE` **229-230**; `inferSiteTypeFromProduct` **235-268**
(`:234` is the jsdoc close); the IT tie-win at **258-260**; the `+1` brand bonus at **249-254**;
`normalizeSiteType` **41-50** (returns `""` on an unmapped value, so §4.2's
`detectedSiteType: siteType || null` is `null` and cannot hand S0-3b a bogus marketplace);
`normalizeDetectedSiteType` **282-304**, off-list **291-296**, `< 0.6` **298-301**; exactly **one**
`import`. The file is byte-identical on `origin/main`, `main`, `dev`, `HEAD` and in the working tree.

`controller/wordPressSmart.js` — all four committed refs identical (blob `efe1675`); working tree is
**main + 8** with the four uncommitted hunks at `@@ -33,0 +34 @@`, `@@ -233,0 +235,6 @@`,
`@@ -548,0 +556 @@`, `@@ -560 +568 @@`, all below line 600 as claimed. Confirmed at main line numbers:
`SITE_HINT_SKIP_VISION_MIN_CONF = 0.92` **65**; `__TEST__` **217**; `normalizeIdentityAndConfidence`
**802** with `needs_clearer_photo` at **810-811**; `mergeTwoDetectionGroups` **946-963** (copy
**956-957**); `mergeLikelyDuplicateGroups` **965**; `applyMergePairIndexes` **998-1030** spreading
`...p` at **1001-1004** and **1026-1029**; `detectSiteTypeForGroup` **1596-1632**;
`resolveSiteTypeFromHintOnly` **1634-1647** (return **1642-1646**); `resolveSiteTypeForGroup`
**1649-1680** with the two confidence-dropping returns at **1656** and **1679** and the 0.85
substitute at **1669-1672**; `processProductGroup` **1914**, destructure **1922-1926**, override
**1934-1938**, stamp **2002** with exactly the two neighbouring lines this document names; the three
`data.site_type = siteType;` lines at **1857 / 1937 / 2002**; `runDetectionPass` **2016**, zero-product
fallback **2120-2127**, per-product map **2130-2154** (stamp **2151**), return **2195-2210**;
`runSmartDetection` **2290**, its `detectionHint` **2318-2321**, `data: result.data` **2341-2346**,
payload **2368-2382**; v2 `detectionHint` **3254-3257**, `product` event **3264-3270**,
`merged_single` **3305-3328**, payload **3346-3364** with `needs_clearer_photo` **3359-3361** and
top-level `suggested_terms` **3356**.

Also confirmed: `routes/wpProductRoutes.js:165-169` still mounts v1; `config/dbConnection.js:38-43` is
a top-level `await sequelize.authenticate()` inside a `try/catch` that **logs and continues** (so a
wrong cwd degrades to noise, not a crash); `jest.config.js:1-7`; the controller imports exactly
`ALLOWED_SITE_TYPES`, `buildCompressedCategoryTree`, `ensureSmartDetectionCategories` from
`categoryCache` and the validator exactly `ALLOWED_SITE_TYPES`, `getCategoriesForPlatform`,
`getSqlCategoriesForSiteType` — so **both** §3.3 and §4.11 mock factories are complete supersets and
neither will fail with a missing-export link error; `__tests__/wordPressSmart.controller.test.js`
imports the real controller with no mocks at all, which is the precedent that makes §4.11's mocked
import safe. `processProductGroup` has exactly **one** `return` (main `:2013`), so the `routingSignal`
in §4.7 can never be `null` at the stamp. No repo file outside `node_modules` and the dead
`.old.js` references `site_type_source` today.

App side: `.env` line 1 is the production URL and is byte-identical to
`scratchpad/app.env.PRODBACKUP`; `smartDetectionTypes.ts:37` / `:125`; `mapSmartDetection.ts:188` and
the explicit return literal `:192-228` (no spread — additive keys are safe for 1.0.3);
`app.config.ts:34` `version: '1.0.3'`, `:90-92` `runtimeVersion: appVersion`, `:255`
`GREENBIDZ_API_URL` → `src/lib/env.ts:9`; app HEAD `11ef609` with only `Docs/multi-marketplace/`
untracked.

### 12.2 Re-measured, not just re-read

- **The unreachability argument in §3.1 is sound.** `itScore ∈ {0,3,4}`, so reaching main `:263`
  requires `IT_PRODUCT_RE.test(text)` false, which makes `:263` false; `:264` and `:265` are
  pre-empted by `:262` and `:261`. Deleting all three changes nothing.
- **The strong/weak split is a complete partition of the old regex.** 18 strong + 9 weak = the same
  27 alternatives that were in `IT_PRODUCT_RE`; nothing added, nothing dropped.
- **All 18 assertions in §3.3's suite hold** against the §3.1 candidate (run as a standalone script);
  at least ten of them return a different value under the shipped function, so the suite does fail if
  the fix is reverted — it is not asserting a constant.
- **§2.2's table reproduces exactly.** Replaying the §3.1 candidate against the real exported function
  over `runB/runC/nA1-3.json` gave `n = 57`, BEFORE
  `{"LabGreenbidz":16,"null":23,"machines":6,"101it":12}`, AFTER
  `{"LabGreenbidz":16,"null":31,"machines":4,"101it":6}`, false-101it `M6, M6, N1, N1 → (none)`,
  true-101it `8 → 6`, and the identical 10-row diff including both `I5` rows.
- **§2.3's table reproduces exactly** against `greenbidz_test` (read-only `SELECT`s):
  `LabGreenbidz n=800 before=75 (9.4%) after=7 (0.9%)`, residuals `MacBook Pro`,
  `GIGABYTE Graphics Card`, `ASUS Vivobook Laptop`, `HP Colour Laser Jet Flow MFP M880 Series Printer`
  ×4; `machines 0 → 0`; `101it 12 → 8`; `recycle 0 → 0`. The headline numbers in this document are
  honest.

### 12.3 What the review changed in this document

1. **§2.2 — the run command hard-failed.** `infer_ba.mjs` read its JSON with plain relative paths while
   §2.2 mandates cwd = the backend directory; the printed command died with
   `ENOENT ...\101recycle-greenbidz-backend\runB.json` (reproduced). The reads are now
   `new URL(f, import.meta.url)`.
2. **§1.2 / §2.2 — stale harness.** The `infer_ba.mjs` and `scale_ba.mjs` already on disk implement an
   earlier candidate and print `8 → 8` with no `I5` rows. Both sections now say to overwrite them.
3. **§4.8(iv) + §4.9(iii) — two missed call sites.** The empty-products fallbacks (main `:2358`,
   `:3319`) were unpatched, which would emit an unsure `recycle` as `source: 'hint'`,
   `confidence: 0.85`. Added, together with the `siteLowConfidence` key that has to leave
   `runDetectionPass` for them to read.
4. **§6.2 / §6.3 — the measurement could not reach its own pass conditions.** `run2.mjs` hard-codes
   `set2.json`, which holds only N1/N2/N3, so conditions 2, 5 and 6 (I1, I5, M6) were unmeasurable.
   Rewriting `set2.json` to the 15-row array is now a required step with a length check.
5. **§3.3 / §4.11 — expected test counts.** 25 → **21** and 20 → **19** (counting each `test.each` row).
6. **§4.7(iii)** claimed the middle `data.site_type = siteType;` disappears after edit (ii); it does
   not — the replacement block ends with that same line. Corrected.
7. **§4.11** claimed the pre-edit suite fails "at import"; destructuring a missing `__TEST__` key yields
   `undefined`, so it fails at first call. Corrected.
8. **§1.2 "not modified"** implied `runSmartDetection` is untouched; it is edited twice. Scoped to the
   payload-building statements.
9. **§7.1** gained a content check for the five edit sites, because **neither new suite would fail if
   §4.7(iii) were skipped** — both test the pure helper, not `processProductGroup`.

### 12.4 Still open after the review — accept these knowingly

- **Nothing unit-tests the actual emission.** `buildRoutingSignal` is exhaustively pinned; the stamp
  onto `data` is proven only by §6.3's live `rawkeys.mjs` run. A green test run does **not** mean the
  fields are on the wire. §7.1's greps are a weak substitute, not a test.
- **The six rows that lose an agreeing override (M7, I5 ×2, L2, L4, M1) remain unresolvable offline** —
  the artifacts do not record the pre-override site type. §6.3 conditions 5 and 6 are the only
  settlement, and I5's outcome is a product decision, not a bug to hide.
- **`site_type_confidence` on the `vision` path is the model's raw number** even when
  `normalizeDetectedSiteType` already rewrote `siteType` to `recycle`. That is safe only because the
  raw number is `< 0.6` in that case and the `low_confidence_fallback` cap then applies; it is not
  safe by construction. If a future change lets a `recycle` fallback carry a high raw confidence
  without setting `lowConfidence`, contract rule 2 breaks silently.
- **The `101it` bucket's `12 → 8` is a title-only proxy** and understates live retention, as §10 says.
- The two new test files still have **never been created or executed**, and the full backend suite was
  **not** re-run in this review either.

> **⏱ STALE as of 2026-08-19.** Both suites now exist, have been executed many times, and the full
> backend suite has been re-run repeatedly. §§1–12 of this document were all written *before any code
> existed*; **§13 below is the record of the landed code** and overrides §§1–12 wherever they disagree.

---

## 13. Post-implementation closeout — recorded 2026-08-19

Written after Phase 1 landed, by the engineer who closed out the independent reviewer's findings.
Tree: `101recycle-greenbidz-backend` on `fix/seller-gate-existing-sellers` at **`aa0635b`** plus
**`742d359`** (this section's own commit), with the 27 pre-existing dirty entries of §0.2 untouched.

Measured backend baseline at `aa0635b`, reproduced before any edit:
**61 suites / 2 failed / 59 passed; 784 tests / 3 failed / 1 skipped / 780 passed; ~9.5 s; exits
without `--forceExit`.** The 3 failures are pre-existing and unrelated —
`__tests__/uploadValidationService.test.js` (2 assertions on `cfb_legacy_or_encrypted` reason text)
and `__tests__/zohoListingSyncPublished.test.js` (the suite fails to *run*: its stale mock factory
omits `createZohoOffer`, which `lib/zohoSync.js` imports; the real export is at
`utlis/zohoUtils.js:1164`). Do not chase them and do not count them as anyone's regression.

### 13.1 The empty-products fallback confidence — already fixed at `aa0635b`; nothing more to do

The reviewer's finding was that both empty-products fallbacks passed `detection.confidence` — the
HOW-MANY-PRODUCTS number, per §2.1 / §4.9 — into the `detectionHint`, from where it reached the wire
as `site_type_confidence` and violated contract rule 1. **That was true of `8383b62` and is no longer
true of `aa0635b`.** The S0-2 hardening commit already fixed it. Verified by reading the code, not by
trusting the commit message:

| Where | Current code | Verdict |
|---|---|---|
| `controller/wordPressSmart.js:2054-2060` | `buildBatchDetectionHint(detection)` returns `site_type_confidence: detection?.siteConfidence` | correct |
| `:2396` | `runDetectionPass` returns `siteConfidence: batchSite.confidence` | correct |
| `:2286` | `const batchSite = normalizeDetectedSiteType(parsed)` | the same call that produces `siteType` |
| `services/smartExtractionValidator.js:319-322` | `normalizeDetectedSiteType`'s `confidence` is `parsed.site_type_confidence` clamped to 0..1 (default 0.75) — **not** `parsed.confidence` | so `batchSite.confidence` genuinely is the SITE-TYPE confidence |
| `:2557-2562`, `:3532-3538` | `detection.confidence` still appears, but only in the payload's own `detection.confidence` field | correct — the grouping number keeps its own meaning in its own field |

It is also already pinned, at two levels, and both pins bite. Revert experiment run 2026-08-19
(`buildBatchDetectionHint`'s `detection?.siteConfidence` changed to `detection?.confidence`), after
which `controller/wordPressSmart.js` was restored byte-exact (md5
`20f378b450369e2a2757a41f6570de93`, `git diff` unchanged):

| Suite / test | Result under the revert |
|---|---|
| `siteTypeRoutingWire.test.js` — *empty-products fallback uses the SITE-TYPE confidence, not the how-many-products one* | **RED** (endpoint level: `merged_single.site_type_confidence` 0.95 to 0.3) |
| `siteTypeRoutingWire.test.js` — *buildBatchDetectionHint reads the SITE-TYPE confidence, not the grouping one* | **RED** (unit level) |
| whole suite | 2 failed / 18 passed / 20 total (green baseline: 20/20) |

**No code change was required for this finding.** Anyone re-reading the reviewer's note should read it
as describing `8383b62`, not the current tree.

### 13.2 S0-1's identity-only narrowing is now pinned by its own fixture — commit `742d359`

The reviewer was right that the narrowing was the thinnest-pinned behaviour in the phase. Reproduced
2026-08-19: putting `data?.equipment_description` back into `inferSiteTypeFromProduct`'s joined
identity text — the exact revert of S0-1 — turned **exactly one** test red (*"empty identity returns
null even when the description is full of keywords"*), and it only bit because that case feeds an
EMPTY identity. **Both fixtures named after the live DEV bug stayed GREEN** through the revert:

- **N1** Sigma 3K1S centrifuge / *"The power switch is located on the back of the unit."*
- **M6** TRI AOI machine / *"... a monitor attached to the left side ..."*

because `switch` and `monitor` are **WEAK** tokens and the independent `IT_BRAND_RE` gate neutralises
them wherever they are read from. So §3.3's regression fixtures pinned the weak/strong split, not the
identity-only rule.

`742d359` adds five cases to `__tests__/inferSiteTypeNarrowing.test.js` (21 to 26 tests, no source
change) whose identity carries **no** lab / machine / IT token at all and whose only IT evidence is a
**STRONG** token — one allowed to override with no brand beside it — sitting in the AI-written prose:

| Fixture | identity (name / brand / model) | `equipment_description` | expected |
|---|---|---|---|
| 1 | `Control Cabinet` / `Alliance` / `""` | *"A laptop sits on the shelf beside it for programming."* | `null` |
| 2 | `Vibration Table` / `Fritsch` / `VT-200` | *"Photographed next to a MacBook that was used for data logging."* | `null` |
| 3 | `Sorting Conveyor` / `Interroll` / `""` | *"An SSD is fitted inside the controller housing."* | `null` |
| 4 | `Control Cabinet` / `Alliance` / `""` | *"A **Dell monitor** on the desk displays the process readout."* — a weak word **and** its IT brand, both in the prose, so `IT_BRAND_RE` cannot save it | `null` |
| 5 (companion) | `Laptop Docking Station` / `Alliance` / `""` | — | `'101it'` — proves cases 1-4 pass because of *where* the token is, not because `laptop` is unknown |

Proof they bite: re-adding `data?.equipment_description` takes the suite from **26 green to 5 red**
(the four negative cases plus the pre-existing empty-identity one).
`services/smartExtractionValidator.js` restored byte-exact afterwards (md5
`e0a9ca92bac174f5754bc45ed3e40ee4`, `git diff` empty).

### 13.3 §7.1 step 5's grep counts — corrected

The three counts printed in §7.1 step 5 were wrong. Two of them were **never** right, not even
against `8383b62`, and the authorised builder refactor then moved all three again. Measured (raw
`grep -c` / code-only, comment lines excluded):

| Symbol | §7.1 said | `8383b62` raw | `aa0635b` raw | `aa0635b` **code-only** | Why it moved |
|---|---|---|---|---|---|
| `site_type_low_confidence` | 8 | 9 | **7** | **6** | four inline `detectionHint` literals collapsed into two builders (−2); one prose mention in the `buildGroupDetectionHint` doc-comment inflates the raw count (+1) |
| `siteLowConfidence` | 3 | 3 | **2** | **2** | the two fallback literals collapsed into one builder body, so 2 reads + 1 write became 1 read + 1 write |
| `buildRoutingSignal` | 3 | 5 | **5** | **3** | the *code* count is unchanged at 3 (`__TEST__` export, definition, call). The raw count is +2 purely from the two new doc-comments at `:70` and `:240` — the number the plan wanted was always the code-only one |

Two symbols the refactor added, which §7.1 should also check: `buildGroupDetectionHint` = **4** (all
code), `buildBatchDetectionHint` = raw **6** / code **4**.

The refactor is authorised (`aa0635b`) and the counts reconcile exactly to it. §7.1 has been edited in
place to print code-only counts, and now says what it is really for: the greps are a smoke check,
because `__tests__/siteTypeRoutingWire.test.js` asserts the stamp **at the endpoint** — a missing
stamp is a red test, not a grep miss.

### 13.4 ⚠ OPEN ITEM — §6.3's live before/after gate was never run. Close it before anyone discusses deploying.

**Phase 1's report claimed a "§6.3 live DEV emission proof". That claim overstates what happened, and
this is the correction.** What actually exists on disk in `…/scratchpad/mm/`:

| Artifact | Present? |
|---|---|
| `p1_before_1.json`, `p1_before_2.json`, `p1_before_3.json` (+ `.log`) | **yes** — the three BEFORE runs |
| `p1_after_1.json`, `p1_after_2.json`, `p1_after_3.json` | **NO** |
| `score.mjs` output | **NO** — the script exists; it has never been run against a full before/after pair |
| `emit_proof.mjs`, `p1_emit_N1.txt` | yes — **but this is not §6.3** |

`emit_proof.mjs` is an **in-process** harness: it imports the controller into a local Node process and
calls it against the dev DB. It proves the two fields exist on the object the controller returns, for
one product (Sigma 3K1S to `LabGreenbidz` / *Lab Infrastructure & Essentials / Centrifugation*). It
does **not** exercise a deployed dev backend, an HTTP request, the SSE transport, or the real
`.env` / vision-provider configuration of `testapi.greenbidz.com` — all of which §6.3 was written to
cover. There was no dev deploy, correctly: this work was not authorised to perform one.

Consequently **§6.3 pass conditions 1, 2, 5 and 6 were never measured**:

| # | Condition | Status |
|---|---|---|
| 1 | N1 routes to `LabGreenbidz` in 3/3 AFTER runs and stops being *Components / GPU Accelerators* | **NOT MEASURED** — no AFTER runs exist. The offline replay and the in-process run are indicative only |
| 2 | overall routing ≥ the measured BEFORE number, no new misroute class | **NOT MEASURED** — needs both halves plus `score.mjs` |
| 3 | every product carries both fields, correct types | Partly: proven by `siteTypeRoutingWire.test.js` at endpoint level, and once in-process for one product; **not** proven over HTTP against a deployed dev backend |
| 4 | `regex_override` / `low_confidence_fallback` implies `site_type_confidence <= 0.5` | Proven **in tests** (`buildRoutingSignal`'s cap, asserted on the wire objects); not proven live |
| 5 | I5 (dual monitors) and I1 (H100 GPU) still route to `101it` | **NOT MEASURED** |
| 6 | M6 lands on `machines`, or is at least now labelled `vision` rather than `regex_override` | **NOT MEASURED** |

**Required before deployment is even discussed** (in this order, each an owner-approved action):

1. Deploy this branch's S0-1 / S0-2 to **dev** only (`testapi.greenbidz.com`, port 6000, DB
   `greenbidz_test`) per §7.3. Confirm with the owner *at the moment* of the restart; earlier approval
   does not carry to the next action.
2. Run the three AFTER runs and `score.mjs`; record conditions 1, 2, 5 and 6.
3. Run `rawkeys.mjs` over HTTP against dev for conditions 3 and 4.
4. §6.5's web smart-upload regression check.

Until step 2's output is on disk, the honest statement of this phase's status is: *"the contract is
pinned by tests at the endpoint level and was observed once in-process against the dev DB; the live
before/after accuracy gate is outstanding."* Prod is a separate, owner-approved step and remains out
of scope.

### 13.5 DECISION — the vision-skip on the empty-products fallback path

Recorded because it is a real behaviour change on an error-recovery path and was previously
undocumented. **Phase 2 rewrites this exact contest (its §5.2b-3), so it must inherit the decision
rather than rediscover it.**

**What changed.** Before S0-2, the two empty-products fallbacks built a one-key hint
(`{ site_type: detection.siteType }`) with **no** confidence. `resolveSiteTypeFromHintOnly` scores a
missing confidence as **0**, and `0 >= SITE_HINT_SKIP_VISION_MIN_CONF (0.92)` is false, so the
per-group vision site-type call **always** ran on this path. The hint now carries a real number, so
the skip gate *can* fire.

**Decision: pass `detection.siteConfidence` — the genuine site-type confidence — and accept that the
gate can fire.** Not `detection.confidence`, and not an artificial cap below 0.92.

**Why:**

1. `detection.confidence` is the how-many-products number. Using it would make a *model call* depend
   on a number describing a *different decision*, and live batch confidences reach 1.0, so the gate
   would fire routinely for an unrelated reason. That is exactly the mislabel `site_type_confidence`
   exists to prevent, arriving through the back door.
2. `detection.siteConfidence` comes out of the same `normalizeDetectedSiteType(parsed)` call as
   `detection.siteType` (`:2286` to `:2396`), so when the gate fires it is because *the model's own
   site-type confidence is ≥ 0.92* — precisely the condition the gate was written for. Skipping is
   then correct **by design**, not by accident.
3. Capping the reported confidence below 0.92 to preserve the old behaviour was considered and
   **rejected**: it would put a knowingly false number on the wire in the one field created to stop
   knowingly false numbers, in order to protect a model call that was only ever made because of a
   missing key.
4. The path affected is the fallback for *"the model returned no products at all"*. Its input is
   `materializedAll` — every image of a batch the model could not group — which is the **worst**
   possible input for a prompt that says *"Classify marketplace site_type for this product only."*
   Preferring a ≥ 0.92 batch-level site-type answer over that call is a better trade, not merely a
   cheaper one.

**Cost, stated plainly:** on this path the server can now make one FEWER vision call than the pre-S0-2
code did, and the marketplace chosen can differ. Both are intended.

**Pinned by:** `siteTypeRoutingWire.test.js` — *empty-products fallback uses the SITE-TYPE confidence,
not the how-many-products one* — which asserts `callsTo("siteType") === 0` alongside
`merged_single.site_type_confidence === 0.95`, so a silent return to always-calling-vision goes red.

**Interaction with Phase 2 (S0-3b) — do not let this drift.** S0-3b makes the *off-list* branch of
`normalizeDetectedSiteType` return `confidence: 0`. On that branch the hint therefore scores 0 and
**vision starts being called again** — verified by simulation; see Phase 2's §5.2b-5b, which lists the
two tests that record it. That is a consequence of S0-3b's own contract and is acceptable. What is
**not** acceptable is Phase 2 reverting rule 1 above and re-pointing the builder at
`detection.confidence`. The ALLOWED-type ≥ 0.92 case (e.g. `machines` @ 0.95) must keep skipping
vision after Phase 2 lands.

### 13.6 What a Phase 2 implementer must know about this tree

- **`controller/wordPressSmart.js` is DIRTY, and the dirty diff is not Phase 1's.** The working tree
  is `HEAD + 8 lines` — four hunks: `@@ -33,0 +34 @@`, `@@ -250,0 +252,6 @@`, `@@ -565,0 +573 @@`,
  `@@ -577 +585 @@` — from an unrelated in-progress AI-description change
  (`services/descriptionStyleRule.js`). Everything below line 585 is offset by **+8** from `HEAD`.
- **That dirty hunk sits inside `export const __TEST__`** (`:252-257` adds `buildDescriptionRule`,
  `buildExtractionSystemPrompt`, `buildLanguageBlocks`), and Phase 2 also edits `__TEST__`. **Stage by
  explicit path and read `git diff --cached` before committing** — it is the one place in this file
  where another engineer's uncommitted work is interleaved with yours.
- Phase 1's own additions to `__TEST__` are the **7** symbols at `:240-251`: `buildRoutingSignal`,
  `resolveSiteTypeForGroup`, `resolveSiteTypeFromHintOnly`, `buildGroupDetectionHint`,
  `buildBatchDetectionHint`, `mergeTwoDetectionGroups`, `runDetectionPass`.
- `__tests__/siteTypeRoutingWire.test.js` (20 tests) asserts the contract **at the endpoint**. **Nine**
  of its tests change meaning under S0-3b. They are enumerated, with replacement assertions, in
  `PHASE_INTEGRATION.md` §2 C5 and in Phase 2's §5.2b-5b. **Read that list before editing any of
  them.**
