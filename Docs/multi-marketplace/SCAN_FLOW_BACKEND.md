# Scan flow — backend accuracy audit for the multi-marketplace unlock

**Date:** 2026-08-18
**Question:** can the smart-detect backend pick the right marketplace, the right category, and
credible money numbers well enough to unlock 101lab / 101machine / 101it / 101recycle in the
mobile scan flow?
**Method:** measured, not reasoned. 27 real marketplace photos, 81 live calls against the DEV
smart-detect v2 SSE endpoint. Read-only — no listing, draft, or DB row was created.
**Status:** analysis only. No `.ts` / `.tsx` / `.js` file was modified.

---

## Verdict

**Marketplace detection is good enough to unlock 101lab, 101machine and 101it behind a
confirmation step. It is not good enough to auto-apply silently, and 101recycle cannot be
unlocked at all until it is given a category tree in the app.**

Four findings drive that:

1. **Marketplace routing: 64/72 correct (89%).** Per-item routing inside a mixed upload works — a
   4-photo upload spanning all four marketplaces split into 4 products with 4 correct
   marketplaces, twice in a row. This part of the system genuinely works.
2. **But the wire carries no confidence.** `site_type_confidence` exists inside the backend and is
   never emitted to the client (`wordPressSmart.js:3222-3228`, `:3358-3376`). There is no number
   the app could threshold on today, so "auto-apply when sure, ask when unsure" is **not
   implementable without a backend change**. The one low-confidence channel that does exist
   (`suggested_terms.site_type`) fired **zero** times in 81 calls.
3. **Category accuracy is the real problem: 11/24 photos got a fully correct category (46%).** The
   dominant cause is not the model — it is **taxonomy coverage**. /machines has 13 flat parents and
   zero subcategories; /101it has no "ASUS" and no "Monitors"; /recycle has no furniture bucket.
   When nothing fits, the model returns the first plausible row and the seller sees a confidently
   wrong category with no signal that it was a shrug.
4. **The scrap value and the profit percentage are invented by the language model, and the
   percentage hits its display cap 63% of the time.** In 45 of 72 runs the card would tell the
   seller "**could earn you 999% more than scrap value alone**". When the AI returns no tiers, the
   card shows hardcoded numbers — $12,500 scrap, $4,200 profit, 33% — with the "AI" badge hidden
   (`ProfitIntelligenceCard.tsx:18-20`, `:104-115`). This is the most serious finding in the
   document and it is independent of the unlock.

The unlock itself is cheap. Making the money numbers honest is not, and should not ship in the same
breath.

---

## 1. How marketplace detection actually works

### 1.1 The confidence contest, precisely

`processProductGroup` (`controller/wordPressSmart.js:1922`) resolves the marketplace in **three
layers**, and each can overrule the one before it.

**Layer 1 — the batch detection pass.** `runDetectionPass` sends all photos to vision once and asks
for `products[]`, each carrying its own `site_type` + `site_type_confidence` (prompt at
`wordPressSmart.js:305-312`, which explicitly notes "mixed uploads are common"). Every per-product
answer is normalised by `normalizeDetectedSiteType`
(`services/smartExtractionValidator.js:282-306`):

- unknown / unmappable type → **forced to `recycle`**, the raw value stashed in `suggested_terms.site_type`;
- `site_type_confidence < 0.6` → **forced to `recycle`**, real value stashed in `suggested_terms.site_type`;
- confidence missing → **defaults to 0.75**, i.e. treated as confident.

**Layer 2 — `resolveSiteTypeForGroup`** (`wordPressSmart.js:1657-1687`). It takes the layer-1 answer
as `detectionHint` and runs the contest:

```
hint.confidence >= SITE_HINT_SKIP_VISION_MIN_CONF (0.92)  → take the hint, skip vision entirely
otherwise                                                → second, per-group vision call
    then if hint.confidence >= vision.confidence          → the hint wins anyway
```

Two details matter. `SITE_HINT_SKIP_VISION_MIN_CONF = 0.92` (`wordPressSmart.js:66`) is high, so a
merely-confident hint still pays for a **second** vision call (`detectSiteTypeForGroup`,
`:1604-1639`). And when the hint has no numeric confidence, `resolveSiteTypeForGroup` substitutes
**0.85** (`:1679`) — which beats most vision confidences, so a hint with no confidence usually wins.

**Layer 3 — `inferSiteTypeFromProduct`** (`smartExtractionValidator.js:235-268`). After field
extraction, a regex pass over `name + brand + model + equipment_description` **silently overrides**
whatever the two vision calls agreed on. No confidence, no logging, no way for the client to know it
fired. This is where the routing failures come from (§1.3).

### 1.2 Measured routing accuracy

24 photos sourced from real published listings (DEV DB `greenbidz_test`, `site_type` meta, then my
own visual check of every photo on a contact sheet), each run **3×** through
`POST https://testapi.greenbidz.com/api/v1/wp/analyze-smart-detection-v2`.
Ground truth = what the photo shows, judged from the image, not the seller's tag.

| # | Photo | Truth | run 1 | run 2 | run 3 | Hits |
|---|---|---|---|---|---|---|
| L1 | Zeiss Axiovert 10 inverted microscope | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L2 | Nikon SMZ800 stereo microscope | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L3 | Binder BD 53 lab incubator | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L4 | Philips PU 8620 UV/VIS spectrophotometer | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L5 | BD FACSVerse flow cytometer | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L6 | Keysight EDUX1002G oscilloscope | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | 3/3 |
| L7 | Waters Alliance e2695 — **close-up of the control panel only** | LabGreenbidz | machines | machines | machines | **0/3** |
| M1 | Surface grinder 500×1000 | machines | machines | machines | machines | 3/3 |
| M2 | Engine lathe | machines | machines | machines | machines | 3/3 |
| M3 | Vertical milling machine | machines | machines | machines | machines | 3/3 |
| M4 | Glass tempering / plating line | machines | machines | machines | machines | 3/3 |
| M5 | Straight-line glass cutting table | machines | machines | machines | machines | 3/3 |
| M6 | TRI TR7700 SIII 3D AOI inspection machine | machines | **101it** | **101it** | **101it** | **0/3** |
| M7 | Waldrich Coburg rail planing machine | machines | machines | machines | machines | 3/3 |
| I1 | NVIDIA H100 NVL PCIe GPU (boxed) | 101it | 101it | 101it | 101it | 3/3 |
| I2 | TP-Link Omada EAP610 ceiling AP | 101it | 101it | 101it | 101it | 3/3 |
| I3 | ASUS Vivobook laptop | 101it | 101it | 101it | 101it | 3/3 |
| I4 | Lenovo IdeaPad Gaming laptop | 101it | 101it | 101it | 101it | 3/3 |
| I5 | Dual monitors + keyboard on a desk | 101it | 101it | 101it | 101it | 3/3 |
| I6 | Smartphone in hand | 101it | 101it | 101it | 101it | 3/3 |
| R1 | Blue plastic water bottle | recycle | recycle | recycle | recycle | 3/3 |
| R2 | Two upholstered office chairs | recycle | recycle | recycle | recycle | 3/3 |
| R3 | Sports water bottle | recycle | recycle | recycle | recycle | 3/3 |
| R4 | Conference table + 10 chairs + wall TV | recycle | recycle | **101it** | **101it** | **1/3** |

**Marketplace accuracy: 64/72 = 89%.**
**Stable across 3 runs: 23/24 photos** (only R4 flipped).
Per marketplace: lab 18/21 (86%), machines 18/21 (86%), 101it 18/18 (100%), recycle 10/12 (83%).

A second, nameplate-focused set (3 lab centrifuges, 3 runs each) produced the worst case in the
whole audit:

| # | Photo | Truth | run 1 | run 2 | run 3 | model read |
|---|---|---|---|---|---|---|
| N1 | Sigma **3K15** benchtop centrifuge | LabGreenbidz | LabGreenbidz | **101it** | **101it** | "3K1S", "3K1S", "3K1S" |
| N2 | Sigma 4K10 refrigerated centrifuge | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | "4K10" ×3 |
| N3 | Beckman Coulter Avanti JXN-26 | LabGreenbidz | LabGreenbidz | LabGreenbidz | LabGreenbidz | "Avanti JXN-26" ×3 |

**A benchtop laboratory centrifuge was routed to the IT marketplace — and categorised as a "GPU
Accelerator" — in 2 of 3 runs.** Combined across both sets: **73/81 = 90%**.

### 1.3 Root cause of every routing failure (reproducible offline)

The failures are not vision failures. They are `inferSiteTypeFromProduct` firing on incidental words
in the AI's **own generated description**. `IT_PRODUCT_RE`
(`smartExtractionValidator.js:223`) contains the plain English words `switch`, `monitor`, `printer`,
`server`, `graphics`, `tablet` — and IT wins ties against lab and machines because its branch is
tested first (`:259`).

I replayed the exact returned text through a byte-for-byte copy of the function
(`scratchpad/mm/infer.mjs`):

| # | AI description contains | IT regex hit | Lab / machine hit | `infer()` returns | Final |
|---|---|---|---|---|---|
| N1 (runs 2, 3) | "The power **switch** is located on the back of the unit." | `switch` | `laboratory` | **101it** (it 3 ≥ lab 3, IT wins the tie) | 101it ✗ |
| N1 (run 1) | *(that sentence absent)* | — | `laboratory` | LabGreenbidz | LabGreenbidz ✓ |
| M6 | "...with a **monitor** attached to the left side." | `monitor` | none | **101it** | 101it ✗ |
| I5 | "two black flat-screen **monitors**" | `monitor` | none | 101it | 101it ✓ |
| L7 | "control panel for an Alliance machine" | none | none | `null` (no override) | machines ✗ — vision's own error |
| R4 | conference furniture + wall TV | none | none | `null` (no override) | 101it ✗ — vision's own error |

So **N1 and M6 are deterministic backend bugs**, provable without the model. L7 and R4 are genuine
vision ambiguity (a bare control panel; a room of furniture with a TV on the wall). `infer()`
returned `null` on 11-12 of 24 items (runB 12, runC 11; re-measured by importing the real
`inferSiteTypeFromProduct`, not the replica) — the override is silent most of the time and only bites when a
keyword happens to appear.

**Scale estimate.** The same function over the title + description of **800 real published lab
listings** (DEV DB, `site_type = LabGreenbidz`): **75 (9%) are overridden to `101it`**. A few of
those are genuinely mis-tagged listings (there is a real "MacBook Pro" in the lab bucket), but clear
false positives dominate — e.g. *"SOTAX AT Xtend + SAM — Automated Dissolution Testing System"* →
101it. On machines (n=65) and recycle (n=5) the override produced no false 101it. **The override is a
lab-specific liability of roughly 9%, and AI-written descriptions mention switches and monitors more
often than seller-written ones do, so the live rate is probably higher than 9%, not lower.**

### 1.4 The confidence signal does not reach the app

- `runDetectionPass` returns per-product `site_type_confidence` (`wordPressSmart.js:2145-2158`).
- `processProductGroup` consumes it and **returns only `data.site_type`** (`:2010`).
- The SSE `detection` event carries `suggested_mode`, `confidence`, `summary`, `product_count`
  (`:3222-3228`). **That `confidence` is the item-COUNT confidence** (`:2202-2218`), not the
  marketplace confidence — easy to mistake one for the other, and it was `1` or `0.9` on every
  single call here, so it carries no usable signal either way.
- The final `result` payload carries `products[].data` plus top-level `suggested_terms`
  (`:3358-3376`). No marketplace confidence anywhere.
- `suggested_terms.site_type` — the only low-confidence tell — is populated **only** when
  `confidence < 0.6` or the type is unmappable (`smartExtractionValidator.js:294-303`), and it is
  merged at the **top level**, losing which product it belonged to. **In 81 calls it was `null`
  every time.**

Consequence: a threshold-based "auto-apply vs ask" policy cannot be built on today's API. Note also
that the low-confidence fallback is `recycle` — the one marketplace whose categories the app cannot
render (§2.4).

---

## 2. Category accuracy per marketplace

### 2.1 Measured

Grades are mine, against the tree the marketplace actually offers.

| # | Truth | Marketplace picked | Category picked (run 1) | Grade | Stable over 3 runs? |
|---|---|---|---|---|---|
| L1 | lab | LabGreenbidz | Life Sciences & Biotech / Microscopy & Imaging Systems | ✅ correct | yes |
| L2 | lab | LabGreenbidz | Life Sciences & Biotech / Microscopy & Imaging Systems | ✅ correct | yes |
| L3 | lab | LabGreenbidz | Lab Infrastructure / **Ovens and Furnaces** | ❌ wrong (it is an incubator) | **no** — runs 2/3 gave "Incubators and Growth Chambers" ✅ |
| L4 | lab | LabGreenbidz | Pharma & Analytical / Spectroscopy (UV-Vis, FTIR, NMR) | ✅ correct | yes |
| L5 | lab | LabGreenbidz | Life Sciences / Cell Culture & Analysis | 🟡 acceptable — no "Flow Cytometry" leaf exists | yes |
| L6 | lab | LabGreenbidz | Test and Measurement / Electronic Test (Oscilloscopes) | ✅ correct | yes |
| L7 | lab | machines | **Boring & Drilling Machines** | ❌ wrong | yes (wrong all 3) |
| M1 | machines | machines | Grinding & Finishing | ✅ correct | yes |
| M2 | machines | machines | Lathes | ✅ correct | yes |
| M3 | machines | machines | Milling Machines | ✅ correct | yes |
| M4 | machines | machines | **Boring & Drilling Machines** | ❌ wrong (glass tempering / plating line) | yes |
| M5 | machines | machines | **Boring & Drilling Machines** | ❌ wrong (glass cutting table) | yes |
| M6 | machines | 101it | Components / **GPU Accelerators** | ❌ wrong | yes |
| M7 | machines | machines | **Boring & Drilling Machines** | ❌ wrong (planer mill) | yes |
| I1 | 101it | 101it | Components / GPU Accelerators | ✅ correct | yes |
| I2 | 101it | 101it | Telecommunications / Communication accessories | 🟡 acceptable — no "Networking" parent | yes |
| I3 | 101it | 101it | Laptops & Desktops / **HP** | ❌ sub wrong — the laptop is an **ASUS** | yes |
| I4 | 101it | 101it | Laptops & Desktops / Lenovo | ✅ correct | yes |
| I5 | 101it | 101it | Components / **GPU Accelerators** | ❌ wrong (they are monitors) | **no** — run 2 gave "Laptops & Desktops / HP", also wrong |
| I6 | 101it | 101it | Smartphones | ✅ correct | yes |
| R1 | recycle | recycle | Surplus &amp; Scrap Materials / Plastic Scrap | ✅ correct | yes |
| R2 | recycle | recycle | **Metalworking Equipment / Tool and Cutter Grinders** | ❌ wrong (office chairs) | yes |
| R3 | recycle | recycle | **Metalworking Equipment / Tool and Cutter Grinders** | ❌ wrong (water bottle) | yes |
| R4 | recycle | recycle | **Metalworking Equipment / Sheet Metal Working** | ❌ wrong (conference furniture) | **no** — runs 2/3 went to 101it / Telecommunications |

**Category accuracy: 11/24 fully correct (46%), 2 acceptable, 11 wrong.**
**Category identical across all 3 runs: 21/24.**

| Marketplace | Correct | Acceptable | Wrong | Comment |
|---|---|---|---|---|
| 101lab | 4/7 | 1 | 2 | Best of the four. Both failures are an edge photo or a mis-route. |
| 101machine | 3/7 | 0 | 4 | 4 of 6 machines-routed items landed on the alphabetically-first parent. |
| 101it | 3/6 | 1 | 2 | Both failures trace to **missing taxonomy rows**, not model error. |
| 101recycle | 1/4 | 0 | 3 | The tree has no furniture and no consumer-goods bucket. |

### 2.2 The "Boring & Drilling Machines" fallback — the brief's premise is wrong, and the truth is worse

The brief attributes this to `pickDefaultParent(tree)` (`wordPressSmart.js:677-684`). **It is not
`pickDefaultParent`.** That function returns *the first parent that has children*. I rebuilt the
machines tree exactly as `categoryCache.js:91-114` loads it (taxonomy `machine-category`,
`ORDER BY tt.parent ASC, t.name ASC`):

```
machines parents (13, in load order):
  Boring & Drilling Machines(0) | Grinding & Finishing(0) | Laser & Plasma Cutting(0) |
  Lathes(0) | Machining Centers(0) | Material Handling(0) | Milling Machines(0) |
  Press Brakes & Shears(0) | Punching & Forging(0) | Sawing Machines(0) | Scrap(0) |
  Semiconductor Equipment(1) | Welding Equipment(0)

pickDefaultParent(machines tree) = "Semiconductor Equipment"   ← the only parent with a child
```

I also replicated the deterministic fuzzy fallback (`catTokenize` / `scoreAgainst` /
`findBestParent`, `wordPressSmart.js:652-722`) against the real returned names and descriptions
(`scratchpad/mm/fuzzy.mjs`; slugs approximated from names):

| # | Extracted name | Top fuzzy scores | ≥ `FUZZY_MIN_SCORE` (4)? | Fallback would give |
|---|---|---|---|---|
| M4 | "Industrial Plating Line with Control Panel" | Lathes=1, Punching & Forging=1 | no | Semiconductor Equipment |
| M5 | "Industrial Screen Printing Machine" | Boring & Drilling=3, Milling=3, Sawing=3 | no | Semiconductor Equipment |
| M7 | "WALDRICH COBURG Planer Mill" | Lathes=3, Milling Machines=3 | no | Semiconductor Equipment |
| L7 | "Alliance Control Panel" | Semiconductor Equipment=3, Welding=3 | no | Semiconductor Equipment |

**Neither deterministic fallback can produce "Boring & Drilling Machines".** So the observed value
comes from the **LLM category pick itself** (`pickCategoryFromTree`, `wordPressSmart.js:1877-1919`)
taking the first row of the tree text it is handed — `buildCompressedCategoryTree`
(`categoryCache.js:256-275`) emits parents in load order, and Boring is alphabetically first. It
reproduced identically on all 4 items in all 3 runs.

Why this matters for the plan: it is **not** a fallback you can gate or count. It is the primary path
returning a valid-looking id with no signal that it was a shrug. The same shape appears on every
tree:

| Tree | First / only generic parent | What lands there when nothing fits |
|---|---|---|
| machines (13 parents, 0 subs) | **Boring & Drilling Machines** | glass furnace, glass cutter, planer mill, a control panel |
| 101it (6 parents in the API tree) | **Components → GPU Accelerators** — the only child of the only generic parent | an AOI inspection machine, a pair of monitors, **a lab centrifuge** |
| recycle (37 parents) | **Metalworking Equipment** | office chairs, a water bottle, a conference table |

The root cause is **taxonomy coverage, not model quality**:

- `/product/machines/category?language=en` → **13 parents, 13 total ids, zero subcategories.** No
  glass machinery, no surface treatment, no inspection / metrology, no general bucket.
- `/product/it/category?language=en` → 6 parents, 31 ids. `Laptops & Desktops` children are
  **Dell, HP, Lenovo, MacBooks** — **there is no ASUS**, so I3 *could not* be right. There is no
  "Monitors" parent, so I5 *could not* be right. `Components` has exactly one child,
  `GPU Accelerators`, making it the de-facto dumping ground for the entire marketplace.
- The raw DB trees the AI is prompted with are far dirtier than the API trees: `iit_lab_product` has
  **62 root terms** including untranslated locale duplicates and brand names promoted to root
  (Cisco ×2, HPE ×4, IBM ×4, Lenovo ×2); `product-lab` has 15 roots of which 11 are untranslated
  locale duplicates — 10 of them with no children (`Hiệu chuẩn & Tiêu chuẩn`, `Kalibrasi & Standar`, …),
  plus `實驗室基礎設施與必備工具`, a locale duplicate that does carry 33 children.
- Recycle parent names are stored **HTML-escaped** — `Surplus &amp; Scrap Materials`,
  `Automation &amp; Robotics`. That string is returned verbatim and would render literally in the
  app's picker. It also breaks `catTokenize`, which splits on `&` and leaves the token `amp`.

### 2.3 `clearInvalidCategoryForSiteType` caught nothing

`wordPressSmart.js:1549-1558` delegates to `categoryParentMatchesSiteType`
(`smartExtractionValidator.js:271-280`). It rejects a parent only when **both** hold:

- `siteType` is `101it` **or** `LabGreenbidz` — machines and recycle are never checked; **and**
- the parent name matches
  `/boring|drilling|grinding|finishing|lathe|cnc|milling|press|forklift|compressor|machine tool/`.

Every cross-marketplace error observed slipped through: the centrifuge on `101it` got parent
"Components" (no keyword match); the AOI machine on `101it` got "Components"; the HPLC panel routed
to `machines` isn't checked at all. **0 of the 8 wrong-marketplace outcomes and 0 of the 11 wrong
categories were caught by this guard.** It defends only against one historical failure mode (IT
products landing on machine-tool parents) that did not occur once in this sample.

### 2.4 The app cannot render a recycle category at all

`src/services/scanner/fetchCategories.ts:24-29`:

```ts
if (marketplace === '101machine') return '/product/machines/category';
if (marketplace === '101it')      return '/product/it/category';
// 101lab + 101recycle (and the fall-through default) share the lab tree.
return '/product/lab/category';
```

**`101recycle` is routed to the LAB tree.** Verified against DEV: `/product/lab/category?language=en`
returns 4 parents / 66 ids and contains **neither** of the recycle ids the backend actually picks
(1281 `Surplus &amp; Scrap Materials`, 2019 `Metalworking Equipment`). So an auto-routed recycle item
arrives carrying a category id the picker cannot match → the field is cleared → the seller is asked
to file a scrap listing under *Lab Infrastructure & Essentials*. **101recycle is a taxonomy decision,
not a feature flag.**

And a cleared category is a **hard submit-blocker**, not merely a bad default: `categoryId` is
required by the form schema (`schema.ts:23` — `z.string().min(1, 'Category is required')`). So an
auto-routed recycle listing cannot be published at all until the seller picks a lab category for a
scrap lot. This also makes S2 ("let the picker say I don't know") safe by construction: an empty
category id already fails validation and surfaces in the required-fields checklist, which is exactly
the desired *ask the seller* behaviour.

---

## 3. Scrap value and the price tiers — where the numbers come from

### 3.1 The trace

1. The extraction prompt asks the vision model for `prices` directly: *"Also return a prices object
   using USD range strings for same product if sold as new, used, scrap:
   `{ "new": "min-max", "used": "min-max", "scrap": "min-max" }`"* — `wordPressSmart.js:421`, format
   rules at `:588`. **No market data, no comparables lookup, no metal-price feed, no DB query.** One
   language-model completion.
2. `ensureProductPrice` (`:1772-1818`) fills `price` when the model omitted it — with **another** LLM
   call ("Estimate fair used resale price…"), and if that fails, with `heuristicPriceEstimate`
   (`:1690-1719`): a hardcoded per-marketplace constant (`machines` → $45,000 new / $12,000 used;
   `LabGreenbidz` → $22,000 / $7,500; `recycle` → $400 / $120) times a grade multiplier.
3. `ensurePricesObject` (`:1754-1771`) fills any missing tier arithmetically:
   `new = used × 1.35`, **`scrap = used × 0.15`**, each widened to a ±10% band.
4. `pickAiPrices` (`mapSmartDetection.ts:118-134`) passes the strings to the app unchanged.
5. `ProfitIntelligenceCard.deriveFigures` (`:64-101`) computes what the seller reads:
   `profit = used − scrap`; `percent = round(profitMid / scrapMid × 100)`, capped at 999 (`:97`).

**Answer, plainly: the scrap value is invented by the language model. There is no grounding of any
kind.** The one non-model path (`used × 0.15`) is a magic constant, and it never even fired — the
model returned a `scrap` range on all 81 calls, so **100% of the scrap figures a seller would see
today are model guesses**, and the "% more than scrap" sentence is arithmetic performed on two
guesses.

### 3.2 What the seller would actually be shown

`percent` recomputed exactly as `deriveFigures` does, from the live responses:

| # | Item | scrap range (USD) | used range (USD) | percent shown — run 1 / 2 / 3 |
|---|---|---|---|---|
| L1 | Zeiss microscope | 100-300 | 3000-6000 | **999 / 999 / 999** |
| L2 | Nikon microscope | 50-150 | 1000-1800 | **999 / 999 / 999** |
| L3 | Binder incubator | 50-100 / 50-150 / 50-100 | 1200-2500 | **999 / 999 / 999** |
| L4 | Philips spectrophotometer | 50-150 | 300-1000 | 400 / **650** / 400 |
| L5 | BD FACSVerse | 500-1000 | 20000-35000 | **999 / 999 / 999** |
| L6 | Keysight scope | 50-100 | 700-1400 | **999 / 999 / 999** |
| L7 | Alliance panel | 10-30 | 250-500 | **999 / 999 / 999** |
| M1 | Surface grinder | 500-1000 | 7000-12000 | **999 / 999 / 999** |
| M2 | Lathe | 300-500 / 200-400 / 300-600 | 2500-5000 | 900 / **999** / 789 |
| M3 | Milling machine | 200-400 | 3000-9000 | **999 / 999 / 999** |
| M4 | Plating line | 1000-3000 | 30000-60000 | **999 / 999 / 999** |
| M5 | Glass cutter | 500-1000 | 7000-25000 | **999 / 999 / 999** |
| M6 | AOI machine | 500-1000 | 20000-50000 | **999 / 999 / 999** |
| M7 | Planer mill | 1000-3000 | 20000-50000 | **999 / 999 / 999** |
| I1 | H100 GPU | 500-1000 | 25000-40000 | **999 / 999 / 999** |
| I2 | TP-Link AP | 1-5 | 20-45 | **999 / 999** / 900 |
| I3 | ASUS Vivobook | 20-50 / 50-100 / 20-50 | 300-500 | **999** / 433 / **999** |
| I4 | Lenovo laptop | 50-100 | 350-750 | 567 / **733** / 633 |
| I5 | Monitors | 50-100 / 20-50 / 20-50 | 200-450 | 367 / 900 / 686 |
| I6 | Smartphone | 10-30 / 10-30 / 5-15 | 30-250 | 775 / 775 / 450 |
| R1 | Water bottle | 1-1 | 1-5 | 150 / 150 / 150 |
| R2 | Office chairs | 20-40 / 10-20 / 20-40 | 200-400 | 983 / **999** / 733 |
| R3 | Sports bottle | 1-3 | 5-15 | 400 / 400 / 400 |
| R4 | Conference set | 100-200 | 1000-1800 | 833 / 833 / 733 |

**Distribution over all 72 runs: median 999. 45/72 (63%) hit the 999 display cap. 61/72 (85%) are
≥ 500%. 49/72 (68%) are ≥ 900%.** The owner's "733%" is real — it is what I4 returned on run 2 — but
it is at the *low* end of what this card emits. The typical seller sees "**999% more than scrap
value alone**", which is a cap artefact, not a finding.

Two further problems visible in the same table:

- **Instability on identical input.** Same photo, same endpoint, minutes apart: I3 swings
  **433% → 999%** (566 points), I5 **367% → 900%**, I6 **450% → 775%**, R2 **733% → 999%**. The
  underlying `price` spread on one photo reaches **×3.0** (I6: $50 vs $150) and **×2.1** (M5: $8,500
  vs $18,000). A seller who re-scans the same machine gets a materially different valuation.
- **The static stub.** When the model returns no usable tiers, `deriveFigures` falls through to
  `STATIC_SCRAP_BASELINE_USD = 12_500`, `STATIC_POTENTIAL_PROFIT_USD = 4_200`,
  `STATIC_PROFIT_PERCENT = 33` (`ProfitIntelligenceCard.tsx:18-20`, `:104-115`) and sets
  `fromAi: false`, which **hides the "AI" badge** — so the seller sees hardcoded fiction with no
  marker at all. Direct violation of `UX_DESIGN_RULES.md` → *"Low confidence should request
  clarification, not invent information."* It never fired in my 81 calls, which makes it worse, not
  better: it is untested code that activates precisely when the AI failed.

### 3.3 Does valuation differ per marketplace? Should it?

It differs, but only where it doesn't matter:

- `heuristicPriceEstimate` (`:1690-1719`) branches per `siteType` — but it is a last-resort fallback
  and never ran in this audit.
- `ensureProductPrice` puts `site_type: siteType` in the LLM payload (`:1789`) and the prompt says
  *"on marketplace X"*, so the marketplace nudges the model's guess.
- `ensurePricesObject` (`:1754-1771`) — the arithmetic that *defines* the scrap ratio — is
  **marketplace-agnostic**. Every marketplace gets `scrap = used × 0.15`.
- `prices` are always USD server-side (`:1791`, `:1817`), and the app derives `priceCurrency` from
  **the env site type**, not the detected one (`mapSmartDetection.ts:157`, inside `mapProductData(data, siteType)`). So unlocking 101it will **not** switch the currency to TWD via
  `defaultCurrencyForSite` unless the call site starts passing the detected site type.

**It should differ, a lot.** A working lab instrument's floor is its resale value as a working
instrument; a scrap lot's floor is metal weight × spot price. `scrap = used × 0.15` is meaningless for
both. And the one marketplace where a scrap figure *could* be grounded — recycle, where `weight` came
back on 65% of runs — is exactly where the code applies the same blind ratio.

---

## 4. The other auto-filled fields

Fill rate over all 72 runs (24 photos × 3). "Filled" excludes empty strings, the literal string
`"null"`, and the placeholder `"0 kg"` for CO₂.

| Field | Filled | % | Notes |
|---|---|---|---|
| `condition` | 72/72 | 100% | Always `usedFunctional` in this sample — effectively a constant, not a judgement. |
| `grade` | 72/72 | 100% | Always `B`. Same caveat — and grade feeds a price multiplier, so a constant B is a silent no-op. |
| `currency` | 72/72 | 100% | Always `USD`, hardcoded server-side. |
| `weight` | 47/72 | 65% | Plausible magnitudes, but varies run-to-run (M6 500 vs 800 kg; I1 2 vs 5 kg). |
| `dimensions` | 47/72 | 65% | Same. |
| `brand` | 45/72 | 63% | See below. |
| `model` | 30/72 | 42% | See below. |
| `operation_status` | 30/72 | 42% | Empty on 42 runs; the app substitutes `DEFAULT_OPERATION_STATUS`. |
| `year` | 16/72 | 22% | Emitted as the **literal string `"null"`** on L7 and M4 — a real bug: neither empty nor a year. |
| `co2_emissions` | 11/72 | 15% | Mostly `"0 kg"` — a placeholder dressed as a measurement. |

**Brand / model quality, not just presence:**

- Brand was **stable** across the 3 runs on all 24 photos — better than the reported Sigma case
  implies. But stable ≠ right: M1's brand came back `"ST"` (the badge reads 主新德 / ShinDer), and
  I5's came back `"SHARP"` for a lot that is two monitors *plus* a Logitech keyboard and mouse.
- Model text was unstable on 1/24 photos, and it was the nameplate case:
  **L3 Binder BD 53 → `"ED 53"` / `"BD 53"` / `"BD 23"`** — one correct read in three.
  The dedicated nameplate set reproduced the failure differently: Sigma **3K15** came back as
  **`"3K1S"` all three times** — a *consistently* wrong read, which is worse than a flapping one
  because it looks trustworthy. Both are the same underlying defect the brief describes.
- The honesty machinery does work. `needs_clearer_photo` was `true` on 9/24 photos (M2, M3, M4, M5,
  I6, R1–R4) — every one a photo with no legible nameplate. The deterministic backstop at
  `wordPressSmart.js:810-824` ("no brand AND no model ⇒ unsure") is doing the heavy lifting, not the
  model's self-report.

**How much must the seller fix by hand?** Taking run 1 as the seller's experience across the
24-photo set: category wrong or loose on **13/24**, brand missing or wrong on **11/24**, model
missing or wrong on **16/24**, year missing on **19/24**, marketplace wrong on **2/24**. Only
**5/24** photos (L1, L2, L4, L5, I4) produced a draft I would publish without touching a field.
**Auto-fill is a strong first draft, not a finished listing** — the review screen is load-bearing and
must stay.

**Latency** (DEV, single image): p50 **11.1 s**, p90 **15.6 s**, max **37.8 s** (n=72). The 4-image
mixed upload took ~35 s. Well past the point where the loading copy must explain itself, per
`UX_DESIGN_RULES.md` → *Loading states*.

---

## 5. The thing that already works: mixed uploads

One submission, four photos, four marketplaces. Run twice, identical both times:

| Product | Images | site_type | Name | Category | Correct? |
|---|---|---|---|---|---|
| 1 | [0] | **LabGreenbidz** | Nikon SMZ800 Stereomicroscope | Life Sciences / Microscopy & Imaging | ✅ |
| 2 | [1] | **machines** | Industrial Metal Lathe | **Material Handling** | site ✅ / cat ❌ |
| 3 | [2] | **101it** | Lenovo IdeaPad Gaming Laptop | Laptops & Desktops / Lenovo | ✅ |
| 4 | [3] | **recycle** | Blue Plastic Water Bottle | Surplus &amp; Scrap Materials / Plastic Scrap | ✅ |

`detection: {suggested_mode:"multiple", confidence:1, product_count:4}`.
**Per-item marketplace routing in a mixed batch: 8/8 across the two runs.** The premise of the
feature is sound — the backend really does route one upload to four marketplaces.

Two side-observations from the same test:

- The lathe's category **degraded** in the batch (`Material Handling`) versus solo (`Lathes`, 3/3) —
  the grouped path gives the category picker less context per item. Not investigated further;
  flagged because `grouped-review` is the multi-item hub.
- `merged_single.site_type` is **`LabGreenbidz`** — the *first* product's marketplace
  (`wordPressSmart.js:3312-3320`), and `mapSmartDetection.ts:258-261` builds `mergedSingleFields`
  from it. Any path that falls back to `mergedSingleFields` on a mixed batch silently takes the wrong
  marketplace.

---

## 6. What must be fixed first, what can ship as-is

### Blockers — do not unlock without these

| # | Fix | Why | Where |
|---|---|---|---|
| B1 | **Emit per-product `site_type_confidence`** on the SSE `product` event and in `result.products[]`. | Without it no threshold policy is implementable; today's only signal fired 0/81 times. | `wordPressSmart.js:3271-3277`, `:3358-3376`; `processProductGroup` return at `:2010` |
| B2 | **Neuter or gate `inferSiteTypeFromProduct`.** Minimum: drop `switch`, `monitor`, `printer`, `graphics`, `tablet`, `server` when they appear only in the *description*; require a `name`/`brand`/`model` hit; stop IT winning the tie against lab. | Directly, reproducibly causes a lab centrifuge to be sold as a GPU accelerator (N1) and an AOI machine as an IT component (M6). ~9% false positives over 800 real lab listings. | `smartExtractionValidator.js:223`, `:235-268` |
| B3 | **Give `101recycle` a real category endpoint** (or decide it inherits the recycle `product_cat` tree), and un-escape the `&amp;` in the stored names. | The app sends recycle listings to the LAB tree; none of the ids the backend picks exist there. | `fetchCategories.ts:24-29`; `jos_terms` for taxonomy `product_cat` |
| B4 | **Stop the profit card inventing numbers.** Delete the static-stub path; when tiers are missing, hide the figures and say so. A capped `percent` (999) must never render as a number. | 63% of real responses render as "999% more than scrap"; the stub shows $12,500 / $4,200 / 33% with the AI badge hidden. Violates `UX_DESIGN_RULES.md` → AI UX rules. | `ProfitIntelligenceCard.tsx:18-20`, `:64-118`, `:303-308` |
| B5 | **Pass the *detected* site type into `mapProductData`** so `defaultCurrencyForSite` and the category bridge follow the AI's marketplace, not the env default. **⚠ Must ship together with a price conversion — see B6.** | Otherwise unlocking leaves 101it listings priced in USD and bridged against the wrong tree. | `mapSmartDetection.ts:157`, `:250`, `:258-261` |
| B6 | **Convert the price value when the currency label changes.** B5 on its own is a mispricing bug: `mapProductData` sets `price = pickPrice(data.price)` (`mapSmartDetection.ts:153`) and `currency = defaultCurrencyForSite(siteType)` (`:157`) **independently, with no conversion**. The backend always returns price in USD (prompt: *"Single positive integer USD (> 0), currency must be \"USD\""*, `wordPressSmart.js:421`), and `defaultCurrencyForSite` returns `TWD` for `101it` (`constants.ts:70-72`). So a detected-101it item would carry the USD number under a TWD label. | A $4,500 laptop renders as **NT$4,500 ≈ US$143** — a **31.5×** under-price (`FX_RATE_TWD_PER_USD = 31.5`, `currencyFx.ts:11`) on the one field that is the actual listing price, forwarded to `_product_currency` meta. `PricingCard.tsx:32-39` converts only when the *seller* toggles the pill, never on the AI-mapping path, so nothing downstream repairs it. | `mapSmartDetection.ts:153`, `:157`; `constants.ts:70-72`; `currencyFx.ts:11-27`; `PricingCard.tsx:32-39` |

### The three places the lock actually lives

Unhiding the picker is **not** sufficient. The brief named three switch-off sites and all three must
change together, or the AI's marketplace is still discarded:

| # | Site | What it does today | Needed |
|---|---|---|---|
| L-1 | `MarketplaceCard.tsx:22` — `const MARKETPLACE_LOCKED = true` | picker renders `null` | flip / gate on a supported-marketplaces config |
| L-2 | `scanDraftStore.ts:413` — `marketplace: marketplaceFromSiteType(getSiteType())` | **throws away the AI's answer for the env default** on the apply path | take the detected marketplace (subject to the §7 bands) |
| L-3 | `app/scan/processing.tsx:504-508` | same lock on the single-photo path — the draft keeps `emptyDraft`'s env default and the AI's `site_type` is never patched in | patch the detected marketplace |

L-2 and L-3 are the ones that bite silently: with only L-1 flipped, the seller sees a picker that is
always pre-set to the env marketplace regardless of what the backend detected, and
`suggestedMarketplace` (`mapSmartDetection.ts:188`) stays computed-but-unused as it is today.

### Should fix before the unlock is *useful* (not strictly blocking)

| # | Fix | Evidence |
|---|---|---|
| S1 | **Add the missing taxonomy rows.** /machines needs surface treatment, glass machinery, inspection/metrology and a general bucket (13 flat parents, 0 subs today). /101it needs `ASUS` under Laptops & Desktops and a `Monitors & Displays` parent. /recycle needs Furniture and a consumer-goods bucket. | 8 of the 11 category errors were **unreachable-correct-answer** errors, not model errors. |
| S2 | **Let the category picker say "I don't know."** Allow `pickCategoryFromTree` to return an empty id and treat empty as *ask the seller*, instead of the cascade at `wordPressSmart.js:1975-1990` + `ensureCategoryPairForSiteType` (`:1560`) which guarantees *some* id. | 4/6 machines items and 3/4 recycle items got a confident wrong id; blank would have been strictly better. |
| S3 | **Strip locale-duplicate and brand-root terms from the prompt tree.** `iit_lab_product` = 62 roots (Cisco ×2, HPE ×4, IBM ×4); `product-lab` = 15 roots of which 11 are untranslated duplicates (10 childless, 1 carrying 33 children). The API already serves clean trees (6 and 4 parents) — the AI is handed the dirty version. | `categoryCache.js:117-146`, `:256-275` vs `/product/it/category`, `/product/lab/category` on DEV |
| S4 | **Fix `year: "null"`** (literal string) and stop emitting `co2_emissions: "0 kg"` as a value. | L7, M4; CO₂ "filled" 15% |
| S5 | Investigate why grouped extraction degrades category quality (Lathe: `Lathes` solo → `Material Handling` in a 4-item batch). | §5 |
| S6 | `condition` and `grade` were constant (`usedFunctional`, `B`) on all 72 runs. Either make them vary or stop presenting them as detected — grade silently drives a price multiplier. | §4 |

### Can ship as-is

- **Per-item routing for lab / machines / IT.** 89% overall, 100% on 101it, stable across three runs
  on 23/24 photos. Behind a confirmation step this is a good product.
- **Mixed multi-marketplace uploads.** 8/8 correct routing across two runs; `grouped-review` already
  handles the per-product shape.
- **The app's marketplace plumbing.** `MARKETPLACE_OPTIONS`, `marketplaceFromSiteType`,
  `marketplaceToPlatform`, `marketplaceToAllowedSite`, and the per-marketplace category fetch all
  exist — for the three marketplaces that have trees. (Existence read from source; the submit URL and
  `allowed_sites[]` were **not** exercised end-to-end in this audit — no listing was submitted.)
  `detailSchema` already accepts all four (`schema.ts:57`), so the unlock needs no schema change.
- **`needs_clearer_photo`.** True on 9/24, every one a genuinely illegible nameplate. Use it as a
  gating signal.

---

## 7. The threshold I would set

Because B1 does not exist yet, everything below is a **specification for the signal to be added**,
not something that can be switched on today.

| Confidence (per product) | Behaviour | Rationale from the data |
|---|---|---|
| **≥ 0.90** | Auto-apply the marketplace, presented as a **confirmable statement**, not a silent fact: one line, *"Listing on 101machine — change"*. | 23/24 photos were stable across three runs. But note the two hard failures (N1, M6) were caused by the regex override, **not** by low vision confidence — so B2 is a prerequisite for trusting this band at all. |
| **0.60 – 0.90** | Pre-select the AI's marketplace but **require one tap to confirm** before the category tree loads. | L7 and R4 — the two genuinely ambiguous photos (a bare control panel; a room of furniture) — are exactly this band's population. |
| **< 0.60** | Do **not** apply. Show the four pills with the AI's guess highlighted and a plain reason: *"I can't tell what this is — pick a marketplace."* **Never fall back to `recycle`.** | Today `normalizeDetectedSiteType` silently rewrites this band to `recycle` (`smartExtractionValidator.js:299-303`) — the one marketplace whose categories the app cannot render. |
| **Any band, `needs_clearer_photo === true`** | Ask regardless of confidence, and offer "add a clearer photo" as the primary recovery. | 9/24 photos; correlates perfectly with an unreadable nameplate. |

Category needs a **separate, stricter** rule, because category was wrong more than twice as often as
marketplace: **never auto-commit a category the model could not justify.** Until S2 exists, treat any
category on `/machines` or `/recycle` as unconfirmed and make the seller tap it — 4/6 and 3/4 wrong
respectively is not a rate you can hide behind a pre-filled field.

### UX notes (checked against `UX_DESIGN_RULES.md`)

`detail.tsx` is already one scroll of ten cards, so unhiding `MarketplaceCard`
(`MarketplaceCard.tsx:22`) adds an eleventh control to a screen that already strains *"avoid
unnecessary scrolling"* and *"one focal point"*.

- **Don't add a card — change the existing one.** Marketplace belongs *inside* the category card's
  header, as the scope line for the tree below it. The two are one decision ("where does this go?"),
  and *Remove duplication* / *Cognitive load* argue against two adjacent controls for one decision.
- **High confidence → a statement with an escape hatch**, not a four-way picker. Four always-visible
  pills make the machine look unsure when it is 90% right, and add a decision the seller doesn't need.
- **Low confidence → ask on the processing screen, before `detail.tsx` renders.** Asking after the
  form has populated the wrong tree makes the seller redo work; asking during the 11 s wait costs
  nothing. This is *"Low confidence should request clarification"* applied literally.
- **Show the confidence.** The rules require *"✔ AI confidence"* wherever AI generates content.
  Today the app has none to show, on any field — B1 is a UX-rules compliance item, not just an
  engineering nicety.
- **Name the marketplace in the loading copy.** Generic loaders are forbidden; *"Checking which
  marketplace this belongs to…"* → *"Loading 101machine categories…"* also pre-announces the
  marketplace switch so it isn't a surprise on arrival.
- **The profit card must degrade honestly.** A capped 999% and a hardcoded $12,500 both read as
  confident analysis. Either ground the scrap figure (recycle can: `weight` × spot price, and weight
  is present 65% of the time) or reframe the card as an explicit range with an "AI estimate — verify
  before publishing" line. Do not ship a marketplace unlock that makes this card render on three
  more marketplaces than it does today.

---

## 8. How this was measured — reproduce it

Scripts (all read-only) are in
`C:/Users/Pc/AppData/Local/Temp/claude/c--Users-Pc-Desktop-greenBridge/e2572d08-2c78-4d64-871d-837bace37b0a/scratchpad/mm/`:

| File | What it does |
|---|---|
| `pull2.mjs`, `urls.mjs` | Sample published listings per `site_type` meta from the DEV DB (`greenbidz_test`) and resolve thumbnail URLs. |
| `collage.py` | Build a contact sheet so ground truth is assigned from the **photo**, not the seller's tag. |
| `run.mjs` / `run2.mjs` | POST one `image_urls` field as **multipart** to `https://testapi.greenbidz.com/api/v1/wp/analyze-smart-detection-v2`, consume the SSE stream, record the `result` event. (A urlencoded body arrives empty — multer.) |
| `mixed.mjs` | Same, with 4 images from 4 marketplaces in one submission. |
| `analyze.mjs` | Accuracy, stability, and the `percent` figure recomputed exactly as `ProfitIntelligenceCard.deriveFigures` does. |
| `infer.mjs` | Byte-for-byte copy of `inferSiteTypeFromProduct`, replayed over the real returned text. |
| `fuzzy.mjs` | Replica of `catTokenize` / `scoreAgainst` / `findBestParent` against the machines tree. |
| `trees.mjs` | Rebuilds all four raw prompt trees exactly as `categoryCache.js` loads them; computes `pickDefaultParent`. |
| `scale.mjs` | Runs the infer copy over 800 real lab listings for the false-positive rate. |
| `cats.mjs` | Fetches the four category endpoints the app uses and checks whether the backend's picked ids exist in them. |

Raw outputs: `runA.json`, `runB.json`, `runC.json` (24 photos × 3), `nA1-3.json` (nameplate set),
`mixed.json`, `agg.json`, `trees.json`, `collage.png`.

### Explicitly NOT verified

- **Everything was measured against DEV** (`testapi.greenbidz.com`, DB `greenbidz_test`). Prod runs a
  different vision-provider configuration and a different DB (`:4000` / `greenbidz`). **Prod accuracy
  is not verified.**
- **Which internal layer produced each category id is inferred, not instrumented.** I proved the two
  deterministic fallbacks *cannot* produce "Boring & Drilling Machines" (§2.2) and concluded the LLM
  pick did. I did not add server logging to confirm it directly.
- `fuzzy.mjs` **approximates the category slugs** from names; the real `slug` column may score
  slightly differently. The conclusion (score < `FUZZY_MIN_SCORE` = 4) has margin, but the exact
  scores are approximate.
- **n = 24 photos + 3 nameplate photos.** The percentages are indicative, not statistically tight.
  The 9% override false-positive rate is the only large-n number (n = 800), and it uses
  *seller-written* text as a proxy for AI-written descriptions.
- **`clearInvalidCategoryForSiteType` was assessed by code reading plus the absence of any caught
  error across 81 calls**, not by instrumenting the function.
- `condition` came back `usedFunctional` and `grade` `B` on **all** 72 runs; I did not test new or
  boxed items, so whether those fields can vary at all is **not verified**.
- The static-stub path in `ProfitIntelligenceCard` **never fired** in 81 calls — its behaviour is
  read from the source, not observed. (Confirmed by recomputation: `scrap` and `used` were both
  present on **72/72** product results, so `deriveFigures` took the `fromAi: true` branch every time.)
- **Only one of the two mixed-upload runs is retained on disk.** `mixed.mjs` writes `mixed.json`
  unconditionally, so the second run overwrote the first. The retained run does show 4/4 correct
  routing, `merged_single.site_type = LabGreenbidz`, and the lathe's `Material Handling` degradation;
  the claim of **8/8 across two runs** rests on the retained run plus a console observation of the
  other. Treat the mixed-upload result as **4/4 artifact-backed, 8/8 as-observed**.
- **`runA.json` did not retain the returned description text** (only `desc_len`), so the
  `inferSiteTypeFromProduct` replay in §1.3 is reproducible on `runB`/`runC` only. The N1 and M6 root
  causes were re-confirmed against the real module on both of those runs.
- The submit path (`marketplaceToPlatform`, `marketplaceToAllowedSite`) was **read, not exercised** —
  no listing was submitted on any marketplace.
- No production write, publish, submit, push, commit, branch switch, or migration was performed.
